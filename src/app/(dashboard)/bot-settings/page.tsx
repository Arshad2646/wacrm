import { revalidatePath } from 'next/cache';
import {
  BarChart3,
  Bot,
  MessageSquare,
  Package,
  PauseCircle,
  Power,
} from 'lucide-react';

import { getCurrentAccount, requireRole } from '@/lib/auth/account';
import { canManageAccountBot } from '@/lib/auth/roles';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

async function updateAccountBot(formData: FormData) {
  'use server';

  const ctx = await requireRole('admin');
  const rawValue = formData.get('bot_enabled');
  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new Error('Invalid bot status');
  }

  const { error } = await createServiceRoleClient()
    .from('accounts')
    .update({
      bot_enabled: rawValue === 'true',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.accountId);

  if (error) throw error;

  revalidatePath('/bot-settings');
  revalidatePath('/usage');
}

export default async function BotSettingsPage() {
  const ctx = await getCurrentAccount();
  const monthStart = currentUtcMonthStart();
  const canManageBot = canManageAccountBot(ctx.role);

  const [accountResult, usageResult, productsResult, handoffResult] =
    await Promise.all([
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
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', ctx.accountId)
        .or(
          'bot_paused.eq.true,lead_intent_detected.eq.true,unread_count.gt.0'
        ),
    ]);

  if (accountResult.error) throw accountResult.error;
  if (usageResult.error) throw usageResult.error;
  if (productsResult.error) throw productsResult.error;
  if (handoffResult.error) throw handoffResult.error;

  const account = accountResult.data;
  const repliesUsed = usageResult.data?.ai_replies_used ?? 0;
  const replyLimit = account.monthly_ai_reply_limit;
  const usagePercent = percent(repliesUsed, replyLimit);
  const productCount = productsResult.count ?? 0;
  const needsReplyCount = handoffResult.count ?? 0;
  const leadMode = account.full_leads_enabled
    ? 'Full Leads'
    : account.lead_lite_enabled
      ? 'Lead Lite'
      : 'Off';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bot Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Control the business-wide AI bot and see the limits that protect
            your monthly usage.
          </p>
        </div>
        <Badge variant={account.bot_enabled ? 'secondary' : 'outline'}>
          Bot {account.bot_enabled ? 'on' : 'off'}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Bot</CardTitle>
            <Bot className="size-4 text-slate-500" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold text-white">
              {account.bot_enabled ? 'On' : 'Off'}
            </div>
            {canManageBot ? (
              <form action={updateAccountBot}>
                <input
                  type="hidden"
                  name="bot_enabled"
                  value={account.bot_enabled ? 'false' : 'true'}
                />
                <Button
                  type="submit"
                  variant={account.bot_enabled ? 'outline' : 'default'}
                  className="w-full"
                >
                  {account.bot_enabled ? (
                    <PauseCircle className="size-4" />
                  ) : (
                    <Power className="size-4" />
                  )}
                  {account.bot_enabled ? 'Turn bot off' : 'Turn bot on'}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-slate-500">
                Ask an owner or admin to change the account-wide bot switch.
              </p>
            )}
          </CardContent>
        </Card>

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
            <CardTitle className="text-sm font-medium">Catalog Limit</CardTitle>
            <Package className="size-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {productCount} / {account.product_limit}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {account.package_type} package, {leadMode}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Reply</CardTitle>
            <MessageSquare className="size-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {needsReplyCount}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Unread, paused, or buying-intent chats
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>How Bot Control Works</CardTitle>
          <CardDescription>
            Keep this simple during manual onboarding and pilot testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-slate-300 md:grid-cols-3">
          <div>
            <div className="font-medium text-white">Account-wide switch</div>
            <p className="mt-1 text-slate-500">
              Owners and admins can turn the AI bot on or off for the whole
              business from this page.
            </p>
          </div>
          <div>
            <div className="font-medium text-white">Manual takeover</div>
            <p className="mt-1 text-slate-500">
              When a staff member replies in a chat, that conversation is paused
              for AI until someone resumes it.
            </p>
          </div>
          <div>
            <div className="font-medium text-white">Usage limit</div>
            <p className="mt-1 text-slate-500">
              When the monthly reply limit is reached, the webhook skips AI and
              sends the fallback message instead.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
