import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { getCurrentAccount, requireRole } from '@/lib/auth/account';
import { hasMinRole } from '@/lib/auth/roles';
import { isPackageType } from '@/lib/saas/packages';
import { shouldUseFullLeads } from '@/lib/leads/detect';
import { cn } from '@/lib/utils';
import type { Lead, LeadStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'won', 'lost'];

function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && STATUSES.includes(value as LeadStatus);
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

async function updateLead(formData: FormData) {
  'use server';

  const ctx = await requireRole('agent');
  const fullLeads = await loadFullLeadsFlag(ctx.supabase, ctx.accountId);
  if (!fullLeads)
    throw new Error('Full Leads is not enabled for this account.');

  const id = textField(formData, 'id');
  const status = textField(formData, 'status');
  if (!id) throw new Error('Missing lead id');
  if (!isLeadStatus(status)) throw new Error('Invalid lead status');

  const { error } = await ctx.supabase
    .from('leads')
    .update({
      status,
      notes: textField(formData, 'notes'),
    })
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) throw error;

  revalidatePath('/leads');
}

function statusLabel(status: LeadStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getCurrentAccount();
  const canEdit = hasMinRole(ctx.role, 'agent');
  const fullLeads = await loadFullLeadsFlag(ctx.supabase, ctx.accountId);
  const params = await searchParams;
  const statusFilter = isLeadStatus(params.status) ? params.status : null;

  if (!fullLeads) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="mt-1 text-sm text-slate-400">
            Full lead management is available on Growth or enabled Custom
            packages.
          </p>
        </div>
        <Card className="border border-slate-800 bg-slate-900">
          <CardContent className="pt-4 text-sm text-slate-300">
            Starter accounts keep Lead Lite indicators inside conversations but
            do not have a dedicated leads board.
          </CardContent>
        </Card>
      </div>
    );
  }

  let query = ctx.supabase
    .from('leads')
    .select('*')
    .eq('account_id', ctx.accountId)
    .order('updated_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;

  const leads = (data ?? []) as Lead[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="mt-1 text-sm text-slate-400">
            Follow up with customers who showed buying intent on WhatsApp.
          </p>
        </div>
        <Badge variant="secondary">{leads.length} shown</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/leads"
          className={cn(
            buttonVariants({
              variant: statusFilter ? 'outline' : 'default',
              size: 'sm',
            })
          )}
        >
          All
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/leads?status=${status}`}
            className={cn(
              buttonVariants({
                variant: statusFilter === status ? 'default' : 'outline',
                size: 'sm',
              })
            )}
          >
            {statusLabel(status)}
          </Link>
        ))}
      </div>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Lead Follow-Up</CardTitle>
          <CardDescription>
            Leads are created from buying intent detected in WhatsApp
            conversations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Source</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="align-top">
                  <TableCell className="min-w-48">
                    <div className="font-medium text-white">
                      {lead.customer_name || 'Unknown customer'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {lead.phone_number || 'No phone saved'}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-48 whitespace-normal text-slate-300">
                    {lead.product_interest || 'General enquiry'}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <form id={`lead-${lead.id}`} action={updateLead}>
                        <input type="hidden" name="id" value={lead.id} />
                        <select
                          name="status"
                          defaultValue={lead.status}
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </form>
                    ) : (
                      <Badge variant="outline">
                        {statusLabel(lead.status)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="min-w-72">
                    {canEdit ? (
                      <Textarea
                        form={`lead-${lead.id}`}
                        name="notes"
                        defaultValue={lead.notes ?? ''}
                        rows={3}
                      />
                    ) : (
                      <span className="text-sm text-slate-400">
                        {lead.notes || 'No notes'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.conversation_id ? (
                      <Link
                        className="text-primary text-sm hover:underline"
                        href={`/inbox?c=${lead.conversation_id}`}
                      >
                        Open chat
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-500">Not linked</span>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button type="submit" form={`lead-${lead.id}`} size="sm">
                        Save
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {leads.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 6 : 5}
                    className="py-8 text-center text-sm text-slate-500"
                  >
                    No leads match this filter yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
