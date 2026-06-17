-- ============================================================
-- 023_saas_account_settings.sql — SaaS package/settings foundation
--
-- Phase 2 of the WhatsApp AI chatbot SaaS pivot.
--
-- Decision: reuse `accounts.id` / `account_id` as the SaaS
-- business/tenant key. Migration 017 already made every operational
-- table account-scoped with RLS, and an account represents one
-- WhatsApp workspace/business. A separate `businesses` table would add
-- indirection without improving tenant isolation for the MVP.
--
-- This migration adds:
--   - package settings directly on accounts
--   - bot and lead feature flags
--   - monthly AI reply usage buckets
--   - RLS for usage reads by account members
--
-- Product/service tables arrive in Phase 3. `product_limit` is stored
-- now so Phase 3 can enforce it before inserting products/services.
-- ============================================================

-- ============================================================
-- PACKAGE TYPE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_package_type') THEN
    CREATE TYPE account_package_type AS ENUM ('starter', 'growth', 'custom');
  END IF;
END $$;

-- ============================================================
-- ACCOUNT SETTINGS
-- ============================================================
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS package_type account_package_type NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS monthly_ai_reply_limit INTEGER NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS product_limit INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS full_leads_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lead_lite_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_monthly_ai_reply_limit_nonnegative;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_monthly_ai_reply_limit_nonnegative
  CHECK (monthly_ai_reply_limit >= 0);

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_product_limit_nonnegative;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_product_limit_nonnegative
  CHECK (product_limit >= 0);

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_feature_flags_object;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_feature_flags_object
  CHECK (jsonb_typeof(feature_flags) = 'object');

-- Starter must never expose Full Leads. Growth always has Full Leads
-- and Lead Lite metadata available. Custom can be manually configured.
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_package_lead_flags_consistent;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_package_lead_flags_consistent
  CHECK (
    (package_type = 'starter' AND lead_lite_enabled = TRUE AND full_leads_enabled = FALSE)
    OR (package_type = 'growth' AND lead_lite_enabled = TRUE AND full_leads_enabled = TRUE)
    OR (package_type = 'custom')
  );

CREATE INDEX IF NOT EXISTS idx_accounts_package_type ON accounts(package_type);
CREATE INDEX IF NOT EXISTS idx_accounts_bot_enabled ON accounts(bot_enabled);

-- Existing `accounts_update` RLS policy from migration 017 already
-- allows account admins to update their own account. Row-level RLS
-- cannot protect individual columns, so we narrow authenticated UPDATE
-- privileges to the ordinary self-service account fields. SaaS package
-- settings stay service-role only and are changed through the internal
-- super-admin page after server-side `SUPER_ADMIN_EMAILS` validation.
REVOKE UPDATE ON accounts FROM authenticated;
REVOKE UPDATE ON accounts FROM anon;
GRANT UPDATE (name, default_currency) ON accounts TO authenticated;
GRANT UPDATE ON accounts TO service_role;

-- ============================================================
-- MONTHLY AI USAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS account_ai_usage_months (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  ai_replies_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, month_start)
);

ALTER TABLE account_ai_usage_months
  DROP CONSTRAINT IF EXISTS account_ai_usage_months_replies_nonnegative;
ALTER TABLE account_ai_usage_months
  ADD CONSTRAINT account_ai_usage_months_replies_nonnegative
  CHECK (ai_replies_used >= 0);

CREATE INDEX IF NOT EXISTS idx_account_ai_usage_months_account_month
  ON account_ai_usage_months(account_id, month_start DESC);

ALTER TABLE account_ai_usage_months ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_ai_usage_months_select ON account_ai_usage_months;
CREATE POLICY account_ai_usage_months_select
  ON account_ai_usage_months FOR SELECT
  USING (is_account_member(account_id));

-- Usage writes are intentionally service-role only for now. Phase 4
-- webhook/AI code will increment these buckets server-side after
-- successful AI replies and will check limits before calling a model.

DROP TRIGGER IF EXISTS set_updated_at ON account_ai_usage_months;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_ai_usage_months
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
