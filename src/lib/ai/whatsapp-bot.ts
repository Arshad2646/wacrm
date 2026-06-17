import type { SupabaseClient } from '@supabase/supabase-js';

import { buildBusinessScopedPrompt } from '@/lib/ai/prompt';
import { generateAiResponse } from '@/lib/ai/provider';
import { loadBusinessKnowledge } from '@/lib/knowledge/load';
import { detectBuyingIntent, shouldUseFullLeads } from '@/lib/leads/detect';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';

const DEFAULT_FALLBACK_MESSAGE =
  'Thank you for your message. Our team will get back to you shortly.';

export type AiReplyBlockReason =
  | 'no_text'
  | 'bot_disabled'
  | 'conversation_paused'
  | 'usage_limit_reached'
  | null;

export interface AiReplyDecisionInput {
  hasCustomerText: boolean;
  botEnabled: boolean;
  conversationBotPaused: boolean;
  repliesUsed: number;
  monthlyLimit: number;
}

export interface AiReplyDecision {
  shouldCallAi: boolean;
  shouldSendFallback: boolean;
  reason: AiReplyBlockReason;
}

export function utcMonthStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function isAiUsageLimitReached(
  repliesUsed: number,
  monthlyLimit: number
): boolean {
  return monthlyLimit <= 0 || repliesUsed >= monthlyLimit;
}

export function decideAiReply(input: AiReplyDecisionInput): AiReplyDecision {
  if (!input.hasCustomerText) {
    return {
      shouldCallAi: false,
      shouldSendFallback: false,
      reason: 'no_text',
    };
  }
  if (!input.botEnabled) {
    return {
      shouldCallAi: false,
      shouldSendFallback: false,
      reason: 'bot_disabled',
    };
  }
  if (input.conversationBotPaused) {
    return {
      shouldCallAi: false,
      shouldSendFallback: false,
      reason: 'conversation_paused',
    };
  }
  if (isAiUsageLimitReached(input.repliesUsed, input.monthlyLimit)) {
    return {
      shouldCallAi: false,
      shouldSendFallback: true,
      reason: 'usage_limit_reached',
    };
  }
  return { shouldCallAi: true, shouldSendFallback: false, reason: null };
}

export interface HandleInboundAiReplyInput {
  supabase: SupabaseClient;
  accountId: string;
  conversationId: string;
  contactId: string;
  contactName: string | null;
  phoneNumber: string;
  inboundMessageId: string;
  inboundMetaMessageId: string;
  inboundText: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
}

async function getRepliesUsed(
  supabase: SupabaseClient,
  accountId: string,
  monthStart: string
): Promise<number> {
  const { data, error } = await supabase
    .from('account_ai_usage_months')
    .select('ai_replies_used')
    .eq('account_id', accountId)
    .eq('month_start', monthStart)
    .maybeSingle();

  if (error) {
    console.error('[whatsapp-ai] usage lookup failed:', error.message);
    return 0;
  }

  return data?.ai_replies_used ?? 0;
}

async function sendAndSaveBotMessage({
  supabase,
  conversationId,
  phoneNumber,
  text,
  whatsappPhoneNumberId,
  whatsappAccessToken,
  contextMessageId,
}: {
  supabase: SupabaseClient;
  conversationId: string;
  phoneNumber: string;
  text: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  contextMessageId: string;
}): Promise<boolean> {
  try {
    const result = await sendTextMessage({
      phoneNumberId: whatsappPhoneNumberId,
      accessToken: whatsappAccessToken,
      to: phoneNumber,
      text,
      contextMessageId,
    });

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: text,
      message_id: result.messageId,
      status: 'sent',
      reply_to_message_id: null,
    });

    if (messageError) {
      console.error(
        '[whatsapp-ai] sent reply but failed to save:',
        messageError
      );
      return false;
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .update({
        last_message_text: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (conversationError) {
      console.error(
        '[whatsapp-ai] failed to update conversation after reply:',
        conversationError.message
      );
    }

    return true;
  } catch (error) {
    console.error(
      '[whatsapp-ai] reply send failed:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

async function incrementUsage(
  supabase: SupabaseClient,
  accountId: string,
  monthStart: string
) {
  const { error } = await supabase.rpc('increment_account_ai_usage', {
    p_account_id: accountId,
    p_month_start: monthStart,
  });

  if (error) {
    console.error('[whatsapp-ai] usage increment failed:', error.message);
  }
}

async function saveLeadIntent({
  supabase,
  accountId,
  conversationId,
  contactId,
  contactName,
  phoneNumber,
  inboundMessageId,
  productInterest,
  notes,
  fullLeads,
}: {
  supabase: SupabaseClient;
  accountId: string;
  conversationId: string;
  contactId: string;
  contactName: string | null;
  phoneNumber: string;
  inboundMessageId: string;
  productInterest: string | null;
  notes: string | null;
  fullLeads: boolean;
}) {
  const detectedAt = new Date().toISOString();
  const { error: conversationError } = await supabase
    .from('conversations')
    .update({
      lead_intent_detected: true,
      lead_interest: productInterest,
      lead_last_detected_at: detectedAt,
      updated_at: detectedAt,
    })
    .eq('id', conversationId)
    .eq('account_id', accountId);

  if (conversationError) {
    console.error('[whatsapp-ai] lead lite save failed:', conversationError);
  }

  if (!fullLeads) return;

  const { error: leadError } = await supabase.from('leads').upsert(
    {
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      source_message_id: inboundMessageId,
      customer_name: contactName || null,
      phone_number: phoneNumber,
      product_interest: productInterest,
      notes,
    },
    { onConflict: 'account_id,conversation_id' }
  );

  if (leadError) {
    console.error('[whatsapp-ai] full lead upsert failed:', leadError);
  }
}

export async function handleInboundAiReply(
  input: HandleInboundAiReplyInput
): Promise<void> {
  const customerText = input.inboundText.trim();

  try {
    const [bundle, conversationResult] = await Promise.all([
      loadBusinessKnowledge(input.supabase, input.accountId),
      input.supabase
        .from('conversations')
        .select('bot_paused')
        .eq('id', input.conversationId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
    ]);

    if (conversationResult.error) {
      console.error(
        '[whatsapp-ai] conversation state lookup failed:',
        conversationResult.error.message
      );
    }

    const fullLeads = shouldUseFullLeads(bundle.account);
    const leadIntent = detectBuyingIntent(customerText, bundle.activeProducts);
    if (
      leadIntent.hasIntent &&
      (bundle.account.lead_lite_enabled || fullLeads)
    ) {
      await saveLeadIntent({
        supabase: input.supabase,
        accountId: input.accountId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        contactName: input.contactName,
        phoneNumber: input.phoneNumber,
        inboundMessageId: input.inboundMessageId,
        productInterest: leadIntent.productInterest,
        notes: leadIntent.notes,
        fullLeads,
      });
    }

    const monthStart = utcMonthStart();
    const repliesUsed = await getRepliesUsed(
      input.supabase,
      input.accountId,
      monthStart
    );
    const decision = decideAiReply({
      hasCustomerText: customerText.length > 0,
      botEnabled: bundle.account.bot_enabled,
      conversationBotPaused: conversationResult.data?.bot_paused ?? false,
      repliesUsed,
      monthlyLimit: bundle.account.monthly_ai_reply_limit,
    });

    if (!decision.shouldCallAi) {
      if (decision.shouldSendFallback) {
        await sendAndSaveBotMessage({
          supabase: input.supabase,
          conversationId: input.conversationId,
          phoneNumber: input.phoneNumber,
          text: bundle.profile?.fallback_message || DEFAULT_FALLBACK_MESSAGE,
          whatsappPhoneNumberId: input.whatsappPhoneNumberId,
          whatsappAccessToken: input.whatsappAccessToken,
          contextMessageId: input.inboundMetaMessageId,
        });
      }
      return;
    }

    const prompt = buildBusinessScopedPrompt(bundle, customerText);
    let replyText =
      bundle.profile?.fallback_message || DEFAULT_FALLBACK_MESSAGE;
    let generatedByAi = false;

    try {
      const response = await generateAiResponse(prompt);
      replyText = response.text;
      generatedByAi = true;
    } catch (error) {
      console.error(
        '[whatsapp-ai] provider failed; using fallback:',
        error instanceof Error ? error.message : error
      );
    }

    const sent = await sendAndSaveBotMessage({
      supabase: input.supabase,
      conversationId: input.conversationId,
      phoneNumber: input.phoneNumber,
      text: replyText,
      whatsappPhoneNumberId: input.whatsappPhoneNumberId,
      whatsappAccessToken: input.whatsappAccessToken,
      contextMessageId: input.inboundMetaMessageId,
    });

    if (sent && generatedByAi) {
      await incrementUsage(input.supabase, input.accountId, monthStart);
    }
  } catch (error) {
    console.error(
      '[whatsapp-ai] inbound AI handler failed:',
      error instanceof Error ? error.message : error
    );
  }
}
