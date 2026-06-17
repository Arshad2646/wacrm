import { NextResponse } from 'next/server';

import {
  UnauthorizedError,
  ForbiddenError,
  getCurrentAccount,
} from '@/lib/auth/account';
import { generateBusinessScopedChatReply } from '@/lib/ai/chatbot';
import type { ConversationTurn } from '@/lib/ai/prompt';

type IncomingTurn = {
  role?: unknown;
  content?: unknown;
};

function normalizeTurns(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((turn: IncomingTurn) => {
      const role: ConversationTurn['role'] =
        turn.role === 'assistant' ? 'assistant' : 'customer';
      const content =
        typeof turn.content === 'string' ? turn.content.trim() : '';
      return { role, content };
    })
    .filter((turn) => turn.content.length > 0)
    .slice(-12);
}

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
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

    const response = await generateBusinessScopedChatReply({
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      turns,
    });

    return NextResponse.json({
      reply: response.text,
      provider: response.provider,
      model: response.model,
      systemPrompt: response.systemPrompt,
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
        error: error instanceof Error ? error.message : 'AI chat test failed.',
      },
      { status: 500 }
    );
  }
}
