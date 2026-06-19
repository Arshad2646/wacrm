# Architecture

## Current App Structure

The current codebase is a Next.js 16 App Router application with React 19, TypeScript, Tailwind CSS 4, Supabase, and Vitest.

Important areas:

- `src/app/(dashboard)` contains authenticated dashboard pages.
- `src/app/api` contains server route handlers.
- `src/app/api/whatsapp/webhook/route.ts` handles Meta webhook verification, inbound messages, status updates, template webhook events, conversation/message persistence, automation dispatch, and flow dispatch.
- `src/lib/ai/whatsapp-bot.ts` runs the Phase 4 inbound WhatsApp AI reply flow after the webhook saves a customer message.
- `src/app/api/ai-test/chat/route.ts` provides a server-side AI chat simulator endpoint for `/ai-test`.
- `src/app/api/super-admin/status/route.ts` returns the current user's env-gated super-admin status to dashboard chrome.
- `src/app/api/whatsapp/config/route.ts` saves and verifies WhatsApp Cloud API configuration.
- `src/app/api/whatsapp/send/route.ts` sends manual WhatsApp replies from the dashboard.
- `src/app/api/conversations/[id]/bot-pause/route.ts` pauses/resumes AI for one conversation after an agent+ role check.
- `src/components/inbox` contains the conversation inbox UI.
- `src/components/ai-test/ai-chat-tester.tsx` contains the WhatsApp-style local AI test chat UI.
- `src/app/(dashboard)/leads/page.tsx` contains the simple Full Leads follow-up page for Growth/eligible Custom accounts.
- `src/app/(dashboard)/needs-reply/page.tsx` contains the Starter-friendly human attention queue.
- `src/app/(dashboard)/bot-settings/page.tsx` contains the business-admin account-wide bot switch.
- `src/app/(dashboard)/usage/page.tsx` shows package, monthly AI usage, product/service count, bot status, lead mode, and WhatsApp readiness for the current account.
- `src/components/settings/whatsapp-config.tsx` contains WhatsApp settings UI.
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, and `src/app/data-deletion/page.tsx` provide simple public pages required for Meta production setup.
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
13. Reserve monthly AI usage atomically before provider work and refund the reservation if provider/send/save fails.

Inbound customer messages use Meta `message_id` as an idempotency key within the conversation. Duplicate deliveries are ignored before unread counts, flows, automations, or AI side effects run.

Package rules:

- Starter: Lead Lite only.
- Growth: Full Leads.
- Custom: manual feature flags.

Fallback behavior:

- If the bot is disabled or a conversation is paused, no AI call is made and no bot reply is sent.
- If the monthly usage limit is reached, no AI call is made. The account fallback message is sent if configured, otherwise the default fallback is used.
- If the AI provider fails, the provider error is logged, the fallback message is sent, and AI usage is not incremented.
- A successful manual dashboard reply sets `conversations.bot_paused = true`, handing that chat to a human until staff resume the bot in the inbox.

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

Before provider calls, the prompt builder truncates oversized business fields, product/service fields, FAQ/knowledge fields, transcript turns, and customer messages so one saved knowledge entry cannot create an unbounded token/cost/latency event.

The `/ai-test` page lets a signed-in business user test a local WhatsApp-style conversation against that prompt without sending WhatsApp messages. The browser keeps the temporary transcript, and `/api/ai-test/chat` sends the recent turns to the AI provider through server-side code.

## Business Knowledge Model

Phase 3 adds these account-scoped tables:

- `account_business_profiles`: business description, location, opening hours, services summary, delivery info, payment info, order instructions, fallback message, and bot tone.
- `account_products`: products/services with name, price text, description, availability text, category, active flag, and timestamps.
- `account_knowledge_entries`: FAQs and general knowledge entries with title, content, category, active flag, and timestamps.

All three use the existing account tenant model and RLS:

- Members can read their account's knowledge.
- Admins can manage the business profile.
- Agents and above can manage products/services and knowledge entries.

Product/service limits are enforced before insert in the dashboard server action and by the `enforce_account_product_limit` database trigger. The security hardening migration redefines that trigger to lock the parent account row before counting products, so concurrent inserts for one account cannot race past the configured package limit.

## Usage Tracking

Phase 2 adds `account_ai_usage_months`:

- `account_id`
- `month_start`
- `ai_replies_used`
- timestamps

Phase 4 added monthly usage buckets. The security hardening pass adds atomic reservation/refund RPCs, so the current behavior is:

- Count AI replies per business per month.
- Enforce limits before AI provider calls.
- Avoid AI provider calls when the account has reached its monthly limit.
- Reserve one usage unit atomically before an AI provider call.
- Refund the reserved unit when provider generation or WhatsApp send/save fails.
- The `/ai-test` route distinguishes a real limit block from a reservation
  setup/RPC failure, so missing migrations or service-role configuration do not
  appear as a false "limit reached" error.
- Starter default: 1500 AI replies/month.
- Growth default: 5000 AI replies/month.
- Custom: super admin manually sets limit.
- Super admin can view current monthly usage.
- Business users can view current monthly usage and package readiness from `/usage`.

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

When a super admin edits an existing account, `/super-admin` includes an "Apply selected package defaults" checkbox. For Starter and Growth, this resets monthly AI reply limit, product/service limit, and lead flags to the selected package defaults. For Custom, limits and flags remain manual.

Advanced CRM tools use `accounts.feature_flags.advanced_crm_tools_enabled`. The flag defaults off, is managed only by super admin, and is forced off for Starter. Growth and Custom accounts can receive the feature later when the SaaS operator intentionally enables it.

## Lead Lite vs Full Leads

Starter Lead Lite:

- Detect buying intent.
- Save lead-related metadata on the conversation:
  - `lead_intent_detected`
  - `lead_interest`
  - `lead_last_detected_at`
- Show simple interest indicators inside the conversation.
- Surface unread, AI-paused, and buying-intent chats in `/needs-reply`.
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
- Migration `026_security_hardening.sql` adds least-privilege execution grants for account-membership helpers and additional tenant-consistency triggers for cross-table references.
- Authenticated clients can update only safe profile display columns; `profiles.account_id` and `profiles.account_role` are treated as trusted server/database-managed fields.
- WhatsApp access and verify tokens are encrypted.
- Authenticated clients receive only safe `whatsapp_config` metadata columns; encrypted `access_token` and `verify_token` are reserved for service-role server routes after role checks.
- Webhook POST requests validate Meta signatures using `META_APP_SECRET`.
- Inbound customer WhatsApp messages are deduplicated by conversation and Meta message id before side effects run.
- Supabase service-role client is used only server-side for webhook/engine work.
- Authenticated dashboard/app HTML routes are private `no-store` by default; only known public pages receive short public CDN caching.
- Manual WhatsApp send/reaction routes require `agent` or higher before any Meta API call.
- WhatsApp config save/reset requires `admin` or higher before any Meta verification, registration, subscription, save, or reset.
- Account-wide bot control requires `admin` or higher. Conversation-level bot pause/resume requires `agent` or higher.
- The WhatsApp settings UI selects only safe metadata columns and does not load encrypted token columns into browser state.
- Advanced CRM app routes, runtime engines, and RLS policies are gated by `advanced_crm_tools_enabled`; Starter is always blocked.
- Advanced CRM automation webhook steps require HTTPS public destinations, block local/private/link-local DNS results at runtime, disable redirects, and can be restricted further with `AUTOMATION_WEBHOOK_ALLOWED_HOSTS`.
- Full Leads app visibility and RLS policies use package-aware gating: Growth is allowed by package, Custom is allowed only when enabled, and Starter is blocked.
- Staff invitation APIs and invitation redemption are gated so Starter accounts cannot add extra members.
- Service-role writes in the WhatsApp bot/send/webhook paths are explicitly scoped by `account_id` where practical.
- AI test chat and inbound WhatsApp AI reserve monthly usage server-side before provider calls, refund failed attempts, and cap prompt/transcript size before provider calls.
- API routes log detailed Meta/database errors server-side but return generic client-facing errors for provider or persistence failures.

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
10. Business owner/admin can turn the account-wide AI bot on/off from `/bot-settings`; staff can pause/resume AI per conversation from the inbox.

The internal super-admin page currently manages package settings, usage visibility, WhatsApp connection status, bot status, and lead flags. WhatsApp credential editing remains in the existing account settings flow for now; sensitive access tokens are not displayed in super-admin.

The dashboard chrome calls `/api/super-admin/status` after sign-in and shows a Super Admin nav item, header badge, and account-menu link only when the current user's email is listed in `SUPER_ADMIN_EMAILS`. This client-visible flag is only a usability signal; all privileged reads/writes still call `requireSuperAdmin()` on the server.

Super admins can also create a business owner from `/super-admin`. The action uses Supabase Admin Auth to create the owner user, relies on the existing signup trigger to create the account/profile, and then applies package defaults to the resulting account.

The Businesses section is rendered as responsive account cards rather than a wide data table so package, usage, WhatsApp, limit, and feature-gate controls remain readable on normal dashboard widths.

## Business Dashboard Knowledge Flow

Phase 3 dashboard routes:

- `/business-info`: account admin edits chatbot profile fields.
- `/products`: account users with agent+ role manage products/services. Product count is compared to `accounts.product_limit`.
- `/knowledge`: account users with agent+ role manage FAQs and knowledge entries.
- `/ai-test`: signed-in account users test a WhatsApp-style chat flow with account-scoped AI replies and no WhatsApp send.

Phase 4 dashboard route:

- `/leads`: Growth and Full-Leads-enabled Custom accounts can filter leads by status, update status/notes, and open the source inbox conversation. Starter users keep Lead Lite indicators in `/inbox` only and do not see the Leads nav item.

Phase 5 dashboard polish:

- Primary navigation is simplified for the WhatsApp AI sales assistant workflow: Dashboard, Conversations, Needs Reply, Business Info, Products & Services, FAQs / Knowledge, Test Bot Reply, Bot Settings, Usage, and Leads only when Full Leads is enabled.
- Legacy CRM routes such as contacts, pipelines, broadcasts, automations, and flows remain in the codebase and are grouped under an "Advanced CRM tools" sidebar disclosure only when `advanced_crm_tools_enabled` is true for a non-Starter account. They are secondary opt-in tools, not part of the default MVP owner workflow.
- `/usage` gives business users a non-admin view of monthly AI replies, product/service limits, bot status, lead mode, and WhatsApp readiness.
- `/bot-settings` gives owners/admins the account-wide bot switch plus usage and handoff context.
- `/needs-reply` lists unread customer chats, AI-paused chats, and buying-intent chats for human follow-up. Starter gets this queue without the Full Leads board.
- `/settings` includes a concise explanation grid for Profile, WhatsApp, Templates, Tags, Custom Fields, Deals, Appearance, and Members.
- README plus `docs/QA_CHECKLIST.md`, `docs/FIRST_CLIENT_ONBOARDING.md`, and `docs/PRODUCTION_READINESS.md` document manual testing and first-client onboarding.

Middleware redirects direct visits to advanced CRM pages back to `/dashboard` when the flag is off, and returns `403` for key advanced API routes. Supabase RLS still protects tenant-owned rows; the feature flag controls product release/visibility.

## Public Legal Pages

Phase 5 adds simple editable public pages:

- `/privacy`
- `/terms`
- `/data-deletion`

These are placeholders for Meta production setup and should be reviewed by the SaaS operator before public launch.

## Future Embedded Signup Placeholder

Embedded Signup is planned later as a self-serve onboarding flow. It is documented in `docs/FUTURE_EMBEDDED_SIGNUP.md` and must not be implemented during the manual-onboarding MVP phase.
