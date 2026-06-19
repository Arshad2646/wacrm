import { describe, expect, it } from 'vitest';

import {
  decideAiReply,
  isAiUsageLimitReached,
  reserveAccountAiReply,
  utcMonthStart,
} from './whatsapp-bot';

describe('isAiUsageLimitReached', () => {
  it('blocks AI calls when the monthly limit is reached or zero', () => {
    expect(isAiUsageLimitReached(1500, 1500)).toBe(true);
    expect(isAiUsageLimitReached(0, 0)).toBe(true);
    expect(isAiUsageLimitReached(1499, 1500)).toBe(false);
  });
});

describe('decideAiReply', () => {
  it('blocks AI calls when bot is disabled', () => {
    expect(
      decideAiReply({
        hasCustomerText: true,
        botEnabled: false,
        conversationBotPaused: false,
        repliesUsed: 0,
        monthlyLimit: 1500,
      })
    ).toEqual({
      shouldCallAi: false,
      shouldSendFallback: false,
      reason: 'bot_disabled',
    });
  });

  it('blocks AI calls and sends fallback when usage limit is reached', () => {
    expect(
      decideAiReply({
        hasCustomerText: true,
        botEnabled: true,
        conversationBotPaused: false,
        repliesUsed: 5000,
        monthlyLimit: 5000,
      })
    ).toEqual({
      shouldCallAi: false,
      shouldSendFallback: true,
      reason: 'usage_limit_reached',
    });
  });

  it('blocks AI calls when the conversation is paused for a human', () => {
    expect(
      decideAiReply({
        hasCustomerText: true,
        botEnabled: true,
        conversationBotPaused: true,
        repliesUsed: 0,
        monthlyLimit: 1500,
      })
    ).toEqual({
      shouldCallAi: false,
      shouldSendFallback: false,
      reason: 'conversation_paused',
    });
  });

  it('allows AI when text, bot, conversation, and usage checks pass', () => {
    expect(
      decideAiReply({
        hasCustomerText: true,
        botEnabled: true,
        conversationBotPaused: false,
        repliesUsed: 12,
        monthlyLimit: 1500,
      })
    ).toEqual({
      shouldCallAi: true,
      shouldSendFallback: false,
      reason: null,
    });
  });
});

describe('utcMonthStart', () => {
  it('returns the first day of the UTC month', () => {
    expect(utcMonthStart(new Date('2026-06-16T22:30:00Z'))).toBe('2026-06-01');
  });
});

describe('reserveAccountAiReply', () => {
  it('distinguishes a real limit block from an RPC/setup failure', async () => {
    const rpcCalls: unknown[] = [];
    const supabase = {
      rpc: async (_name: string, args: unknown) => {
        rpcCalls.push(args);
        return { data: false, error: null };
      },
    };

    await expect(
      reserveAccountAiReply(
        supabase as never,
        '00000000-0000-0000-0000-000000000001',
        '2026-06-01',
        5000
      )
    ).resolves.toEqual({ reserved: false, reason: 'limit_reached' });
    expect(rpcCalls).toHaveLength(1);

    const failingSupabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'function reserve_account_ai_reply does not exist' },
      }),
    };

    await expect(
      reserveAccountAiReply(
        failingSupabase as never,
        '00000000-0000-0000-0000-000000000001',
        '2026-06-01',
        5000
      )
    ).resolves.toEqual({ reserved: false, reason: 'reservation_error' });
  });
});
