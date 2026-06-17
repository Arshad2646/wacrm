import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import {
  createSuperAdminClient,
  requireSuperAdmin,
  SuperAdminForbiddenError,
} from '@/lib/auth/super-admin';
import {
  PACKAGE_DEFAULTS,
  isPackageType,
  leadFlagsForPackage,
  type PackageType,
} from '@/lib/saas/packages';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AccountRow = {
  id: string;
  name: string;
  owner_user_id: string;
  package_type: PackageType;
  monthly_ai_reply_limit: number;
  product_limit: number;
  bot_enabled: boolean;
  full_leads_enabled: boolean;
  lead_lite_enabled: boolean;
  feature_flags: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  account_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  account_role: string;
};

type UsageRow = {
  account_id: string;
  ai_replies_used: number;
};

type WhatsAppConfigRow = {
  account_id: string;
  phone_number_id: string;
  waba_id: string | null;
  status: string;
  registered_at: string | null;
  subscribed_apps_at: string | null;
  last_registration_error: string | null;
};

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function asNonNegativeInt(value: FormDataEntryValue | null, field: string) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative whole number`);
  }
  return parsed;
}

function parseFeatureFlags(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Feature flags must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function updateAccountSettings(formData: FormData) {
  'use server';

  await requireSuperAdmin();

  const accountId = String(formData.get('account_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const packageTypeRaw = formData.get('package_type');

  if (!accountId) throw new Error('Missing account id');
  if (!name) throw new Error('Business name is required');
  if (!isPackageType(packageTypeRaw)) {
    throw new Error('Invalid package type');
  }

  const packageType = packageTypeRaw;
  const monthlyAiReplyLimit = asNonNegativeInt(
    formData.get('monthly_ai_reply_limit'),
    'Monthly AI reply limit'
  );
  const productLimit = asNonNegativeInt(
    formData.get('product_limit'),
    'Product limit'
  );
  const manualLeadFlags = {
    leadLiteEnabled: formData.get('lead_lite_enabled') === 'on',
    fullLeadsEnabled: formData.get('full_leads_enabled') === 'on',
  };
  const leadFlags = leadFlagsForPackage(packageType, manualLeadFlags);
  const featureFlags = parseFeatureFlags(formData.get('feature_flags'));

  const supabase = createSuperAdminClient();
  const { error } = await supabase
    .from('accounts')
    .update({
      name,
      package_type: packageType,
      monthly_ai_reply_limit: monthlyAiReplyLimit,
      product_limit: productLimit,
      bot_enabled: formData.get('bot_enabled') === 'on',
      lead_lite_enabled: leadFlags.leadLiteEnabled,
      full_leads_enabled: leadFlags.fullLeadsEnabled,
      feature_flags: featureFlags,
    })
    .eq('id', accountId);

  if (error) {
    console.error('[super-admin] account update failed:', error);
    throw new Error('Failed to update business settings');
  }

  revalidatePath('/super-admin');
}

async function loadSuperAdminData() {
  const supabase = createSuperAdminClient();
  const monthStart = currentMonthStart();

  const [accountsResult, profilesResult, usageResult, whatsappResult] =
    await Promise.all([
      supabase
        .from('accounts')
        .select(
          'id, name, owner_user_id, package_type, monthly_ai_reply_limit, product_limit, bot_enabled, full_leads_enabled, lead_lite_enabled, feature_flags, created_at, updated_at'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('account_id, user_id, full_name, email, account_role'),
      supabase
        .from('account_ai_usage_months')
        .select('account_id, ai_replies_used')
        .eq('month_start', monthStart),
      supabase
        .from('whatsapp_config')
        .select(
          'account_id, phone_number_id, waba_id, status, registered_at, subscribed_apps_at, last_registration_error'
        ),
    ]);

  if (accountsResult.error) throw accountsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (usageResult.error) throw usageResult.error;
  if (whatsappResult.error) throw whatsappResult.error;

  const profilesByAccount = new Map<string, ProfileRow[]>();
  for (const profile of (profilesResult.data ?? []) as ProfileRow[]) {
    const existing = profilesByAccount.get(profile.account_id) ?? [];
    existing.push(profile);
    profilesByAccount.set(profile.account_id, existing);
  }

  const usageByAccount = new Map<string, UsageRow>();
  for (const usage of (usageResult.data ?? []) as UsageRow[]) {
    usageByAccount.set(usage.account_id, usage);
  }

  const whatsappByAccount = new Map<string, WhatsAppConfigRow>();
  for (const config of (whatsappResult.data ?? []) as WhatsAppConfigRow[]) {
    whatsappByAccount.set(config.account_id, config);
  }

  return {
    monthStart,
    accounts: (accountsResult.data ?? []) as AccountRow[],
    profilesByAccount,
    usageByAccount,
    whatsappByAccount,
  };
}

function packageBadgeVariant(packageType: PackageType) {
  if (packageType === 'growth') return 'default' as const;
  if (packageType === 'custom') return 'outline' as const;
  return 'secondary' as const;
}

export default async function SuperAdminPage() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof SuperAdminForbiddenError) notFound();
    throw err;
  }

  const { accounts, profilesByAccount, usageByAccount, whatsappByAccount } =
    await loadSuperAdminData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Super Admin</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Internal manual onboarding and package controls. Accounts are the SaaS
          businesses; `account_id` is the tenant key used by existing RLS.
        </p>
      </div>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Manual Onboarding Model</CardTitle>
          <CardDescription>
            Have the business owner sign up or create their Supabase Auth user,
            then configure the resulting account here. This keeps the existing
            one-account-per-owner tenancy intact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div>
              <div className="font-medium text-white">Starter defaults</div>
              <div>1500 replies/month, 20 products, Lead Lite only.</div>
            </div>
            <div>
              <div className="font-medium text-white">Growth defaults</div>
              <div>5000 replies/month, 100 products, Full Leads.</div>
            </div>
            <div>
              <div className="font-medium text-white">Custom</div>
              <div>Manual limits and feature flags.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Businesses</CardTitle>
          <CardDescription>
            Sensitive WhatsApp tokens are intentionally not shown here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Limits and flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const members = profilesByAccount.get(account.id) ?? [];
                const owner = members.find(
                  (member) => member.user_id === account.owner_user_id
                );
                const usage =
                  usageByAccount.get(account.id)?.ai_replies_used ?? 0;
                const whatsapp = whatsappByAccount.get(account.id);
                const featureFlags = JSON.stringify(
                  account.feature_flags ?? {},
                  null,
                  2
                );
                const formId = `account-settings-${account.id}`;

                return (
                  <TableRow key={account.id} className="align-top">
                    <TableCell className="min-w-64 whitespace-normal">
                      <form id={formId} action={updateAccountSettings}>
                        <input
                          type="hidden"
                          name="account_id"
                          value={account.id}
                        />
                      </form>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-slate-400">
                            Name
                          </label>
                          <input
                            form={formId}
                            name="name"
                            defaultValue={account.name}
                            className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                          />
                        </div>
                        <div className="space-y-1 text-xs text-slate-400">
                          <div>ID: {account.id}</div>
                          <div>
                            Owner:{' '}
                            {owner?.email ?? owner?.full_name ?? 'Unknown'}
                          </div>
                          <div>Members: {members.length}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-3">
                        <Badge
                          variant={packageBadgeVariant(account.package_type)}
                        >
                          {account.package_type}
                        </Badge>
                        <select
                          form={formId}
                          name="package_type"
                          defaultValue={account.package_type}
                          className="focus:border-primary h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                        >
                          <option value="starter">Starter Bot</option>
                          <option value="growth">Growth Bot + Leads</option>
                          <option value="custom">Custom</option>
                        </select>
                        <div className="text-xs text-slate-500">
                          Defaults:{' '}
                          {
                            PACKAGE_DEFAULTS[account.package_type]
                              .monthlyAiReplyLimit
                          }{' '}
                          replies,{' '}
                          {PACKAGE_DEFAULTS[account.package_type].productLimit}{' '}
                          products.
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm text-white">
                          {usage} / {account.monthly_ai_reply_limit}
                        </div>
                        <div className="text-xs text-slate-400">
                          AI replies this month
                        </div>
                        <div className="text-xs text-slate-500">
                          Product count arrives with Phase 3 product tables.
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-52 whitespace-normal">
                      {whatsapp ? (
                        <div className="space-y-1 text-sm">
                          <div className="text-white">{whatsapp.status}</div>
                          <div className="text-xs text-slate-400">
                            Phone ID: {whatsapp.phone_number_id}
                          </div>
                          <div className="text-xs text-slate-400">
                            WABA: {whatsapp.waba_id ?? 'Not set'}
                          </div>
                          {whatsapp.last_registration_error && (
                            <div className="text-xs text-red-300">
                              {whatsapp.last_registration_error}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">
                          Not configured
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-80 whitespace-normal">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-400">
                          Reply limit
                          <input
                            form={formId}
                            type="number"
                            min={0}
                            name="monthly_ai_reply_limit"
                            defaultValue={account.monthly_ai_reply_limit}
                            className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-400">
                          Product limit
                          <input
                            form={formId}
                            type="number"
                            min={0}
                            name="product_limit"
                            defaultValue={account.product_limit}
                            className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                          />
                        </label>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        <label className="flex items-center gap-2">
                          <input
                            form={formId}
                            type="checkbox"
                            name="bot_enabled"
                            defaultChecked={account.bot_enabled}
                          />
                          Bot enabled
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            form={formId}
                            type="checkbox"
                            name="lead_lite_enabled"
                            defaultChecked={account.lead_lite_enabled}
                          />
                          Lead Lite enabled
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            form={formId}
                            type="checkbox"
                            name="full_leads_enabled"
                            defaultChecked={account.full_leads_enabled}
                          />
                          Full Leads enabled
                        </label>
                      </div>
                      <label className="mt-3 block text-xs font-medium text-slate-400">
                        Feature flags JSON
                        <textarea
                          form={formId}
                          name="feature_flags"
                          defaultValue={featureFlags}
                          rows={4}
                          className="focus:border-primary mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-xs text-white outline-none"
                        />
                      </label>
                      <button
                        form={formId}
                        type="submit"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 h-8 rounded-lg px-3 text-sm font-medium"
                      >
                        Save
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
