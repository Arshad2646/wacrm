import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import {
  createSuperAdminClient,
  requireSuperAdmin,
  SuperAdminForbiddenError,
} from '@/lib/auth/super-admin';
import {
  accountHasAdvancedCrmTools,
  ADVANCED_CRM_TOOLS_FEATURE_FLAG,
  PACKAGE_DEFAULTS,
  isPackageType,
  leadFlagsForPackage,
  resolvePackageSettings,
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

const FIELD_CLASS =
  'focus:border-primary mt-1 h-9 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-white outline-none';
const LABEL_CLASS = 'text-xs font-medium text-slate-400';
const PANEL_CLASS = 'rounded-lg border border-slate-800 bg-slate-950/55 p-3';

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

type ProductRow = {
  account_id: string;
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

function textField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createBusinessOwner(formData: FormData) {
  'use server';

  await requireSuperAdmin();

  const ownerEmail = textField(formData, 'owner_email').toLowerCase();
  const ownerName = textField(formData, 'owner_name');
  const businessName = textField(formData, 'business_name');
  const temporaryPassword = textField(formData, 'temporary_password');
  const packageTypeRaw = formData.get('package_type');

  if (!ownerEmail || !ownerEmail.includes('@')) {
    throw new Error('Owner email is required');
  }
  if (!ownerName) throw new Error('Owner name is required');
  if (!businessName) throw new Error('Business name is required');
  if (temporaryPassword.length < 8) {
    throw new Error('Temporary password must be at least 8 characters');
  }
  if (!isPackageType(packageTypeRaw)) {
    throw new Error('Invalid package type');
  }

  const packageType = packageTypeRaw;
  const packageDefaults = PACKAGE_DEFAULTS[packageType];
  const leadFlags = leadFlagsForPackage(packageType, {
    leadLiteEnabled: packageDefaults.leadLiteEnabled,
    fullLeadsEnabled: packageDefaults.fullLeadsEnabled,
  });
  const supabase = createSuperAdminClient();

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: ownerName },
    });

  if (createError || !created.user) {
    console.error('[super-admin] create owner failed:', createError);
    throw new Error(createError?.message || 'Failed to create business owner');
  }

  let accountId: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', created.user.id)
      .maybeSingle();

    if (error) {
      console.error('[super-admin] profile lookup failed:', error);
      throw new Error('Owner was created but profile lookup failed');
    }

    if (profile?.account_id) {
      accountId = profile.account_id;
      break;
    }
    await sleep(150);
  }

  if (!accountId) {
    throw new Error(
      'Owner was created but the account bootstrap trigger did not finish'
    );
  }

  const { error: accountError } = await supabase
    .from('accounts')
    .update({
      name: businessName,
      package_type: packageType,
      monthly_ai_reply_limit: packageDefaults.monthlyAiReplyLimit,
      product_limit: packageDefaults.productLimit,
      bot_enabled: true,
      lead_lite_enabled: leadFlags.leadLiteEnabled,
      full_leads_enabled: leadFlags.fullLeadsEnabled,
      feature_flags: {},
    })
    .eq('id', accountId);

  if (accountError) {
    console.error('[super-admin] created account setup failed:', accountError);
    throw new Error('Owner was created but business setup failed');
  }

  revalidatePath('/super-admin');
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
  const packageSettings = resolvePackageSettings({
    packageType,
    monthlyAiReplyLimit,
    productLimit,
    leadLiteEnabled: formData.get('lead_lite_enabled') === 'on',
    fullLeadsEnabled: formData.get('full_leads_enabled') === 'on',
    applyPackageDefaults: formData.get('apply_package_defaults') === 'on',
  });
  const featureFlags = parseFeatureFlags(formData.get('feature_flags'));
  featureFlags[ADVANCED_CRM_TOOLS_FEATURE_FLAG] =
    packageType !== 'starter' &&
    formData.get('advanced_crm_tools_enabled') === 'on';

  const supabase = createSuperAdminClient();
  const { error } = await supabase
    .from('accounts')
    .update({
      name,
      package_type: packageType,
      monthly_ai_reply_limit: packageSettings.monthlyAiReplyLimit,
      product_limit: packageSettings.productLimit,
      bot_enabled: formData.get('bot_enabled') === 'on',
      lead_lite_enabled: packageSettings.leadLiteEnabled,
      full_leads_enabled: packageSettings.fullLeadsEnabled,
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

  const [
    accountsResult,
    profilesResult,
    usageResult,
    whatsappResult,
    productsResult,
  ] = await Promise.all([
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
    supabase.from('account_products').select('account_id'),
  ]);

  if (accountsResult.error) throw accountsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (usageResult.error) throw usageResult.error;
  if (whatsappResult.error) throw whatsappResult.error;
  if (productsResult.error) throw productsResult.error;

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

  const productCountByAccount = new Map<string, number>();
  for (const product of (productsResult.data ?? []) as ProductRow[]) {
    productCountByAccount.set(
      product.account_id,
      (productCountByAccount.get(product.account_id) ?? 0) + 1
    );
  }

  return {
    monthStart,
    accounts: (accountsResult.data ?? []) as AccountRow[],
    profilesByAccount,
    usageByAccount,
    whatsappByAccount,
    productCountByAccount,
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

  const {
    accounts,
    profilesByAccount,
    usageByAccount,
    whatsappByAccount,
    productCountByAccount,
  } = await loadSuperAdminData();
  const botEnabledCount = accounts.filter(
    (account) => account.bot_enabled
  ).length;
  const connectedWhatsAppCount = Array.from(whatsappByAccount.values()).filter(
    (config) => config.status === 'connected'
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Super Admin</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Internal manual onboarding and package controls. Accounts are the SaaS
          businesses; `account_id` is the tenant key used by existing RLS.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border border-slate-800 bg-slate-900">
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold text-white">
              {accounts.length}
            </div>
            <div className="text-xs text-slate-400">Businesses</div>
          </CardContent>
        </Card>
        <Card className="border border-slate-800 bg-slate-900">
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold text-white">
              {botEnabledCount}
            </div>
            <div className="text-xs text-slate-400">Bots enabled</div>
          </CardContent>
        </Card>
        <Card className="border border-slate-800 bg-slate-900">
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold text-white">
              {connectedWhatsAppCount}
            </div>
            <div className="text-xs text-slate-400">WhatsApp connected</div>
          </CardContent>
        </Card>
        <Card className="border border-amber-500/30 bg-amber-500/10">
          <CardContent className="pt-4">
            <div className="text-sm font-semibold text-amber-100">
              Operator access active
            </div>
            <div className="text-xs text-amber-200/80">
              Verified by `SUPER_ADMIN_EMAILS`
            </div>
          </CardContent>
        </Card>
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
          <CardTitle>Create Business Owner</CardTitle>
          <CardDescription>
            Creates a Supabase Auth user, lets the signup trigger create their
            account, then applies the selected SaaS package defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createBusinessOwner}
            className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
          >
            <label className="text-xs font-medium text-slate-400">
              Owner email
              <input
                name="owner_email"
                type="email"
                required
                className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              />
            </label>
            <label className="text-xs font-medium text-slate-400">
              Owner name
              <input
                name="owner_name"
                required
                className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              />
            </label>
            <label className="text-xs font-medium text-slate-400">
              Business name
              <input
                name="business_name"
                required
                className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              />
            </label>
            <label className="text-xs font-medium text-slate-400">
              Temporary password
              <input
                name="temporary_password"
                type="password"
                minLength={8}
                required
                className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              />
            </label>
            <div className="grid gap-2 lg:min-w-44">
              <label className="text-xs font-medium text-slate-400">
                Package
                <select
                  name="package_type"
                  defaultValue="starter"
                  className="focus:border-primary mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                >
                  <option value="starter">Starter Bot</option>
                  <option value="growth">Growth Bot + Leads</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-lg px-3 text-sm font-medium"
              >
                Create
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Businesses</CardTitle>
          <CardDescription>
            Sensitive WhatsApp tokens are intentionally not shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-6 text-sm text-slate-400">
              No businesses have been created yet.
            </div>
          )}

          {accounts.map((account) => {
            const members = profilesByAccount.get(account.id) ?? [];
            const owner = members.find(
              (member) => member.user_id === account.owner_user_id
            );
            const usage = usageByAccount.get(account.id)?.ai_replies_used ?? 0;
            const productCount = productCountByAccount.get(account.id) ?? 0;
            const whatsapp = whatsappByAccount.get(account.id);
            const featureFlags = JSON.stringify(
              account.feature_flags ?? {},
              null,
              2
            );
            const advancedCrmEnabled = accountHasAdvancedCrmTools(account);
            const defaults = PACKAGE_DEFAULTS[account.package_type];

            return (
              <form
                key={account.id}
                action={updateAccountSettings}
                className="rounded-xl border border-slate-800 bg-slate-950/45 p-4 shadow-sm shadow-slate-950/20 md:p-5"
              >
                <input type="hidden" name="account_id" value={account.id} />

                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-white">
                        {account.name}
                      </h3>
                      <Badge
                        variant={packageBadgeVariant(account.package_type)}
                      >
                        {account.package_type}
                      </Badge>
                      {account.bot_enabled ? (
                        <Badge variant="outline" className="text-emerald-300">
                          Bot on
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Bot off</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="break-all">ID: {account.id}</span>
                      <span>
                        Owner: {owner?.email ?? owner?.full_name ?? 'Unknown'}
                      </span>
                      <span>Members: {members.length}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 shrink-0 rounded-lg px-4 text-sm font-medium"
                  >
                    Save changes
                  </button>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)_minmax(320px,0.9fr)]">
                  <section className={PANEL_CLASS}>
                    <div className="mb-3 text-sm font-medium text-white">
                      Business and package
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className={LABEL_CLASS}>
                        Business name
                        <input
                          name="name"
                          defaultValue={account.name}
                          className={FIELD_CLASS}
                        />
                      </label>

                      <label className={LABEL_CLASS}>
                        Package
                        <select
                          name="package_type"
                          defaultValue={account.package_type}
                          className={FIELD_CLASS}
                        >
                          <option value="starter">Starter Bot</option>
                          <option value="growth">Growth Bot + Leads</option>
                          <option value="custom">Custom</option>
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-400">
                      <input
                        type="checkbox"
                        name="apply_package_defaults"
                        defaultChecked
                        className="mt-1"
                      />
                      <span>
                        Apply selected package defaults on save. Current
                        defaults: {defaults.monthlyAiReplyLimit} replies,{' '}
                        {defaults.productLimit} products/services. Custom stays
                        manual.
                      </span>
                    </label>
                  </section>

                  <section className={PANEL_CLASS}>
                    <div className="mb-3 text-sm font-medium text-white">
                      Usage
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {usage} / {account.monthly_ai_reply_limit}
                        </div>
                        <div className="text-xs text-slate-500">
                          AI replies this month
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {productCount} / {account.product_limit}
                        </div>
                        <div className="text-xs text-slate-500">
                          Products/services
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={PANEL_CLASS}>
                    <div className="mb-3 text-sm font-medium text-white">
                      WhatsApp
                    </div>
                    {whatsapp ? (
                      <div className="space-y-1 text-sm">
                        <div className="text-white">{whatsapp.status}</div>
                        <div className="text-xs break-all text-slate-400">
                          Phone ID: {whatsapp.phone_number_id}
                        </div>
                        <div className="text-xs break-all text-slate-400">
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
                  </section>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
                  <section className={PANEL_CLASS}>
                    <div className="mb-3 text-sm font-medium text-white">
                      Limits
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={LABEL_CLASS}>
                        Reply limit
                        <input
                          type="number"
                          min={0}
                          name="monthly_ai_reply_limit"
                          defaultValue={account.monthly_ai_reply_limit}
                          className={FIELD_CLASS}
                        />
                      </label>
                      <label className={LABEL_CLASS}>
                        Product limit
                        <input
                          type="number"
                          min={0}
                          name="product_limit"
                          defaultValue={account.product_limit}
                          className={FIELD_CLASS}
                        />
                      </label>
                    </div>
                  </section>

                  <section className={PANEL_CLASS}>
                    <div className="mb-3 text-sm font-medium text-white">
                      Feature gates
                    </div>
                    <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="bot_enabled"
                          defaultChecked={account.bot_enabled}
                        />
                        Bot enabled
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="lead_lite_enabled"
                          defaultChecked={account.lead_lite_enabled}
                        />
                        Lead Lite enabled
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="full_leads_enabled"
                          defaultChecked={account.full_leads_enabled}
                        />
                        Full Leads enabled
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          name="advanced_crm_tools_enabled"
                          defaultChecked={advancedCrmEnabled}
                          disabled={account.package_type === 'starter'}
                          className="mt-1"
                        />
                        <span>
                          Show Advanced CRM tools
                          <span className="block text-xs text-slate-500">
                            Contacts, pipelines, broadcasts, automations, and
                            flows. Starter accounts cannot access these.
                          </span>
                        </span>
                      </label>
                    </div>
                  </section>
                </div>

                <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-400">
                    Feature flags JSON
                  </summary>
                  <div className="border-t border-slate-800 p-3">
                    <textarea
                      name="feature_flags"
                      defaultValue={featureFlags}
                      rows={4}
                      className="focus:border-primary w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-xs text-white outline-none"
                    />
                  </div>
                </details>
              </form>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
