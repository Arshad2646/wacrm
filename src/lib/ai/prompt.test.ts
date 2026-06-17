import { describe, expect, it } from 'vitest';

import {
  buildBusinessScopedConversationPrompt,
  buildBusinessScopedPrompt,
} from './prompt';
import type { BusinessKnowledgeBundle } from '@/lib/knowledge/types';

const bundle: BusinessKnowledgeBundle = {
  account: {
    id: 'account-1',
    name: 'MmaTech Gadgets',
    package_type: 'starter',
    monthly_ai_reply_limit: 1500,
    product_limit: 20,
    bot_enabled: true,
    lead_lite_enabled: true,
    full_leads_enabled: false,
  },
  profile: {
    account_id: 'account-1',
    business_description: 'Electronics shop in Gaborone',
    location: 'Main Mall, Gaborone',
    opening_hours: 'Mon-Sat 8:00-18:00',
    services_summary: 'Projectors, phones, repairs',
    delivery_info: 'Delivery in Gaborone for P50',
    payment_info: 'Cash or bank transfer',
    order_instructions: 'Send product name and delivery area',
    fallback_message: 'Our team will confirm shortly.',
    bot_tone: 'friendly',
    created_at: '2026-06-16T00:00:00Z',
    updated_at: '2026-06-16T00:00:00Z',
  },
  activeProducts: [
    {
      id: 'product-1',
      account_id: 'account-1',
      name: 'Game Projector',
      price_text: 'P1199',
      description: 'Portable projector for home entertainment',
      availability_text: 'In stock',
      category: 'Projectors',
      is_active: true,
      created_at: '2026-06-16T00:00:00Z',
      updated_at: '2026-06-16T00:00:00Z',
    },
  ],
  activeKnowledgeEntries: [
    {
      id: 'knowledge-1',
      account_id: 'account-1',
      title: 'Warranty',
      content: 'Projectors have a 6 month warranty.',
      category: 'Policy',
      is_active: true,
      created_at: '2026-06-16T00:00:00Z',
      updated_at: '2026-06-16T00:00:00Z',
    },
  ],
};

describe('buildBusinessScopedPrompt', () => {
  it('includes account knowledge and strict refusal rules', () => {
    const prompt = buildBusinessScopedPrompt(
      bundle,
      'How much is the projector and what is the capital of France?'
    );

    expect(prompt.user).toContain('capital of France');
    expect(prompt.system).toContain('MmaTech Gadgets');
    expect(prompt.system).toContain('Game Projector');
    expect(prompt.system).toContain('P1199');
    expect(prompt.system).toContain('Projectors have a 6 month warranty');
    expect(prompt.system).toContain('Do not answer general knowledge');
    expect(prompt.system).toContain('mixed question');
    expect(prompt.system).toContain('do not guess');
    expect(prompt.system).toContain('buying intent');
  });
});

describe('buildBusinessScopedConversationPrompt', () => {
  it('includes recent transcript while keeping the business-scoped system prompt', () => {
    const prompt = buildBusinessScopedConversationPrompt(bundle, [
      { role: 'customer', content: 'Hi, do you sell projectors?' },
      { role: 'assistant', content: 'Yes, we have a Game Projector.' },
      { role: 'customer', content: 'Can you deliver it to Gaborone?' },
    ]);

    expect(prompt.system).toContain('MmaTech Gadgets');
    expect(prompt.system).toContain('Do not answer general knowledge');
    expect(prompt.user).toContain('Conversation so far');
    expect(prompt.user).toContain('Customer: Hi, do you sell projectors?');
    expect(prompt.user).toContain('Assistant: Yes, we have a Game Projector.');
    expect(prompt.user).toContain('latest customer message');
  });
});
