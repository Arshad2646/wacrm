import type { SupabaseClient } from '@supabase/supabase-js';

import { isPackageType } from '@/lib/saas/packages';
import type {
  AccountProduct,
  BusinessKnowledgeBundle,
  BusinessProfile,
  KnowledgeEntry,
} from './types';

export async function loadBusinessKnowledge(
  supabase: SupabaseClient,
  accountId: string
): Promise<BusinessKnowledgeBundle> {
  const [accountResult, profileResult, productsResult, knowledgeResult] =
    await Promise.all([
      supabase
        .from('accounts')
        .select(
          'id, name, package_type, monthly_ai_reply_limit, product_limit, bot_enabled, lead_lite_enabled, full_leads_enabled'
        )
        .eq('id', accountId)
        .single(),
      supabase
        .from('account_business_profiles')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle(),
      supabase
        .from('account_products')
        .select('*')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('account_knowledge_entries')
        .select('*')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

  if (accountResult.error) throw accountResult.error;
  if (profileResult.error) throw profileResult.error;
  if (productsResult.error) throw productsResult.error;
  if (knowledgeResult.error) throw knowledgeResult.error;

  const accountRow = accountResult.data;
  const packageType = isPackageType(accountRow.package_type)
    ? accountRow.package_type
    : 'starter';

  return {
    account: {
      id: accountRow.id,
      name: accountRow.name,
      package_type: packageType,
      monthly_ai_reply_limit: accountRow.monthly_ai_reply_limit ?? 1500,
      product_limit: accountRow.product_limit ?? 20,
      bot_enabled: accountRow.bot_enabled ?? true,
      lead_lite_enabled: accountRow.lead_lite_enabled ?? true,
      full_leads_enabled: accountRow.full_leads_enabled ?? false,
    },
    profile: (profileResult.data ?? null) as BusinessProfile | null,
    activeProducts: (productsResult.data ?? []) as AccountProduct[],
    activeKnowledgeEntries: (knowledgeResult.data ?? []) as KnowledgeEntry[],
  };
}
