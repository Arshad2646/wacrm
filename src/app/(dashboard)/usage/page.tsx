import { BarChart3, Bot, CheckCircle2, Package, PlugZap } from 'lucide-react';

import { getCurrentAccount } from '@/lib/auth/account';
import { accountHasFullLeads } from '@/lib/saas/packages';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function currentUtcMonthStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-01`;
}

function percent(used: number, limit: number) {
  if (limit <= 0) return 100;
  return Math.min(Math.round((used / limit) * 100), 100);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div
        className="bg-primary h-full rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default async function UsagePage() {
  const ctx = await getCurrentAccount();
  const monthStart = currentUtcMonthStart();

  const [
    accountResult,
    usageResult,
    productsResult,
    knowledgeResult,
    waResult,
  ] = await Promise.all([
    ctx.supabase
      .from('accounts')
      .select(
        'package_type, monthly_ai_reply_limit, product_limit, bot_enabled, lead_lite_enabled, full_leads_enabled'
      )
      .eq('id', ctx.accountId)
      .single(),
    ctx.supabase
      .from('account_ai_usage_months')
      .select('ai_replies_used')
      .eq('account_id', ctx.accountId)
      .eq('month_start', monthStart)
      .maybeSingle(),
    ctx.supabase
      .from('account_products')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId),
    ctx.supabase
      .from('account_knowledge_entries')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId)
      .eq('is_active', true),
    ctx.supabase
      .from('whatsapp_config')
      .select('status, phone_number_id, registered_at, subscribed_apps_at')
      .eq('account_id', ctx.accountId)
      .maybeSingle(),
  ]);

  if (accountResult.error) throw accountResult.error;
  if (usageResult.error) throw usageResult.error;
  if (productsResult.error) throw productsResult.error;
  if (knowledgeResult.error) throw knowledgeResult.error;
  if (waResult.error) throw waResult.error;

  const account = accountResult.data;
  const repliesUsed = usageResult.data?.ai_replies_used ?? 0;
  const replyLimit = account.monthly_ai_reply_limit;
  const productCount = productsResult.count ?? 0;
  const knowledgeCount = knowledgeResult.count ?? 0;
  const whatsapp = waResult.data;
  const usagePercent = percent(repliesUsed, replyLimit);
  const productPercent = percent(productCount, account.product_limit);
  const fullLeads = accountHasFullLeads(account);
  const leadMode = fullLeads
    ? 'Full Leads'
    : account.lead_lite_enabled
      ? 'Lead Lite'
      : 'Off';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usage</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track this month&apos;s bot replies, catalog limit, and account
            readiness.
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {account.package_type} package
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Replies</CardTitle>
            <BarChart3 className="size-4 text-slate-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold text-white">
              {repliesUsed} / {replyLimit}
            </div>
            <ProgressBar value={usagePercent} />
            <p className="text-xs text-slate-500">Current UTC month</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Products & Services
            </CardTitle>
            <Package className="size-4 text-slate-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold text-white">
              {productCount} / {account.product_limit}
            </div>
            <ProgressBar value={productPercent} />
            <p className="text-xs text-slate-500">Package catalog limit</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            <Bot className="size-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {account.bot_enabled ? 'On' : 'Off'}
            </div>
            <p className="mt-2 text-xs text-slate-500">Lead mode: {leadMode}</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
            <PlugZap className="size-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {whatsapp?.status === 'connected' ? 'Connected' : 'Not ready'}
            </div>
            <p className="mt-2 truncate text-xs text-slate-500">
              {whatsapp?.phone_number_id
                ? `Phone ID ${whatsapp.phone_number_id}`
                : 'Add WhatsApp settings before live testing'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Readiness</CardTitle>
          <CardDescription>
            Quick checks before allowing customers to message the bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            {knowledgeCount} active FAQ / knowledge entries
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            Package controls: {leadMode}, {replyLimit} replies/month
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            WhatsApp registration:{' '}
            {whatsapp?.registered_at ? 'registered' : 'not confirmed'}
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            WABA webhook subscription:{' '}
            {whatsapp?.subscribed_apps_at ? 'confirmed' : 'not confirmed'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
