import type { PackageType } from '@/lib/saas/packages';

export type BotTone = 'friendly' | 'professional' | 'salesy';

export interface BusinessProfile {
  account_id: string;
  business_description: string | null;
  location: string | null;
  opening_hours: string | null;
  services_summary: string | null;
  delivery_info: string | null;
  payment_info: string | null;
  order_instructions: string | null;
  fallback_message: string;
  bot_tone: BotTone;
  created_at: string;
  updated_at: string;
}

export interface AccountProduct {
  id: string;
  account_id: string;
  name: string;
  price_text: string | null;
  description: string | null;
  availability_text: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntry {
  id: string;
  account_id: string;
  title: string;
  content: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessKnowledgeBundle {
  account: {
    id: string;
    name: string;
    package_type: PackageType;
    monthly_ai_reply_limit: number;
    product_limit: number;
    bot_enabled: boolean;
    lead_lite_enabled: boolean;
    full_leads_enabled: boolean;
  };
  profile: BusinessProfile | null;
  activeProducts: AccountProduct[];
  activeKnowledgeEntries: KnowledgeEntry[];
}
