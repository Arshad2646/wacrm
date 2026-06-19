import type { SupabaseClient } from '@supabase/supabase-js';

import {
  accountHasAdvancedCrmTools,
  type AccountFeatureGateInput,
} from '@/lib/saas/packages';

type AdvancedCrmAccountRow = Required<
  Pick<AccountFeatureGateInput, 'package_type' | 'feature_flags'>
>;

export async function hasAdvancedCrmToolsForAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('accounts')
    .select('package_type, feature_flags')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('[advanced-crm] feature lookup failed:', error.message);
    }
    return false;
  }

  return accountHasAdvancedCrmTools(data as AdvancedCrmAccountRow);
}
