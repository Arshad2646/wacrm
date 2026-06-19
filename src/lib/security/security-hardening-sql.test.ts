import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/026_security_hardening.sql'),
  'utf8'
);

describe('026 security hardening migration', () => {
  it('keeps encrypted WhatsApp token columns out of authenticated SELECT grants', () => {
    const grantMatch = migrationSql.match(
      /GRANT SELECT \(([\s\S]*?)\) ON whatsapp_config TO authenticated;/i
    );

    expect(grantMatch?.[1]).toBeDefined();
    expect(grantMatch?.[1]).not.toContain('access_token');
    expect(grantMatch?.[1]).not.toContain('verify_token');
    expect(migrationSql).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE ON whatsapp_config FROM authenticated;'
    );
  });

  it('enforces Full Leads and staff-invite package gates in database helpers', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.account_has_full_leads'
    );
    expect(migrationSql).toContain("a.package_type = 'growth'");
    expect(migrationSql).toContain(
      "a.package_type = 'custom' AND a.full_leads_enabled IS TRUE"
    );
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.account_allows_multiple_users'
    );
    expect(migrationSql).toContain(
      'IF NOT account_allows_multiple_users(v_inv.account_id) THEN'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.is_account_member(UUID, account_role_enum)'
    );
  });

  it('keeps profile tenant and role fields out of browser-authenticated writes', () => {
    expect(migrationSql).toContain(
      'REVOKE INSERT, UPDATE ON profiles FROM authenticated;'
    );
    expect(migrationSql).toContain(
      'GRANT UPDATE (full_name, avatar_url) ON profiles TO authenticated;'
    );

    const grantMatch = migrationSql.match(
      /GRANT UPDATE \(([\s\S]*?)\) ON profiles TO authenticated;/i
    );
    expect(grantMatch?.[1]).toBeDefined();
    expect(grantMatch?.[1]).not.toContain('account_id');
    expect(grantMatch?.[1]).not.toContain('account_role');
  });

  it('uses atomic AI reply reservation and refund functions for usage limits', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.reserve_account_ai_reply'
    );
    expect(migrationSql).toContain('AND ai_replies_used < v_limit');
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.refund_account_ai_reply'
    );
    expect(migrationSql).toContain(
      'ai_replies_used = GREATEST(ai_replies_used - 1, 0)'
    );
  });

  it('serializes product-limit checks per account to prevent concurrent bypasses', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.enforce_account_product_limit'
    );
    expect(migrationSql).toContain('WHERE id = NEW.account_id');
    expect(migrationSql).toContain('FOR UPDATE;');
    expect(migrationSql).toContain('Product limit reached for this package');
  });

  it('deduplicates inbound customer WhatsApp messages before replayable side effects', () => {
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_customer_meta_id_once_per_conversation'
    );
    expect(migrationSql).toContain('ON messages(conversation_id, message_id)');
    expect(migrationSql).toContain("WHERE sender_type = 'customer'");
  });

  it('keeps advanced CRM data behind both account membership and the release flag', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.account_has_advanced_crm_tools'
    );
    expect(migrationSql).toContain(
      'account_has_advanced_crm_tools(account_id)'
    );
    expect(migrationSql).toContain(
      'account_has_advanced_crm_tools(c.account_id)'
    );
  });

  it('adds tenant-consistency triggers for cross-account references', () => {
    expect(migrationSql).toContain(
      'CREATE TRIGGER ensure_conversation_contact_same_account_before_write'
    );
    expect(migrationSql).toContain(
      'CREATE TRIGGER ensure_lead_same_account_before_write'
    );
    expect(migrationSql).toContain(
      'CREATE TRIGGER ensure_flow_run_same_account_before_write'
    );
    expect(migrationSql).toContain(
      'CREATE TRIGGER ensure_deal_same_account_before_write'
    );
  });
});
