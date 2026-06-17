import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      paused?: unknown;
    } | null;

    if (!id) {
      return NextResponse.json(
        { error: 'Conversation id is required' },
        { status: 400 }
      );
    }

    if (typeof body?.paused !== 'boolean') {
      return NextResponse.json(
        { error: 'paused must be a boolean' },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.supabase
      .from('conversations')
      .update({
        bot_paused: body.paused,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('id, bot_paused')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation_id: data.id,
      bot_paused: data.bot_paused,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
