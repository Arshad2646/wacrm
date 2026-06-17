import { describe, expect, it } from 'vitest';

import {
  decideAiReply,
  isAiUsageLimitReached,
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
