import { describe, expect, it } from 'vitest';

import { detectBuyingIntent, shouldUseFullLeads } from './detect';

describe('detectBuyingIntent', () => {
  it('detects buying intent and product interest from product names', () => {
    const intent = detectBuyingIntent('How much is the Game Projector?', [
      { name: 'Game Projector', category: 'Projectors' },
      { name: 'Samsung A55 screen', category: 'Repairs' },
    ]);

    expect(intent.hasIntent).toBe(true);
    expect(intent.productInterest).toBe('Game Projector');
    expect(intent.matchedSignals).toContain('price');
  });

  it('detects delivery/payment follow-up even without a product match', () => {
    const intent = detectBuyingIntent(
      'Can you deliver to Gaborone and how do I pay?'
    );

    expect(intent.hasIntent).toBe(true);
    expect(intent.productInterest).toBeNull();
    expect(intent.matchedSignals).toContain('delivery');
    expect(intent.matchedSignals).toContain('payment');
  });
});

describe('shouldUseFullLeads', () => {
  it('keeps Starter on Lead Lite only', () => {
    expect(
      shouldUseFullLeads({
        package_type: 'starter',
        full_leads_enabled: true,
      })
    ).toBe(false);
  });

  it('enables Full Leads for Growth and manually enabled Custom accounts', () => {
    expect(
      shouldUseFullLeads({
        package_type: 'growth',
        full_leads_enabled: false,
      })
    ).toBe(true);
    expect(
      shouldUseFullLeads({
        package_type: 'custom',
        full_leads_enabled: true,
      })
    ).toBe(true);
  });
});
