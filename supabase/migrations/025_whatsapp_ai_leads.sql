-- ============================================================
-- 025_whatsapp_ai_leads.sql
--
-- Phase 4: connect WhatsApp inbound messages to the AI chatbot
-- engine and add Starter Lead Lite / Growth Full Leads storage.
--
-- This keeps the Phase 2 tenancy decision: `accounts.id` /
-- `account_id` is the SaaS business tenant key.
-- ============================================================

-- ============================================================
-- CONVERSATION LEAD LITE / BOT STATE
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS bot_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lead_intent_detected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lead_interest TEXT,
  ADD COLUMN IF NOT EXISTS lead_last_detected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_account_lead_intent
  ON conversations(account_id, lead_last_detected_at DESC)
  WHERE lead_intent_detected = TRUE;

CREATE INDEX IF NOT EXISTS idx_conversations_account_bot_paused
  ON conversations(account_id, bot_paused)
  WHERE bot_paused = TRUE;

-- ============================================================
-- FULL LEADS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status_enum') THEN
    CREATE TYPE lead_status_enum AS ENUM ('new', 'contacted', 'won', 'lost');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  customer_name TEXT,
  phone_number TEXT,
  product_interest TEXT,
  status lead_status_enum NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_account_status_updated
  ON leads(account_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_account_created
  ON leads(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_contact
  ON leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_conversation
  ON leads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_leads_source_message
  ON leads(source_message_id);

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_product_interest_not_blank;
ALTER TABLE leads
  ADD CONSTRAINT leads_product_interest_not_blank
  CHECK (product_interest IS NULL OR length(btrim(product_interest)) > 0);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select ON leads;
CREATE POLICY leads_select
  ON leads FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS leads_insert ON leads;
CREATE POLICY leads_insert
  ON leads FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS leads_update ON leads;
CREATE POLICY leads_update
  ON leads FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS leads_delete ON leads;
CREATE POLICY leads_delete
  ON leads FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON leads;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- USAGE COUNTER RPC
-- ============================================================
CREATE OR REPLACE FUNCTION increment_account_ai_usage(
  p_account_id UUID,
  p_month_start DATE
) RETURNS account_ai_usage_months
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row account_ai_usage_months;
BEGIN
  INSERT INTO account_ai_usage_months (
    account_id,
    month_start,
    ai_replies_used
  )
  VALUES (
    p_account_id,
    p_month_start,
    1
  )
  ON CONFLICT (account_id, month_start)
  DO UPDATE SET
    ai_replies_used = account_ai_usage_months.ai_replies_used + 1,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

ALTER FUNCTION increment_account_ai_usage(UUID, DATE) OWNER TO postgres;
REVOKE ALL ON FUNCTION increment_account_ai_usage(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_account_ai_usage(UUID, DATE) TO service_role;
