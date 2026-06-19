-- ============================================================
-- 026_security_hardening.sql
--
-- Security hardening for the managed SaaS MVP:
--   1. Keep encrypted WhatsApp token columns server-only.
--   2. Enforce Advanced CRM feature gates at the database policy layer.
--   3. Add tenant-consistency triggers for cross-table references where
--      a row has account_id plus FKs to other tenant-owned records.
-- ============================================================

-- ============================================================
-- FEATURE-GATE HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION public.account_has_advanced_crm_tools(
  target_account_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.id = target_account_id
      AND a.package_type <> 'starter'
      AND a.feature_flags @> '{"advanced_crm_tools_enabled": true}'::jsonb
  );
$$;

ALTER FUNCTION public.account_has_advanced_crm_tools(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.account_has_advanced_crm_tools(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_has_advanced_crm_tools(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_has_full_leads(
  target_account_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.id = target_account_id
      AND (
        a.package_type = 'growth'
        OR (a.package_type = 'custom' AND a.full_leads_enabled IS TRUE)
      )
  );
$$;

ALTER FUNCTION public.account_has_full_leads(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.account_has_full_leads(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_has_full_leads(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_allows_multiple_users(
  target_account_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.id = target_account_id
      AND a.package_type <> 'starter'
  );
$$;

ALTER FUNCTION public.account_allows_multiple_users(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.account_allows_multiple_users(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_allows_multiple_users(UUID)
  TO authenticated, service_role;

-- Existing RLS policies rely on this helper, but Postgres grants EXECUTE
-- on new functions to PUBLIC by default. Keep it callable only by signed-in
-- app users and the service role.
REVOKE ALL ON FUNCTION public.is_account_member(UUID, account_role_enum)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_member(UUID, account_role_enum)
  TO authenticated, service_role;

-- ============================================================
-- PROFILE TRUST-COLUMN PRIVILEGES
--
-- Application role/account checks trust profiles.account_id and
-- profiles.account_role. The profile RLS policy lets users update
-- their own row so they can change display details, but browser
-- clients must not be able to self-promote or move themselves to
-- another tenant by updating those trusted columns directly.
--
-- New signup profile rows are created by handle_new_user() and
-- invitation moves happen inside redeem_invitation(), both SECURITY
-- DEFINER server/database flows owned by postgres. Normal users only
-- need to edit their display name and avatar from the Profile page.
-- ============================================================
REVOKE INSERT, UPDATE ON profiles FROM authenticated;
REVOKE INSERT, UPDATE ON profiles FROM anon;

GRANT UPDATE (full_name, avatar_url) ON profiles TO authenticated;
GRANT INSERT, UPDATE ON profiles TO service_role;

-- ============================================================
-- AI USAGE RESERVATION
--
-- The first usage implementation checked the monthly count, called the
-- AI provider, then incremented. Concurrent inbound messages could all
-- pass the stale pre-check. Reserve quota with one conditional UPDATE
-- before provider work, and refund it if generation/send fails.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_account_ai_reply(
  p_account_id UUID,
  p_month_start DATE,
  p_monthly_limit INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved_count INTEGER;
  v_limit INTEGER := GREATEST(COALESCE(p_monthly_limit, 0), 0);
BEGIN
  IF v_limit <= 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO account_ai_usage_months (
    account_id,
    month_start,
    ai_replies_used
  )
  VALUES (
    p_account_id,
    p_month_start,
    0
  )
  ON CONFLICT (account_id, month_start) DO NOTHING;

  UPDATE account_ai_usage_months
  SET
    ai_replies_used = ai_replies_used + 1,
    updated_at = NOW()
  WHERE account_id = p_account_id
    AND month_start = p_month_start
    AND ai_replies_used < v_limit
  RETURNING ai_replies_used INTO v_reserved_count;

  RETURN FOUND;
END;
$$;

ALTER FUNCTION public.reserve_account_ai_reply(UUID, DATE, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reserve_account_ai_reply(UUID, DATE, INTEGER)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_account_ai_reply(UUID, DATE, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.refund_account_ai_reply(
  p_account_id UUID,
  p_month_start DATE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE account_ai_usage_months
  SET
    ai_replies_used = GREATEST(ai_replies_used - 1, 0),
    updated_at = NOW()
  WHERE account_id = p_account_id
    AND month_start = p_month_start;
END;
$$;

ALTER FUNCTION public.refund_account_ai_reply(UUID, DATE) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.refund_account_ai_reply(UUID, DATE)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_account_ai_reply(UUID, DATE)
  TO service_role;

-- ============================================================
-- PRODUCT LIMIT SERIALIZATION
--
-- Migration 024 added a product-limit trigger, but the count/check
-- can race when two inserts for the same account happen concurrently.
-- Lock the parent account row first so one account's product inserts
-- serialize and the package product limit remains authoritative.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_account_product_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_limit INTEGER;
  v_existing_count INTEGER;
BEGIN
  SELECT product_limit INTO v_product_limit
  FROM accounts
  WHERE id = NEW.account_id
  FOR UPDATE;

  IF v_product_limit IS NULL THEN
    RAISE EXCEPTION 'Account not found for product limit check';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM account_products
  WHERE account_id = NEW.account_id;

  IF v_existing_count >= v_product_limit THEN
    RAISE EXCEPTION 'Product limit reached for this package';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_account_product_limit() OWNER TO postgres;

-- ============================================================
-- WHATSAPP WEBHOOK IDEMPOTENCY
--
-- Meta can retry deliveries, and a captured valid body/signature can be
-- replayed while still HMAC-valid. Keep customer inbound Meta message
-- ids unique inside one conversation so duplicate deliveries do not
-- create another message or rerun automations/flows/AI.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_customer_meta_id_once_per_conversation
  ON messages(conversation_id, message_id)
  WHERE sender_type = 'customer'
    AND message_id IS NOT NULL;

-- ============================================================
-- WHATSAPP CONFIG COLUMN PRIVILEGES
--
-- RLS protects rows, but encrypted access/verify tokens are still
-- secrets. Browser-authenticated clients only need safe metadata.
-- Server routes use the service-role client after role checks when
-- they need to decrypt and call Meta.
-- ============================================================
REVOKE SELECT, INSERT, UPDATE, DELETE ON whatsapp_config FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON whatsapp_config FROM anon;

GRANT SELECT (
  id,
  user_id,
  account_id,
  phone_number_id,
  waba_id,
  status,
  connected_at,
  created_at,
  updated_at,
  registered_at,
  subscribed_apps_at,
  last_registration_error
) ON whatsapp_config TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_config TO service_role;

-- ============================================================
-- ADVANCED CRM RLS GATES
--
-- Contacts themselves remain readable as core inbox/customer data.
-- Advanced contact tooling (tags/custom fields), pipelines, deals,
-- broadcasts, automations, and flows require the account-level feature
-- flag and are still role-scoped.
-- ============================================================

-- ---- tags -------------------------------------------------------
DROP POLICY IF EXISTS tags_select ON tags;
DROP POLICY IF EXISTS tags_insert ON tags;
DROP POLICY IF EXISTS tags_update ON tags;
DROP POLICY IF EXISTS tags_delete ON tags;
CREATE POLICY tags_select ON tags FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));
CREATE POLICY tags_insert ON tags FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY tags_update ON tags FOR UPDATE
  USING (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id))
  WITH CHECK (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY tags_delete ON tags FOR DELETE
  USING (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));

-- ---- custom_fields ---------------------------------------------
DROP POLICY IF EXISTS custom_fields_select ON custom_fields;
DROP POLICY IF EXISTS custom_fields_insert ON custom_fields;
DROP POLICY IF EXISTS custom_fields_update ON custom_fields;
DROP POLICY IF EXISTS custom_fields_delete ON custom_fields;
CREATE POLICY custom_fields_select ON custom_fields FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));
CREATE POLICY custom_fields_insert ON custom_fields FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY custom_fields_update ON custom_fields FOR UPDATE
  USING (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id))
  WITH CHECK (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY custom_fields_delete ON custom_fields FOR DELETE
  USING (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));

-- ---- contact_tags ----------------------------------------------
DROP POLICY IF EXISTS contact_tags_select ON contact_tags;
DROP POLICY IF EXISTS contact_tags_modify ON contact_tags;
CREATE POLICY contact_tags_select ON contact_tags FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.id = contact_tags.contact_id
      AND is_account_member(c.account_id)
      AND account_has_advanced_crm_tools(c.account_id)
  )
);
CREATE POLICY contact_tags_modify ON contact_tags FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.id = contact_tags.contact_id
      AND is_account_member(c.account_id, 'agent')
      AND account_has_advanced_crm_tools(c.account_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.id = contact_tags.contact_id
      AND is_account_member(c.account_id, 'agent')
      AND account_has_advanced_crm_tools(c.account_id)
  )
);

-- ---- contact_custom_values -------------------------------------
DROP POLICY IF EXISTS contact_custom_values_select ON contact_custom_values;
DROP POLICY IF EXISTS contact_custom_values_modify ON contact_custom_values;
CREATE POLICY contact_custom_values_select ON contact_custom_values FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.id = contact_custom_values.contact_id
      AND is_account_member(c.account_id)
      AND account_has_advanced_crm_tools(c.account_id)
  )
);
CREATE POLICY contact_custom_values_modify ON contact_custom_values FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.id = contact_custom_values.contact_id
      AND is_account_member(c.account_id, 'agent')
      AND account_has_advanced_crm_tools(c.account_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.id = contact_custom_values.contact_id
      AND is_account_member(c.account_id, 'agent')
      AND account_has_advanced_crm_tools(c.account_id)
  )
);

-- ---- pipelines / stages / deals --------------------------------
DROP POLICY IF EXISTS pipelines_select ON pipelines;
DROP POLICY IF EXISTS pipelines_insert ON pipelines;
DROP POLICY IF EXISTS pipelines_update ON pipelines;
DROP POLICY IF EXISTS pipelines_delete ON pipelines;
CREATE POLICY pipelines_select ON pipelines FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));
CREATE POLICY pipelines_insert ON pipelines FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY pipelines_update ON pipelines FOR UPDATE
  USING (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id))
  WITH CHECK (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY pipelines_delete ON pipelines FOR DELETE
  USING (is_account_member(account_id, 'admin') AND account_has_advanced_crm_tools(account_id));

DROP POLICY IF EXISTS pipeline_stages_select ON pipeline_stages;
DROP POLICY IF EXISTS pipeline_stages_modify ON pipeline_stages;
CREATE POLICY pipeline_stages_select ON pipeline_stages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_stages.pipeline_id
      AND is_account_member(p.account_id)
      AND account_has_advanced_crm_tools(p.account_id)
  )
);
CREATE POLICY pipeline_stages_modify ON pipeline_stages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_stages.pipeline_id
      AND is_account_member(p.account_id, 'admin')
      AND account_has_advanced_crm_tools(p.account_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_stages.pipeline_id
      AND is_account_member(p.account_id, 'admin')
      AND account_has_advanced_crm_tools(p.account_id)
  )
);

DROP POLICY IF EXISTS deals_select ON deals;
DROP POLICY IF EXISTS deals_insert ON deals;
DROP POLICY IF EXISTS deals_update ON deals;
DROP POLICY IF EXISTS deals_delete ON deals;
CREATE POLICY deals_select ON deals FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));
CREATE POLICY deals_insert ON deals FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY deals_update ON deals FOR UPDATE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id))
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY deals_delete ON deals FOR DELETE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));

-- ---- broadcasts -------------------------------------------------
DROP POLICY IF EXISTS broadcasts_select ON broadcasts;
DROP POLICY IF EXISTS broadcasts_insert ON broadcasts;
DROP POLICY IF EXISTS broadcasts_update ON broadcasts;
DROP POLICY IF EXISTS broadcasts_delete ON broadcasts;
CREATE POLICY broadcasts_select ON broadcasts FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));
CREATE POLICY broadcasts_insert ON broadcasts FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY broadcasts_update ON broadcasts FOR UPDATE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id))
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY broadcasts_delete ON broadcasts FOR DELETE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));

DROP POLICY IF EXISTS broadcast_recipients_select ON broadcast_recipients;
DROP POLICY IF EXISTS broadcast_recipients_modify ON broadcast_recipients;
CREATE POLICY broadcast_recipients_select ON broadcast_recipients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM broadcasts b
    WHERE b.id = broadcast_recipients.broadcast_id
      AND is_account_member(b.account_id)
      AND account_has_advanced_crm_tools(b.account_id)
  )
);
CREATE POLICY broadcast_recipients_modify ON broadcast_recipients FOR ALL USING (
  EXISTS (
    SELECT 1 FROM broadcasts b
    WHERE b.id = broadcast_recipients.broadcast_id
      AND is_account_member(b.account_id, 'agent')
      AND account_has_advanced_crm_tools(b.account_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM broadcasts b
    WHERE b.id = broadcast_recipients.broadcast_id
      AND is_account_member(b.account_id, 'agent')
      AND account_has_advanced_crm_tools(b.account_id)
  )
);

-- ---- automations / flows ---------------------------------------
DROP POLICY IF EXISTS automations_select ON automations;
DROP POLICY IF EXISTS automations_insert ON automations;
DROP POLICY IF EXISTS automations_update ON automations;
DROP POLICY IF EXISTS automations_delete ON automations;
CREATE POLICY automations_select ON automations FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));
CREATE POLICY automations_insert ON automations FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY automations_update ON automations FOR UPDATE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id))
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY automations_delete ON automations FOR DELETE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));

DROP POLICY IF EXISTS automation_logs_select ON automation_logs;
CREATE POLICY automation_logs_select ON automation_logs FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));

DROP POLICY IF EXISTS automation_steps_select ON automation_steps;
DROP POLICY IF EXISTS automation_steps_modify ON automation_steps;
CREATE POLICY automation_steps_select ON automation_steps FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM automations a
    WHERE a.id = automation_steps.automation_id
      AND is_account_member(a.account_id)
      AND account_has_advanced_crm_tools(a.account_id)
  )
);
CREATE POLICY automation_steps_modify ON automation_steps FOR ALL USING (
  EXISTS (
    SELECT 1 FROM automations a
    WHERE a.id = automation_steps.automation_id
      AND is_account_member(a.account_id, 'agent')
      AND account_has_advanced_crm_tools(a.account_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM automations a
    WHERE a.id = automation_steps.automation_id
      AND is_account_member(a.account_id, 'agent')
      AND account_has_advanced_crm_tools(a.account_id)
  )
);

DROP POLICY IF EXISTS flows_select ON flows;
DROP POLICY IF EXISTS flows_insert ON flows;
DROP POLICY IF EXISTS flows_update ON flows;
DROP POLICY IF EXISTS flows_delete ON flows;
CREATE POLICY flows_select ON flows FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));
CREATE POLICY flows_insert ON flows FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY flows_update ON flows FOR UPDATE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id))
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));
CREATE POLICY flows_delete ON flows FOR DELETE
  USING (is_account_member(account_id, 'agent') AND account_has_advanced_crm_tools(account_id));

DROP POLICY IF EXISTS flow_runs_select ON flow_runs;
CREATE POLICY flow_runs_select ON flow_runs FOR SELECT
  USING (is_account_member(account_id) AND account_has_advanced_crm_tools(account_id));

DROP POLICY IF EXISTS flow_nodes_select ON flow_nodes;
DROP POLICY IF EXISTS flow_nodes_modify ON flow_nodes;
CREATE POLICY flow_nodes_select ON flow_nodes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND is_account_member(f.account_id)
      AND account_has_advanced_crm_tools(f.account_id)
  )
);
CREATE POLICY flow_nodes_modify ON flow_nodes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND is_account_member(f.account_id, 'agent')
      AND account_has_advanced_crm_tools(f.account_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND is_account_member(f.account_id, 'agent')
      AND account_has_advanced_crm_tools(f.account_id)
  )
);

DROP POLICY IF EXISTS flow_run_events_select ON flow_run_events;
CREATE POLICY flow_run_events_select ON flow_run_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM flow_runs r
    WHERE r.id = flow_run_events.flow_run_id
      AND is_account_member(r.account_id)
      AND account_has_advanced_crm_tools(r.account_id)
  )
);

-- ---- full leads -------------------------------------------------
DROP POLICY IF EXISTS leads_select ON leads;
DROP POLICY IF EXISTS leads_insert ON leads;
DROP POLICY IF EXISTS leads_update ON leads;
DROP POLICY IF EXISTS leads_delete ON leads;
CREATE POLICY leads_select ON leads FOR SELECT
  USING (is_account_member(account_id) AND account_has_full_leads(account_id));
CREATE POLICY leads_insert ON leads FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_full_leads(account_id));
CREATE POLICY leads_update ON leads FOR UPDATE
  USING (is_account_member(account_id, 'agent') AND account_has_full_leads(account_id))
  WITH CHECK (is_account_member(account_id, 'agent') AND account_has_full_leads(account_id));
CREATE POLICY leads_delete ON leads FOR DELETE
  USING (is_account_member(account_id, 'admin') AND account_has_full_leads(account_id));

-- ---- member invitations ----------------------------------------
DROP POLICY IF EXISTS account_invitations_select ON account_invitations;
DROP POLICY IF EXISTS account_invitations_modify ON account_invitations;
DROP POLICY IF EXISTS account_invitations_insert ON account_invitations;
DROP POLICY IF EXISTS account_invitations_update ON account_invitations;
DROP POLICY IF EXISTS account_invitations_delete ON account_invitations;
CREATE POLICY account_invitations_select ON account_invitations FOR SELECT
  USING (is_account_member(account_id, 'admin'));
CREATE POLICY account_invitations_insert ON account_invitations FOR INSERT
  WITH CHECK (
    is_account_member(account_id, 'admin')
    AND account_allows_multiple_users(account_id)
  );
CREATE POLICY account_invitations_delete ON account_invitations FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Authenticated users can call the invitation RPC directly through
-- Supabase, so the Starter one-user limit must live inside the RPC
-- too. This replaces migration 019's function with the same behavior
-- plus a target-account package check before profile mutation.
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_old_account_id UUID;
  v_old_account_owner UUID;
  v_has_data BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;
  IF NOT account_allows_multiple_users(v_inv.account_id) THEN
    RAISE EXCEPTION 'This account package does not allow additional members'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.account_id, a.owner_user_id
  INTO v_old_account_id, v_old_account_owner
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = v_caller_id;

  IF v_old_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no profile' USING ERRCODE = '42501';
  END IF;

  IF v_old_account_id = v_inv.account_id THEN
    RAISE EXCEPTION 'You are already a member of this account'
      USING ERRCODE = '23505';
  END IF;

  IF v_old_account_owner <> v_caller_id THEN
    RAISE EXCEPTION 'You are already in a shared account; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM contacts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM conversations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM broadcasts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flows WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM pipelines WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM message_templates WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM tags WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM custom_fields WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM contact_notes WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM whatsapp_config WHERE account_id = v_old_account_id
    LIMIT 1
  ) INTO v_has_data;

  IF v_has_data THEN
    RAISE EXCEPTION 'Your account already contains data; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  UPDATE profiles
  SET account_id = v_inv.account_id,
      account_role = v_inv.role
  WHERE user_id = v_caller_id;

  UPDATE account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  DELETE FROM accounts WHERE id = v_old_account_id;

  RETURN v_inv.account_id;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;

-- ============================================================
-- TENANT-CONSISTENCY TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_contact_tag_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_account UUID;
  v_tag_account UUID;
BEGIN
  SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
  SELECT account_id INTO v_tag_account FROM tags WHERE id = NEW.tag_id;
  IF v_contact_account IS NULL OR v_tag_account IS NULL OR v_contact_account <> v_tag_account THEN
    RAISE EXCEPTION 'contact tag tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_contact_tag_same_account_before_write ON contact_tags;
CREATE TRIGGER ensure_contact_tag_same_account_before_write
  BEFORE INSERT OR UPDATE ON contact_tags
  FOR EACH ROW EXECUTE FUNCTION public.ensure_contact_tag_same_account();

CREATE OR REPLACE FUNCTION public.ensure_contact_custom_value_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_account UUID;
  v_field_account UUID;
BEGIN
  SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
  SELECT account_id INTO v_field_account FROM custom_fields WHERE id = NEW.custom_field_id;
  IF v_contact_account IS NULL OR v_field_account IS NULL OR v_contact_account <> v_field_account THEN
    RAISE EXCEPTION 'contact custom value tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_contact_custom_value_same_account_before_write ON contact_custom_values;
CREATE TRIGGER ensure_contact_custom_value_same_account_before_write
  BEFORE INSERT OR UPDATE ON contact_custom_values
  FOR EACH ROW EXECUTE FUNCTION public.ensure_contact_custom_value_same_account();

CREATE OR REPLACE FUNCTION public.ensure_contact_note_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_account UUID;
BEGIN
  SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
  IF v_contact_account IS NULL OR v_contact_account <> NEW.account_id THEN
    RAISE EXCEPTION 'contact note tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_contact_note_same_account_before_write ON contact_notes;
CREATE TRIGGER ensure_contact_note_same_account_before_write
  BEFORE INSERT OR UPDATE OF account_id, contact_id ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION public.ensure_contact_note_same_account();

CREATE OR REPLACE FUNCTION public.ensure_conversation_contact_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_account UUID;
BEGIN
  SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
  IF v_contact_account IS NULL OR v_contact_account <> NEW.account_id THEN
    RAISE EXCEPTION 'conversation contact tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_conversation_contact_same_account_before_write ON conversations;
CREATE TRIGGER ensure_conversation_contact_same_account_before_write
  BEFORE INSERT OR UPDATE OF account_id, contact_id ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.ensure_conversation_contact_same_account();

CREATE OR REPLACE FUNCTION public.ensure_message_same_conversation_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_conversation UUID;
BEGIN
  IF NEW.reply_to_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT conversation_id INTO v_parent_conversation
  FROM messages
  WHERE id = NEW.reply_to_message_id;

  IF v_parent_conversation IS NULL OR v_parent_conversation <> NEW.conversation_id THEN
    RAISE EXCEPTION 'message reply tenant/conversation mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_message_same_conversation_refs_before_write ON messages;
CREATE TRIGGER ensure_message_same_conversation_refs_before_write
  BEFORE INSERT OR UPDATE OF conversation_id, reply_to_message_id ON messages
  FOR EACH ROW EXECUTE FUNCTION public.ensure_message_same_conversation_refs();

CREATE OR REPLACE FUNCTION public.ensure_message_reaction_same_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_conversation UUID;
BEGIN
  SELECT conversation_id INTO v_message_conversation
  FROM messages
  WHERE id = NEW.message_id;

  IF v_message_conversation IS NULL OR v_message_conversation <> NEW.conversation_id THEN
    RAISE EXCEPTION 'message reaction conversation mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_message_reaction_same_conversation_before_write ON message_reactions;
CREATE TRIGGER ensure_message_reaction_same_conversation_before_write
  BEFORE INSERT OR UPDATE OF message_id, conversation_id ON message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_message_reaction_same_conversation();

CREATE OR REPLACE FUNCTION public.ensure_broadcast_recipient_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_broadcast_account UUID;
  v_contact_account UUID;
BEGIN
  SELECT account_id INTO v_broadcast_account FROM broadcasts WHERE id = NEW.broadcast_id;
  IF v_broadcast_account IS NULL THEN
    RAISE EXCEPTION 'broadcast recipient tenant mismatch';
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
    IF v_contact_account IS NULL OR v_broadcast_account <> v_contact_account THEN
      RAISE EXCEPTION 'broadcast recipient tenant mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_broadcast_recipient_same_account_before_write ON broadcast_recipients;
CREATE TRIGGER ensure_broadcast_recipient_same_account_before_write
  BEFORE INSERT OR UPDATE OF broadcast_id, contact_id ON broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.ensure_broadcast_recipient_same_account();

CREATE OR REPLACE FUNCTION public.ensure_automation_step_same_automation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_automation UUID;
BEGIN
  IF NEW.parent_step_id IS NOT NULL THEN
    SELECT automation_id INTO v_parent_automation
    FROM automation_steps
    WHERE id = NEW.parent_step_id;

    IF v_parent_automation IS NULL OR v_parent_automation <> NEW.automation_id THEN
      RAISE EXCEPTION 'automation step parent mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_automation_step_same_automation_before_write ON automation_steps;
CREATE TRIGGER ensure_automation_step_same_automation_before_write
  BEFORE INSERT OR UPDATE OF automation_id, parent_step_id ON automation_steps
  FOR EACH ROW EXECUTE FUNCTION public.ensure_automation_step_same_automation();

CREATE OR REPLACE FUNCTION public.ensure_automation_log_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_automation_account UUID;
  v_contact_account UUID;
BEGIN
  SELECT account_id INTO v_automation_account FROM automations WHERE id = NEW.automation_id;
  IF v_automation_account IS NULL OR v_automation_account <> NEW.account_id THEN
    RAISE EXCEPTION 'automation log tenant mismatch';
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
    IF v_contact_account IS NULL OR v_contact_account <> NEW.account_id THEN
      RAISE EXCEPTION 'automation log contact tenant mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_automation_log_same_account_before_write ON automation_logs;
CREATE TRIGGER ensure_automation_log_same_account_before_write
  BEFORE INSERT OR UPDATE OF account_id, automation_id, contact_id ON automation_logs
  FOR EACH ROW EXECUTE FUNCTION public.ensure_automation_log_same_account();

CREATE OR REPLACE FUNCTION public.ensure_automation_pending_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_automation_account UUID;
  v_contact_account UUID;
  v_log_account UUID;
  v_parent_automation UUID;
BEGIN
  SELECT account_id INTO v_automation_account FROM automations WHERE id = NEW.automation_id;
  IF v_automation_account IS NULL OR v_automation_account <> NEW.account_id THEN
    RAISE EXCEPTION 'automation pending tenant mismatch';
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
    IF v_contact_account IS NULL OR v_contact_account <> NEW.account_id THEN
      RAISE EXCEPTION 'automation pending contact tenant mismatch';
    END IF;
  END IF;

  IF NEW.log_id IS NOT NULL THEN
    SELECT account_id INTO v_log_account FROM automation_logs WHERE id = NEW.log_id;
    IF v_log_account IS NULL OR v_log_account <> NEW.account_id THEN
      RAISE EXCEPTION 'automation pending log tenant mismatch';
    END IF;
  END IF;

  IF NEW.parent_step_id IS NOT NULL THEN
    SELECT automation_id INTO v_parent_automation
    FROM automation_steps
    WHERE id = NEW.parent_step_id;
    IF v_parent_automation IS NULL OR v_parent_automation <> NEW.automation_id THEN
      RAISE EXCEPTION 'automation pending parent step mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_automation_pending_same_account_before_write ON automation_pending_executions;
CREATE TRIGGER ensure_automation_pending_same_account_before_write
  BEFORE INSERT OR UPDATE OF account_id, automation_id, contact_id, log_id, parent_step_id
  ON automation_pending_executions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_automation_pending_same_account();

CREATE OR REPLACE FUNCTION public.ensure_flow_run_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow_account UUID;
  v_contact_account UUID;
  v_conversation_account UUID;
  v_conversation_contact UUID;
  v_prompt_account UUID;
  v_prompt_conversation UUID;
BEGIN
  SELECT account_id INTO v_flow_account FROM flows WHERE id = NEW.flow_id;
  IF v_flow_account IS NULL OR v_flow_account <> NEW.account_id THEN
    RAISE EXCEPTION 'flow run tenant mismatch';
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
    IF v_contact_account IS NULL OR v_contact_account <> NEW.account_id THEN
      RAISE EXCEPTION 'flow run contact tenant mismatch';
    END IF;
  END IF;

  IF NEW.conversation_id IS NOT NULL THEN
    SELECT account_id, contact_id INTO v_conversation_account, v_conversation_contact
    FROM conversations
    WHERE id = NEW.conversation_id;
    IF v_conversation_account IS NULL OR v_conversation_account <> NEW.account_id THEN
      RAISE EXCEPTION 'flow run conversation tenant mismatch';
    END IF;
    IF NEW.contact_id IS NOT NULL AND v_conversation_contact <> NEW.contact_id THEN
      RAISE EXCEPTION 'flow run conversation contact mismatch';
    END IF;
  END IF;

  IF NEW.last_prompt_message_id IS NOT NULL THEN
    SELECT c.account_id, m.conversation_id INTO v_prompt_account, v_prompt_conversation
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = NEW.last_prompt_message_id;
    IF v_prompt_account IS NULL OR v_prompt_account <> NEW.account_id THEN
      RAISE EXCEPTION 'flow run prompt message tenant mismatch';
    END IF;
    IF v_prompt_conversation IS NULL
      OR (NEW.conversation_id IS NOT NULL AND v_prompt_conversation <> NEW.conversation_id) THEN
      RAISE EXCEPTION 'flow run prompt message mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_flow_run_same_account_before_write ON flow_runs;
CREATE TRIGGER ensure_flow_run_same_account_before_write
  BEFORE INSERT OR UPDATE OF account_id, flow_id, contact_id, conversation_id, last_prompt_message_id
  ON flow_runs
  FOR EACH ROW EXECUTE FUNCTION public.ensure_flow_run_same_account();

CREATE OR REPLACE FUNCTION public.ensure_deal_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_account UUID;
  v_stage_pipeline UUID;
  v_contact_account UUID;
  v_conversation_account UUID;
  v_conversation_contact UUID;
BEGIN
  SELECT account_id INTO v_pipeline_account FROM pipelines WHERE id = NEW.pipeline_id;
  IF v_pipeline_account IS NULL OR v_pipeline_account <> NEW.account_id THEN
    RAISE EXCEPTION 'deal pipeline tenant mismatch';
  END IF;

  SELECT pipeline_id INTO v_stage_pipeline FROM pipeline_stages WHERE id = NEW.stage_id;
  IF v_stage_pipeline IS NULL OR v_stage_pipeline <> NEW.pipeline_id THEN
    RAISE EXCEPTION 'deal stage pipeline mismatch';
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
    IF v_contact_account IS NULL OR v_contact_account <> NEW.account_id THEN
      RAISE EXCEPTION 'deal contact tenant mismatch';
    END IF;
  END IF;

  IF NEW.conversation_id IS NOT NULL THEN
    SELECT account_id, contact_id INTO v_conversation_account, v_conversation_contact
    FROM conversations
    WHERE id = NEW.conversation_id;
    IF v_conversation_account IS NULL OR v_conversation_account <> NEW.account_id THEN
      RAISE EXCEPTION 'deal conversation tenant mismatch';
    END IF;
    IF NEW.contact_id IS NOT NULL AND v_conversation_contact <> NEW.contact_id THEN
      RAISE EXCEPTION 'deal conversation contact mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_deal_same_account_before_write ON deals;
CREATE TRIGGER ensure_deal_same_account_before_write
  BEFORE INSERT OR UPDATE OF account_id, pipeline_id, stage_id, contact_id, conversation_id ON deals
  FOR EACH ROW EXECUTE FUNCTION public.ensure_deal_same_account();

CREATE OR REPLACE FUNCTION public.ensure_lead_same_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_account UUID;
  v_conversation_account UUID;
  v_conversation_contact UUID;
  v_message_account UUID;
  v_message_conversation UUID;
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO v_contact_account FROM contacts WHERE id = NEW.contact_id;
    IF v_contact_account IS NULL OR v_contact_account <> NEW.account_id THEN
      RAISE EXCEPTION 'lead contact tenant mismatch';
    END IF;
  END IF;

  IF NEW.conversation_id IS NOT NULL THEN
    SELECT account_id, contact_id INTO v_conversation_account, v_conversation_contact
    FROM conversations
    WHERE id = NEW.conversation_id;
    IF v_conversation_account IS NULL OR v_conversation_account <> NEW.account_id THEN
      RAISE EXCEPTION 'lead conversation tenant mismatch';
    END IF;
    IF NEW.contact_id IS NOT NULL AND v_conversation_contact <> NEW.contact_id THEN
      RAISE EXCEPTION 'lead conversation contact mismatch';
    END IF;
  END IF;

  IF NEW.source_message_id IS NOT NULL THEN
    SELECT c.account_id, m.conversation_id INTO v_message_account, v_message_conversation
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = NEW.source_message_id;
    IF v_message_account IS NULL OR v_message_account <> NEW.account_id THEN
      RAISE EXCEPTION 'lead source message tenant mismatch';
    END IF;
    IF NEW.conversation_id IS NOT NULL AND v_message_conversation <> NEW.conversation_id THEN
      RAISE EXCEPTION 'lead source message conversation mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_lead_same_account_before_write ON leads;
CREATE TRIGGER ensure_lead_same_account_before_write
  BEFORE INSERT OR UPDATE OF account_id, contact_id, conversation_id, source_message_id ON leads
  FOR EACH ROW EXECUTE FUNCTION public.ensure_lead_same_account();
