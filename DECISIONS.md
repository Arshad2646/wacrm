# Decisions

## 2026-06-16

### One Shared SaaS App

The product will be one shared SaaS application serving multiple businesses. We will not create one separate codebase, workflow, or deployment per client.

### One Shared Supabase Database

The MVP should use one shared Supabase database with tenant isolation. The existing template already uses Supabase Auth, Postgres, RLS, and account-scoped data after the account-sharing migrations.

### Tenant Isolation

Tenant-owned data must be scoped by a business/tenant identifier and protected at the database level where practical. Existing code uses `account_id`; future SaaS work must explicitly decide whether `account_id` is the business tenant key or whether a new `business_id` layer is needed.

### Manual Onboarding Before Embedded Signup

Manual onboarding is the MVP approach. Super admin creates/configures businesses and WhatsApp settings. Meta Embedded Signup is documented as a future self-serve flow but not implemented now.

### AI Provider Adapter

AI integration should use a provider adapter selected by `AI_PROVIDER`. Gemini and OpenAI must have separate environment variables and model settings.

### Package-Based Feature Gating

Package settings control reply limits, product/service limits, and lead features. Package choice is manually controlled by super admin for the MVP.

### Starter Gets Lead Lite

Starter Bot includes buying-intent detection and simple interest indicators in conversations only. It does not expose full leads management.

### Growth Gets Full Leads

Growth Bot + Leads includes a full leads dashboard, lead statuses, notes, filters, and source conversation/message references.

### No Billing In MVP

No billing integration is required in the MVP. Prices are product/business terms, not automated billing logic yet.

### No n8n Dependency

n8n is not a requirement for this SaaS MVP.

### Preserve Useful Template Features

Keep useful existing WhatsApp CRM features, especially inbox, contacts, WhatsApp Cloud API integration, token encryption, webhook signature verification, account/team roles, broadcasts, automations, flows, and pipelines. Simplify visibility and package gating later instead of rebuilding from scratch.

## 2026-06-16 Phase 2

### Use Accounts As Business Tenants

The SaaS MVP will use the existing `accounts` table as the business/tenant table. `accounts.id` / `account_id` is the `business_id` equivalent.

Reasoning:

- Migration `017_account_sharing.sql` already made tenant-owned operational tables account-scoped.
- Existing RLS uses `is_account_member(account_id, min_role)`.
- WhatsApp config is already unique per account.
- Team/member roles already attach users to an account.
- Adding a separate `businesses/business_id` layer would duplicate tenancy concepts and increase risk without improving the MVP.

Manual onboarding therefore means: the business owner signs up or is created in Supabase Auth, the existing signup flow creates their account, and the SaaS operator configures that account in `/super-admin`.

### Package Settings Live On Accounts

Package settings are stored directly on `accounts`:

- `package_type`
- `monthly_ai_reply_limit`
- `product_limit`
- `bot_enabled`
- `lead_lite_enabled`
- `full_leads_enabled`
- `feature_flags`

This keeps package and limit checks near the tenant record and avoids a second settings table before the model needs one.

### Monthly AI Usage Buckets

AI usage will be tracked in `account_ai_usage_months`, keyed by `account_id` and `month_start`. Phase 4 will enforce limits before calling an AI provider and increment usage after successful bot replies.

### SaaS Package Columns Are Service-Role Managed

Business account admins can still update normal self-service account fields such as name and default currency. SaaS package/limit/bot/lead columns are service-role managed through the internal super-admin page, guarded by `SUPER_ADMIN_EMAILS`.

## 2026-06-16 Phase 3

### Knowledge Tables Are Account-Scoped

Business chatbot knowledge is stored in account-scoped tables:

- `account_business_profiles`
- `account_products`
- `account_knowledge_entries`

These tables use `account_id`, existing account-member RLS, and the Phase 2 decision that `accounts` is the business tenant model.

### Product Limits Are Enforced Server-Side And In The Database

Product/service count limits are enforced by dashboard server actions before insert and by a database trigger on `account_products` as a backstop. The trigger counts all products/services for the account, active or inactive, so the package limit represents total catalog size.

### AI Provider Adapter Uses Direct Server-Side HTTP

The Phase 3 AI provider adapter uses direct server-side `fetch` calls instead of adding SDK dependencies. `AI_PROVIDER` selects Gemini or OpenAI, with provider-specific API key/model/base URL env vars. Provider keys remain server-only.

### AI Test Is Separate From WhatsApp

The `/ai-test` page builds the business-scoped prompt and calls the selected AI provider for the signed-in account only. It does not send WhatsApp messages and does not alter webhook behavior.

## 2026-06-16 Phase 4

### Existing WhatsApp Webhook Is Extended, Not Rebuilt

Inbound AI replies are attached to the existing webhook flow after the inbound message is saved and after the Flows engine decides whether it consumed the message. If a Flow consumes the inbound message, the AI bot does not reply. This preserves existing menu/flow behavior and avoids two bot systems answering the same customer message.

### Usage Is Counted After Successful AI Sends

The webhook checks `account_ai_usage_months` before calling the AI provider. It increments usage through `increment_account_ai_usage(account_id, month_start)` only when an AI-generated reply is successfully sent through WhatsApp and saved to the conversation. Fallback replies for disabled/limited/error states are not counted as AI usage.

### Lead Lite Lives On Conversations

Starter Lead Lite stores buying intent indicators directly on `conversations` (`lead_intent_detected`, `lead_interest`, `lead_last_detected_at`). Starter accounts do not get full lead statuses or a dedicated board.

### Full Leads Are Account-Scoped Rows

Growth accounts and Custom accounts with `full_leads_enabled` create/update rows in `leads`, keyed by `account_id` and source `conversation_id`. Leads keep status, notes, source conversation/message, customer identity, phone, and product/service interest.
