import type { AccountProduct } from '@/lib/knowledge/types';
import {
  accountHasFullLeads,
  type AccountFeatureGateInput,
} from '@/lib/saas/packages';

export interface LeadIntent {
  hasIntent: boolean;
  productInterest: string | null;
  notes: string | null;
  matchedSignals: string[];
}

const SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'price', pattern: /\b(price|cost|how much|quote|quotation)\b/i },
  {
    label: 'availability',
    pattern: /\b(available|availability|in stock|stock|do you have)\b/i,
  },
  {
    label: 'buy/order/book',
    pattern: /\b(buy|order|book|reserve|take it|i want|i need|interested)\b/i,
  },
  {
    label: 'delivery',
    pattern: /\b(deliver|delivery|send|courier|ship|drop off)\b/i,
  },
  {
    label: 'payment',
    pattern:
      /\b(pay|payment|deposit|cash|transfer|swipe|collection|collect)\b/i,
  },
  {
    label: 'human follow-up',
    pattern: /\b(call me|contact me|speak to|talk to|whatsapp me|assist me)\b/i,
  },
  {
    label: 'customer details',
    pattern: /\b(my name is|i am in|i'm in|location|address|budget|phone)\b/i,
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function includesMeaningfulName(text: string, name: string): boolean {
  const normalizedName = normalize(name);
  if (!normalizedName) return false;
  if (text.includes(normalizedName)) return true;

  const tokens = normalizedName.split(' ').filter((token) => token.length >= 4);
  return tokens.length > 0 && tokens.every((token) => text.includes(token));
}

export function detectBuyingIntent(
  customerMessage: string,
  products: Pick<AccountProduct, 'name' | 'category'>[] = []
): LeadIntent {
  const text = customerMessage.trim();
  if (!text) {
    return {
      hasIntent: false,
      productInterest: null,
      notes: null,
      matchedSignals: [],
    };
  }

  const matchedSignals = SIGNALS.filter((signal) =>
    signal.pattern.test(text)
  ).map((signal) => signal.label);
  const normalizedText = normalize(text);
  const product = products.find((candidate) => {
    if (includesMeaningfulName(normalizedText, candidate.name)) return true;
    return candidate.category
      ? includesMeaningfulName(normalizedText, candidate.category)
      : false;
  });
  const hasIntent = matchedSignals.length > 0 || !!product;

  return {
    hasIntent,
    productInterest: product?.name ?? null,
    notes: hasIntent
      ? `Detected intent signals: ${matchedSignals.join(', ') || 'product mention'}`
      : null,
    matchedSignals,
  };
}

export function shouldUseFullLeads(account: AccountFeatureGateInput): boolean {
  return accountHasFullLeads(account);
}
