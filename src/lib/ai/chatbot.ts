import type { SupabaseClient } from '@supabase/supabase-js';

import { loadBusinessKnowledge } from '@/lib/knowledge/load';
import {
  buildBusinessScopedConversationPrompt,
  buildBusinessScopedPrompt,
  type ConversationTurn,
} from './prompt';
import { generateAiResponse, type AiResponse } from './provider';

export interface ChatbotPreviewResult extends AiResponse {
  systemPrompt: string;
}

export async function generateBusinessScopedPreviewReply({
  supabase,
  accountId,
  customerMessage,
}: {
  supabase: SupabaseClient;
  accountId: string;
  customerMessage: string;
}): Promise<ChatbotPreviewResult> {
  const message = customerMessage.trim();
  if (!message) throw new Error('Enter a customer message to test.');

  const bundle = await loadBusinessKnowledge(supabase, accountId);
  const prompt = buildBusinessScopedPrompt(bundle, message);
  const response = await generateAiResponse(prompt);

  return {
    ...response,
    systemPrompt: prompt.system,
  };
}

export async function generateBusinessScopedChatReply({
  supabase,
  accountId,
  turns,
}: {
  supabase: SupabaseClient;
  accountId: string;
  turns: ConversationTurn[];
}): Promise<ChatbotPreviewResult> {
  const bundle = await loadBusinessKnowledge(supabase, accountId);
  const prompt = buildBusinessScopedConversationPrompt(bundle, turns);
  const response = await generateAiResponse(prompt);

  return {
    ...response,
    systemPrompt: prompt.system,
  };
}
