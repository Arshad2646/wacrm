import { NextResponse } from 'next/server';
import { requireAdvancedCrmTools } from '@/lib/auth/advanced-crm';
import { toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { getTemplate } from '@/lib/automations/templates';
import {
  insertSteps,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree';
import {
  validateStepsForActivation,
  validateTriggerForActivation,
} from '@/lib/automations/validate';

function logDbError(context: string, error: unknown) {
  console.error(`[automations] ${context}:`, error);
}

export async function GET() {
  try {
    const ctx = await requireAdvancedCrmTools('viewer');

    const { data, error } = await ctx.supabase
      .from('automations')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });
    if (error) {
      logDbError('list failed', error);
      return NextResponse.json(
        { error: 'Failed to load automations' },
        { status: 500 }
      );
    }
    return NextResponse.json({ automations: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdvancedCrmTools('agent');

    const body = await request.json().catch(() => null);
    if (!body)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const {
      name,
      description,
      trigger_type,
      trigger_config,
      is_active,
      steps,
      template,
    } = body;

    let effectiveSteps: BuilderStepInput[] | undefined = steps;
    let effectiveName = name;
    let effectiveDescription = description;
    let effectiveTriggerType = trigger_type;
    let effectiveTriggerConfig = trigger_config;

    if (template && (!steps || steps.length === 0)) {
      const t = getTemplate(template);
      if (t) {
        effectiveName = effectiveName ?? t.name;
        effectiveDescription = effectiveDescription ?? t.description;
        effectiveTriggerType = effectiveTriggerType ?? t.trigger_type;
        effectiveTriggerConfig = effectiveTriggerConfig ?? t.trigger_config;
        effectiveSteps = t.steps as unknown as BuilderStepInput[];
      }
    }

    if (!effectiveName || !effectiveTriggerType) {
      return NextResponse.json(
        { error: 'name and trigger_type are required' },
        { status: 400 }
      );
    }

    // Block activation of a clearly broken automation up-front instead of
    // letting every trigger silently produce a failed log row. Drafts
    // (is_active=false) are allowed to be incomplete so users can save
    // progress mid-build.
    if (is_active) {
      const issues = [
        ...validateTriggerForActivation(
          effectiveTriggerType,
          effectiveTriggerConfig ?? {}
        ),
        ...validateStepsForActivation(
          (effectiveSteps ?? []) as unknown as {
            step_type: string;
            step_config: Record<string, unknown>;
          }[]
        ),
      ];
      if (issues.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot activate automation with invalid configuration',
            issues,
          },
          { status: 400 }
        );
      }
    }

    const admin = supabaseAdmin();
    const { data: automation, error: insertErr } = await admin
      .from('automations')
      .insert({
        user_id: ctx.userId,
        account_id: ctx.accountId,
        name: effectiveName,
        description: effectiveDescription ?? null,
        trigger_type: effectiveTriggerType,
        trigger_config: effectiveTriggerConfig ?? {},
        is_active: !!is_active,
      })
      .select()
      .single();

    if (insertErr || !automation) {
      logDbError('create failed', insertErr);
      return NextResponse.json(
        { error: 'Failed to create automation' },
        { status: 500 }
      );
    }

    if (effectiveSteps && effectiveSteps.length > 0) {
      const err = await insertSteps(automation.id, effectiveSteps);
      if (err) {
        logDbError('step insert failed', err);
        return NextResponse.json(
          { error: 'Failed to save automation steps' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
