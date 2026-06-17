# Architecture

## Current App Structure

The current codebase is a Next.js 16 App Router application with React 19, TypeScript, Tailwind CSS 4, Supabase, and Vitest.

Important areas:

- `src/app/(dashboard)` contains authenticated dashboard pages.
- `src/app/api` contains server route handlers.
- `src/app/api/whatsapp/webhook/route.ts` handles Meta webhook verification, inbound messages, status updates, template webhook events, conversation/message persistence, automation dispatch, and flow dispatch.
- `src/lib/ai/whatsapp-bot.ts` runs the Phase 4 inbound WhatsApp AI reply flow after the webhook saves a customer message.
- `src/app/api/whatsapp/config/route.ts` saves and verifies WhatsApp Cloud API configuration.
- `src/app/api/whatsapp/send/route.ts` sends manual WhatsApp replies from the dashboard.
- `src/components/inbox` contains the conversation inbox UI.
- `src/app/(dashboard)/leads/page.tsx` contains the simple Full Leads follow-up page for Growth/eligible Custom accounts.
- `src/components/settings/whatsapp-config.tsx` contains WhatsApp settings UI.
- `src/lib/whatsapp` contains encryption, Meta API, webhook signature, phone utility, and template helpers.
- `src/lib/auth` contains account/role helpers.
- `supabase/migrations` contains schema, RLS, account-sharing, WhatsApp, automations, flows, and related database migrations.

## Current Database and Tenant Model

The original schema began with user-owned tables such as contacts, conversations, messages, WhatsApp config, templates, pipelines, deals, broadcasts, automations, and flows.

Migration `017_account_sharing.sql` introduced account-based tenancy:

- `accounts`
- `profiles.account_id`
- `profiles.account_role`
- `account_invitations`
- `is_account_member(account_id, min_role)`
- `account_id` on major tenant-owned parent tables
- RLS policies based on account membership

Phase 2 decision: `accounts` is the SaaS business/tenant table. `accounts.id` / `account_id` is the `business_id` equivalent.

Reasoning:

- Account membership and RLS already protect tenant-owned data.
- WhatsApp config is already one per account.
- Team/staff roles already attach users to an account.
- A separate `businesses` table would duplicate tenant identity before the MVP needs that complexity.

Manual onboarding uses the existing signup/account bootstrap: the business owner signs up or is created in Supabase Auth, the app creates an account, and the SaaS operator configures that account through `/super-admin`.

## Target Tenant-Owned Data

Every tenant-owned table must be linked to the business tenant key. Tenant-owned data includes:

- contacts
- conversations
- messages
- leads
- products/services
- FAQs
- knowledge base entries
- business info
- bot settings
- usage logs
- WhatsApp credentials/settings
- package/settings/feature flags

Tenant isolation must be enforced by Supabase RLS where practical, not only frontend filters.

## Current WhatsApp Webhook Flow

Current inbound webhook flow:

1. `GET /api/whatsapp/webhook` verifies Meta webhook subscription using encrypted verify tokens in `whatsapp_config`.
2. `POST /api/whatsapp/webhook` reads the raw request body.
3. The route validates `x-hub-signature-256` using `META_APP_SECRET`.
4. The route parses webhook JSON.
5. Template lifecycle events are routed to the template webhook handler.
6. Status updates update message and broadcast-recipient statuses.
7. Inbound messages are matched to `whatsapp_config` by `metadata.phone_number_id`.
8. The config access token is decrypted server-side.
9. The app finds or creates the contact and conversation for the matched account.
10. The incoming message is saved.
11. Broadcast reply status may be updated.
12. Active flows and automations are dispatched.

## WhatsApp AI Reply Flow

Phase 4 extends the existing webhook without rebuilding it:

1. Receive inbound Meta webhook.
2. Identify business by `phone_number_id` or WABA/phone mapping.
3. Save incoming message.
4. Dispatch the existing Flows engine and automations.
5. If a Flow consumed the message, skip the AI bot so the existing flow can continue without duplicate bot replies.
6. Load only that account's business profile, active products/services, active knowledge entries, package settings, and bot settings.
7. Detect buying intent from the customer message.
8. Save Lead Lite metadata on the conversation, or create/update a Full Lead when the package allows it.
9. Check account bot status, conversation `bot_paused`, and monthly AI reply usage before calling an AI provider.
10. Generate a strict business-scoped reply through the AI provider adapter.
11. Save outgoing bot message.
12. Send reply through WhatsApp Cloud API.
13. Increment usage only after an AI-generated reply is sent and saved.

Package rules:

    - Starter: Lead Lite only.
    - Growth: Full Leads.
    - Custom: manual feature flags.

Fallback behavior:

- If the bot is disabled or a conversation is paused, no AI call is made and no bot reply is sent.
- If the monthly usage limit is reached, no AI call is made. The account fallback message is sent if configured, otherwise the default fallback is used.
- If the AI provider fails, the provider error is logged, the fallback message is sent, and AI usage is not incremented.

`Thank you for your message. Our team will get back to you shortly.`

## AI Provider Adapter

Phase 3 adds a server-side AI provider adapter in `src/lib/ai/provider.ts`.

Environment variables:

- `AI_PROVIDER=gemini` or `AI_PROVIDER=openai`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`

Requirements:

- No AI keys in frontend code.
- No hardcoded provider throughout the app.
- Provider-specific model settings stay separate.
- Gemini should be easy to use for testing.
- OpenAI should also be supported.

Implementation notes:

- OpenAI uses the Chat Completions API shape at `/chat/completions`.
- Gemini uses `generateContent` with `systemInstruction`.
- Optional base URL env vars allow compatible gateways/proxies.
- Missing provider env vars produce explicit server-side errors.
- The adapter is used by `/ai-test` and by the Phase 4 WhatsApp inbound AI reply handler.

## Business-Scoped Bot Rules

Phase 3 adds prompt-building logic in `src/lib/ai/prompt.ts`. The AI bot must answer only about the matched business. It can answer business-specific questions about:

- products/services
- prices
- stock/availability text
- location
- opening hours
- delivery
- payment/order instructions
- FAQs
- how to contact or follow up with the business

The bot must refuse unrelated questions politely, including general knowledge, maths, homework, jokes, coding, essays, personal advice, medical advice, legal advice, financial advice, or anything unrelated to the business.

If the bot does not know, it must not hallucinate. It should say the team will confirm and save the enquiry for follow-up.

The prompt builder loads only the current account's:

- business profile/chatbot settings
- active products/services
- active FAQ/knowledge entries
- package/bot settings

The `/ai-test` page lets a signed-in business user test a sample message against that prompt without sending WhatsApp messages.

## Business Knowledge Model

Phase 3 adds these account-scoped tables:

- `account_business_profiles`: business description, location, opening hours, services summary, delivery info, payment info, order instructions, fallback message, and bot tone.
- `account_products`: products/services with name, price text, description, availability text, category, active flag, and timestamps.
- `account_knowledge_entries`: FAQs and general knowledge entries with title, content, category, active flag, and timestamps.

All three use the existing account tenant model and RLS:

- Members can read their account's knowledge.
- Admins can manage the business profile.
- Agents and above can manage products/services and knowledge entries.

Product/service limits are enforced before insert in the dashboard server action and by the `enforce_account_product_limit` database trigger.

## Usage Tracking

Phase 2 adds `account_ai_usage_months`:

- `account_id`
- `month_start`
- `ai_replies_used`
- timestamps

Phase 4 adds `increment_account_ai_usage(account_id, month_start)` and now:

- Count AI replies per business per month.
- Enforce limits before AI provider calls.
- Avoid AI provider calls when the account has reached its monthly limit.
- Increment usage only after a generated AI reply is sent through WhatsApp and saved.
- Starter default: 1500 AI replies/month.
- Growth default: 5000 AI replies/month.
- Custom: super admin manually sets limit.
- Super admin can view current monthly usage.

## Package Feature Gating

Package settings should control:

- monthly AI reply limit
- product/service limit
- Lead Lite vs Full Leads
- full leads dashboard access
- staff/multiple-user support if enabled
- priority support label/setting if practical

All packages must allow editing products, services, FAQs, prices, and business info.

Phase 2 stores package settings on `accounts`:

- `package_type`: `starter`, `growth`, `custom`
- `monthly_ai_reply_limit`
- `product_limit`
- `bot_enabled`
- `lead_lite_enabled`
- `full_leads_enabled`
- `feature_flags`

Starter forces Lead Lite enabled and Full Leads disabled. Growth forces Lead Lite and Full Leads enabled. Custom can be manually configured.

Authenticated account admins keep update access to ordinary account fields such as `name` and `default_currency`. SaaS package columns are service-role managed through the internal `/super-admin` route, guarded by `SUPER_ADMIN_EMAILS`.

## Lead Lite vs Full Leads

Starter Lead Lite:

- Detect buying intent.
- Save lead-related metadata on the conversation:
  - `lead_intent_detected`
  - `lead_interest`
  - `lead_last_detected_at`
- Show simple interest indicators inside the conversation.
- No dedicated leads page.
- No lead board.
- No statuses, export, reminders, staff assignment, or advanced analytics.

Growth Full Leads:

- Dedicated leads page.
- Statuses: `new`, `contacted`, `won`, `lost`.
- Notes.
- Filters.
- Source conversation/message.
- Ability to update status.
- Manual follow-up workflow.
- Daily/weekly summary if practical.

Phase 4 adds the `leads` table:

- `account_id`
- `contact_id`
- `conversation_id`
- `source_message_id`
- customer name if known
- phone number
- product/service interested in
- status
- notes
- source conversation/message
- `created_at`
- `updated_at`

## Security Model

Current useful security foundations:

- Supabase RLS is used extensively.
- Account membership helper `is_account_member` gates data access.
- WhatsApp access and verify tokens are encrypted.
- Webhook POST requests validate Meta signatures using `META_APP_SECRET`.
- Supabase service-role client is used only server-side for webhook/engine work.

Target security rules:

- Sensitive WhatsApp credentials and AI keys stay server-side.
- Do not expose access tokens in frontend responses.
- Do not log full tokens.
- Validate and sanitize inputs.
- Use database-level isolation for tenant data.
- Super admin capabilities must be explicit and protected.

## Manual Onboarding Flow

MVP manual onboarding target:

1. Business owner signs up or is created in Supabase Auth, which creates an account.
2. Super admin visits `/super-admin`.
3. Super admin sets business/account name and package.
4. Super admin stores WhatsApp phone number ID, WABA ID, access token, verify token, and app secret if needed.
5. Super admin sets bot enabled/disabled.
6. Super admin sets monthly AI reply limit and product/service limit.
7. Super admin enables Lead Lite or Full Leads through package/feature settings.
8. Super admin creates or invites the business owner/admin.
9. Business owner maintains products, FAQs, services, business info, prices, delivery/payment/order instructions, and bot settings.

The internal super-admin page currently manages package settings, usage visibility, WhatsApp connection status, bot status, and lead flags. WhatsApp credential editing remains in the existing account settings flow for now; sensitive access tokens are not displayed in super-admin.

## Business Dashboard Knowledge Flow

Phase 3 dashboard routes:

- `/business-info`: account admin edits chatbot profile fields.
- `/products`: account users with agent+ role manage products/services. Product count is compared to `accounts.product_limit`.
- `/knowledge`: account users with agent+ role manage FAQs and knowledge entries.
- `/ai-test`: signed-in account users test the business-scoped AI reply with no WhatsApp send.

Phase 4 dashboard route:

- `/leads`: Growth and Full-Leads-enabled Custom accounts can filter leads by status, update status/notes, and open the source inbox conversation. Starter users keep Lead Lite indicators in `/inbox` only and do not see the Leads nav item.

## Future Embedded Signup Placeholder

Embedded Signup is planned later as a self-serve onboarding flow. It is documented in `docs/FUTURE_EMBEDDED_SIGNUP.md` and must not be implemented during the manual-onboarding MVP phase.
