-- ============================================================
-- 024_business_knowledge_ai_foundation.sql
--
-- Phase 3: business knowledge foundation for the WhatsApp AI chatbot
-- SaaS. This migration uses the Phase 2 decision that `accounts.id`
-- / `account_id` is the business tenant key.
--
-- Adds:
--   - account_business_profiles: business/chatbot profile settings
--   - account_products: products/services with package product limits
--   - account_knowledge_entries: FAQs and knowledge base entries
--
-- No WhatsApp webhook behavior changes are made in Phase 3.
-- ============================================================

-- ============================================================
-- TYPES
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bot_tone_enum') THEN
    CREATE TYPE bot_tone_enum AS ENUM ('friendly', 'professional', 'salesy');
  END IF;
END $$;

-- ============================================================
-- BUSINESS PROFILE / CHATBOT SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS account_business_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  business_description TEXT,
  location TEXT,
  opening_hours TEXT,
  services_summary TEXT,
  delivery_info TEXT,
  payment_info TEXT,
  order_instructions TEXT,
  fallback_message TEXT NOT NULL DEFAULT 'Thank you for your message. Our team will get back to you shortly.',
  bot_tone bot_tone_enum NOT NULL DEFAULT 'friendly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_business_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_business_profiles_select ON account_business_profiles;
CREATE POLICY account_business_profiles_select
  ON account_business_profiles FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS account_business_profiles_insert ON account_business_profiles;
CREATE POLICY account_business_profiles_insert
  ON account_business_profiles FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS account_business_profiles_update ON account_business_profiles;
CREATE POLICY account_business_profiles_update
  ON account_business_profiles FOR UPDATE
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS account_business_profiles_delete ON account_business_profiles;
CREATE POLICY account_business_profiles_delete
  ON account_business_profiles FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON account_business_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_business_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PRODUCTS / SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS account_products (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_text TEXT,
  description TEXT,
  availability_text TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_products_account
  ON account_products(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_products_account_active
  ON account_products(account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_account_products_account_category
  ON account_products(account_id, category);

ALTER TABLE account_products
  DROP CONSTRAINT IF EXISTS account_products_name_not_blank;
ALTER TABLE account_products
  ADD CONSTRAINT account_products_name_not_blank
  CHECK (length(btrim(name)) > 0);

ALTER TABLE account_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_products_select ON account_products;
CREATE POLICY account_products_select
  ON account_products FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS account_products_insert ON account_products;
CREATE POLICY account_products_insert
  ON account_products FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS account_products_update ON account_products;
CREATE POLICY account_products_update
  ON account_products FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS account_products_delete ON account_products;
CREATE POLICY account_products_delete
  ON account_products FOR DELETE
  USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON account_products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product limit guard. Count all saved products/services for the
-- account, active or inactive, so packages represent catalog size.
CREATE OR REPLACE FUNCTION enforce_account_product_limit()
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
  WHERE id = NEW.account_id;

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

ALTER FUNCTION enforce_account_product_limit() OWNER TO postgres;

DROP TRIGGER IF EXISTS enforce_account_product_limit_before_insert ON account_products;
CREATE TRIGGER enforce_account_product_limit_before_insert
  BEFORE INSERT ON account_products
  FOR EACH ROW EXECUTE FUNCTION enforce_account_product_limit();

-- ============================================================
-- FAQS / KNOWLEDGE ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS account_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_knowledge_entries_account
  ON account_knowledge_entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_knowledge_entries_account_active
  ON account_knowledge_entries(account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_account_knowledge_entries_account_category
  ON account_knowledge_entries(account_id, category);

ALTER TABLE account_knowledge_entries
  DROP CONSTRAINT IF EXISTS account_knowledge_entries_title_not_blank;
ALTER TABLE account_knowledge_entries
  ADD CONSTRAINT account_knowledge_entries_title_not_blank
  CHECK (length(btrim(title)) > 0);

ALTER TABLE account_knowledge_entries
  DROP CONSTRAINT IF EXISTS account_knowledge_entries_content_not_blank;
ALTER TABLE account_knowledge_entries
  ADD CONSTRAINT account_knowledge_entries_content_not_blank
  CHECK (length(btrim(content)) > 0);

ALTER TABLE account_knowledge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_knowledge_entries_select ON account_knowledge_entries;
CREATE POLICY account_knowledge_entries_select
  ON account_knowledge_entries FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS account_knowledge_entries_insert ON account_knowledge_entries;
CREATE POLICY account_knowledge_entries_insert
  ON account_knowledge_entries FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS account_knowledge_entries_update ON account_knowledge_entries;
CREATE POLICY account_knowledge_entries_update
  ON account_knowledge_entries FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS account_knowledge_entries_delete ON account_knowledge_entries;
CREATE POLICY account_knowledge_entries_delete
  ON account_knowledge_entries FOR DELETE
  USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON account_knowledge_entries;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
