import { NextResponse } from 'next/server';

import {
  UnauthorizedError,
  ForbiddenError,
  requireRole,
} from '@/lib/auth/account';
import { generateBusinessScopedChatReply } from '@/lib/ai/chatbot';
import type { ConversationTurn } from '@/lib/ai/prompt';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import {
  refundAccountAiReply,
  reserveAccountAiReply,
  utcMonthStart,
} from '@/lib/ai/whatsapp-bot';
import { createServiceRoleClient } from '@/lib/supabase/admin';

type IncomingTurn = {
  role?: unknown;
  content?: unknown;
};

const MAX_TURNS = 12;
const MAX_TURN_CHARS = 2000;

function normalizeTurns(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((turn: IncomingTurn) => {
      const role: ConversationTurn['role'] =
        turn.role === 'assistant' ? 'assistant' : 'customer';
      const content =
        typeof turn.content === 'string'
          ? turn.content.trim().slice(0, MAX_TURN_CHARS)
          : '';
      return { role, content };
    })
    .filter((turn) => turn.content.length > 0)
    .slice(-MAX_TURNS);
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent');
    const limit = checkRateLimit(`ai-test:${ctx.userId}`, RATE_LIMITS.aiTest);
    if (!limit.success) return rateLimitResponse(limit);

    const body = (await request.json().catch(() => null)) as {
      messages?: unknown;
    } | null;
    const turns = normalizeTurns(body?.messages);
    const latestCustomer = [...turns]
      .reverse()
      .find((turn) => turn.role === 'customer');

    if (!latestCustomer) {
      return NextResponse.json(
        { error: 'Send a customer message to test.' },
        { status: 400 }
      );
    }

    const monthStart = utcMonthStart();
    const { data: account, error: accountError } = await ctx.supabase
      .from('accounts')
      .select('monthly_ai_reply_limit')
      .eq('id', ctx.accountId)
      .single();

    if (accountError || !account) {
      console.error(
        '[ai-test/chat] account limit lookup failed:',
        accountError
      );
      return NextResponse.json(
        { error: 'Failed to verify AI usage limit.' },
        { status: 500 }
      );
    }

    const serviceRole = createServiceRoleClient();
    const reservation = await reserveAccountAiReply(
      serviceRole,
      ctx.accountId,
      monthStart,
      account.monthly_ai_reply_limit ?? 0
    );

    if (!reservation.reserved) {
      if (reservation.reason === 'reservation_error') {
        return NextResponse.json(
          {
            error:
              'AI usage check failed. Make sure the latest Supabase migrations are applied and the service role key is configured.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Monthly AI reply limit reached for this account.' },
        { status: 429 }
      );
    }

    let response: Awaited<ReturnType<typeof generateBusinessScopedChatReply>>;
    try {
      response = await generateBusinessScopedChatReply({
        supabase: ctx.supabase,
        accountId: ctx.accountId,
        turns,
      });
    } catch (error) {
      await refundAccountAiReply(serviceRole, ctx.accountId, monthStart);
      throw error;
    }

    return NextResponse.json({
      reply: response.text,
      provider: response.provider,
      model: response.model,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('[ai-test/chat] failed:', error);
    return NextResponse.json(
      {
        error:
          'AI chat test failed. Check the server logs and AI provider settings.',
      },
      { status: 500 }
    );
  }
}
