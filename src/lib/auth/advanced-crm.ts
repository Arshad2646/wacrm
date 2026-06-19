import { ForbiddenError, requireRole } from '@/lib/auth/account';
import type { AccountRole } from '@/lib/auth/roles';
import { hasAdvancedCrmToolsForAccount } from '@/lib/saas/advanced-crm';

export async function requireAdvancedCrmTools(minRole: AccountRole) {
  const ctx = await requireRole(minRole);
  const enabled = await hasAdvancedCrmToolsForAccount(
    ctx.supabase,
    ctx.accountId
  );

  if (!enabled) {
    throw new ForbiddenError(
      'Advanced CRM tools are not enabled for this account'
    );
  }

  return ctx;
}
