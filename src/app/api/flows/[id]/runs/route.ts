import { NextResponse } from 'next/server';
import { requireAdvancedCrmTools } from '@/lib/auth/advanced-crm';
import { toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/flows/[id]/runs
 *
 * Newest-first list of flow runs for a single flow, with the latest
 * event timeline embedded for each. Used by the run-history viewer
 * page (`/flows/[id]/runs`) to give the owner end-to-end visibility
 * into what the bot did with each customer.
 *
 * RLS does the ownership check (flow_runs has a `user_id` policy);
 * we also gate on the per-account beta flag so the route 404s for
 * non-beta accounts matching the rest of /api/flows.
 *
 * Limited to the 50 most recent runs. Pagination can come later;
 * the dashboard surface here is for debugging, not heavy querying.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ctx = await requireAdvancedCrmTools('viewer');

    // Confirm flow exists + caller owns it before doing the run query.
    const { data: flow } = await ctx.supabase
      .from('flows')
      .select('id, name')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!flow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Pull runs + each run's contact name + each run's events.
    const { data: runs, error: runsErr } = await ctx.supabase
      .from('flow_runs')
      .select(
        'id, status, current_node_key, started_at, last_advanced_at, ended_at, end_reason, vars, reprompt_count, contact:contacts(id, name, phone)'
      )
      .eq('flow_id', id)
      .eq('account_id', ctx.accountId)
      .order('started_at', { ascending: false })
      .limit(50);
    if (runsErr) {
      console.error('[flows-runs] runs fetch failed:', runsErr);
      return NextResponse.json(
        { error: 'Failed to load flow runs' },
        { status: 500 }
      );
    }

    const runIds = (runs ?? []).map((r) => (r as { id: string }).id);
    let events: Array<{
      flow_run_id: string;
      event_type: string;
      node_key: string | null;
      payload: Record<string, unknown>;
      created_at: string;
    }> = [];
    if (runIds.length > 0) {
      const { data: evs, error: evsErr } = await ctx.supabase
        .from('flow_run_events')
        .select('flow_run_id, event_type, node_key, payload, created_at')
        .in('flow_run_id', runIds)
        .order('created_at', { ascending: true });
      if (evsErr) {
        // Non-fatal — the page can still show runs without timelines.
        console.error('[flows-runs] events fetch failed:', evsErr.message);
      } else if (evs) {
        events = evs as typeof events;
      }
    }

    return NextResponse.json({
      flow,
      runs: runs ?? [],
      events,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
