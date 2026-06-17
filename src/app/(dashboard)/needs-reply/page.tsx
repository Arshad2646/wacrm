import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Clock, MessageSquare, Tag } from 'lucide-react';

import { getCurrentAccount } from '@/lib/auth/account';
import { isPackageType } from '@/lib/saas/packages';
import { shouldUseFullLeads } from '@/lib/leads/detect';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ContactSummary = {
  id: string;
  name: string | null;
  phone: string | null;
};

type NeedsReplyConversation = {
  id: string;
  status: string;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  bot_paused: boolean;
  lead_intent_detected: boolean;
  lead_interest: string | null;
  updated_at: string;
  contact: ContactSummary | ContactSummary[] | null;
};

function contactFrom(row: NeedsReplyConversation): ContactSummary | null {
  return Array.isArray(row.contact) ? (row.contact[0] ?? null) : row.contact;
}

function timeAgo(value: string | null) {
  if (!value) return 'No messages yet';
  return `${formatDistanceToNow(new Date(value))} ago`;
}

async function loadFullLeadsFlag(
  supabase: Awaited<ReturnType<typeof getCurrentAccount>>['supabase'],
  accountId: string
) {
  const { data, error } = await supabase
    .from('accounts')
    .select('package_type, full_leads_enabled')
    .eq('id', accountId)
    .single();
  if (error) throw error;

  const packageType = isPackageType(data.package_type)
    ? data.package_type
    : 'starter';
  return shouldUseFullLeads({
    package_type: packageType,
    full_leads_enabled: data.full_leads_enabled ?? false,
  });
}

export default async function NeedsReplyPage() {
  const ctx = await getCurrentAccount();

  const [fullLeads, conversationsResult] = await Promise.all([
    loadFullLeadsFlag(ctx.supabase, ctx.accountId),
    ctx.supabase
      .from('conversations')
      .select(
        'id, status, last_message_text, last_message_at, unread_count, bot_paused, lead_intent_detected, lead_interest, updated_at, contact:contacts(id, name, phone)'
      )
      .eq('account_id', ctx.accountId)
      .or('bot_paused.eq.true,lead_intent_detected.eq.true,unread_count.gt.0')
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);

  if (conversationsResult.error) throw conversationsResult.error;

  const conversations = (conversationsResult.data ??
    []) as NeedsReplyConversation[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Needs Reply</h1>
          <p className="mt-1 text-sm text-slate-400">
            Chats that may need a human because they are unread, paused for AI,
            or show buying intent.
          </p>
        </div>
        {fullLeads && (
          <Link
            href="/leads"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <Tag className="size-3.5" />
            Open Leads
          </Link>
        )}
      </div>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Human Attention Queue</CardTitle>
          <CardDescription>
            Starter uses this as Lead Lite. Growth can also use the Leads page
            for status tracking and notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-8 text-center">
              <MessageSquare className="mx-auto size-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">
                No chats need human attention right now.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                New unread chats, AI-paused chats, and buying-intent chats will
                appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {conversations.map((conversation) => {
                const contact = contactFrom(conversation);
                const displayName =
                  contact?.name || contact?.phone || 'Unknown customer';
                const leadInterest = conversation.lead_interest?.trim();

                return (
                  <Link
                    key={conversation.id}
                    href={`/inbox?c=${conversation.id}`}
                    className="flex flex-col gap-3 px-1 py-4 transition-colors hover:bg-slate-800/40 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">
                          {displayName}
                        </span>
                        {conversation.unread_count > 0 && (
                          <Badge variant="secondary">
                            {conversation.unread_count} unread
                          </Badge>
                        )}
                        {conversation.bot_paused && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-amber-300"
                          >
                            <Bot className="size-3" />
                            AI paused
                          </Badge>
                        )}
                        {conversation.lead_intent_detected && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          >
                            Interested
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-400">
                        {conversation.last_message_text || 'No messages yet'}
                      </p>
                      {leadInterest && (
                        <p className="mt-1 text-xs text-emerald-300">
                          Interest: {leadInterest}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      <Clock className="size-3.5" />
                      {timeAgo(conversation.last_message_at)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
