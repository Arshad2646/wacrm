# Tasks

## Done

- Inspected the repository structure for Phase 1.
- Confirmed the app is a Next.js 16, React 19, TypeScript, Supabase, Tailwind CSS 4 project.
- Confirmed package scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `test`, `test:watch`.
- Confirmed existing useful CRM features: shared inbox, contacts, deals/pipelines, broadcasts, automations, flows, team/account roles, WhatsApp Cloud API config, encrypted tokens, webhook verification, webhook signature validation, and account-scoped RLS.
- Created Phase 1 project memory/docs for the WhatsApp AI chatbot SaaS direction.
- Added future Embedded Signup documentation without implementing it.
- Added implementation plan documentation based on the inspected repo.
- Added AI provider environment variable examples for Gemini/OpenAI flexibility.
- Added a README pointer to the SaaS MVP project memory.
- Completed Phase 1 without changing database schema or application behavior.
- Completed Phase 2 tenant/package foundation.
- Decided to use existing `accounts.id` / `account_id` as the SaaS business tenant key.
- Added account package settings for Starter, Growth, and Custom.
- Added monthly AI usage bucket table foundation.
- Added `/super-admin` internal page guarded by `SUPER_ADMIN_EMAILS`.
- Added database privilege narrowing so ordinary authenticated users cannot update SaaS package/limit columns directly.
- Completed Phase 3 knowledge and AI provider foundation.
- Added account-scoped business profile, products/services, and FAQ/knowledge tables.
- Added product/service dashboard editing with server-side product limit enforcement.
- Added business info and FAQ/knowledge dashboard editing.
- Added Gemini/OpenAI server-side AI provider adapter.
- Added strict business-scoped prompt builder and AI test page that does not send WhatsApp messages.
- Completed Phase 4 WhatsApp AI reply and leads foundation.
- Wired inbound WhatsApp messages to the account-scoped AI handler after message save and flow dispatch.
- Enforced bot enabled, conversation bot pause, and monthly AI usage limits before AI provider calls.
- Saved/sent outgoing bot replies through WhatsApp Cloud API and incremented monthly usage only after successful AI-generated sends.
- Added deterministic buying-intent detection.
- Added Starter Lead Lite conversation indicators.
- Added Growth/Custom Full Leads storage and a simple `/leads` page with status filters, notes, and source conversation links.
- Fixed fresh Supabase migration setup so UUID defaults use `extensions.uuid_generate_v4()` on hosted Supabase.
- Fixed pre-Phase-5 super-admin visibility by surfacing env-gated operator mode in the dashboard chrome, adding a status API, and adding manual business-owner creation from `/super-admin`.
- Replaced the single-message `/ai-test` flow with a WhatsApp-style chat simulator that keeps local conversation history and sends transcript-aware test prompts through a server route.
- Completed Phase 5 MVP polish and documentation.
- Simplified primary dashboard navigation around the chatbot SaaS workflow.
- Added `/usage` for business-facing package, AI usage, product/service count, bot status, lead mode, and WhatsApp readiness.
- Added public `/privacy`, `/terms`, and `/data-deletion` pages for Meta setup.
- Added `docs/QA_CHECKLIST.md`, `docs/PRODUCTION_READINESS.md`, and `docs/FIRST_CLIENT_ONBOARDING.md`.
- Expanded README setup instructions for Supabase, migrations, super admin access, Gemini/OpenAI, Meta WhatsApp, manual onboarding, usage limits, and safe WhatsApp testing.
- Added targeted tests for package gates, product limits, and `SUPER_ADMIN_EMAILS` parsing.
- Fixed existing-account package changes in `/super-admin` so Starter/Growth package defaults can apply reply/product limits automatically on save.
- Added settings explanations for Profile, WhatsApp, Templates, Tags, Custom Fields, Deals, Appearance, and Members.
- Reintroduced legacy CRM modules in the sidebar under an "Advanced CRM tools" disclosure instead of removing them.
- Added a super-admin feature flag for Advanced CRM tools, default off and forced unavailable for Starter.
- Gated Advanced CRM sidebar visibility, page routes, and key advanced API routes behind that feature flag.
- Reworked the `/super-admin` Businesses section from a wide table into compact responsive business cards.
- Added `/bot-settings` so business owners/admins can turn the account-wide AI bot on/off without using `/super-admin`.
- Added `/needs-reply` as a simple human-attention queue for unread chats, AI-paused chats, and buying-intent chats.
- Added a conversation-level bot pause/resume API and inbox controls for staff with message-send permission.
- Updated manual WhatsApp replies so a successful human reply pauses AI for that specific conversation.
- Confirmed package usage limit logic blocks AI calls before provider calls when monthly limits are reached.
- Hardened WhatsApp send, reaction, and config mutation routes so role checks happen before Meta API side effects.
- Stopped the WhatsApp settings UI from selecting encrypted access/verify token columns into browser state.
- Verified the reported `/super-admin` `Table is not defined` runtime error is stale relative to the current source: the page no longer renders a `Table` at that line and `npm run typecheck` passes.
- Fixed the advanced CRM feature-gate helper type so `npm run typecheck` passes after the stale `/super-admin` log check.
- Added focused security hardening for package/feature gates, staff invites, WhatsApp token column privileges, Advanced CRM/Full Leads RLS gates, tenant-consistency triggers, service-role writes, AI test usage limits, and generic client-facing API errors.
- Centralized Full Leads and multiple-user package checks so Starter cannot receive Full Leads or staff invites through direct API calls, Growth receives Full Leads by package, and Custom uses its manual flag.
- Added targeted security tests for package gates, automations Advanced CRM gating, WhatsApp token grants, Full Leads/staff DB helpers, and tenant-consistency trigger coverage.
- Completed a subagent-backed security review of auth/RLS, account APIs, WhatsApp routes, AI usage, and Advanced CRM automation surfaces.
- Fixed profile trust-column privileges so authenticated clients cannot directly self-edit `profiles.account_id` or `profiles.account_role`.
- Added atomic AI usage reservation/refund RPCs and wired `/api/ai-test/chat` plus inbound WhatsApp AI replies to reserve before provider calls.
- Added inbound WhatsApp message idempotency so duplicate Meta deliveries do not rerun unread-count, flow, automation, or AI side effects.
- Hardened Advanced CRM automation webhook steps against SSRF with HTTPS-only validation, local/private destination blocking, runtime DNS checks, disabled redirects, and optional `AUTOMATION_WEBHOOK_ALLOWED_HOSTS`.
- Added prompt-size truncation for business profile, products/services, FAQ/knowledge, transcript, and customer-message text before AI provider calls.
- Added targeted tests for profile privilege grants, usage reservation, webhook replay handling, automation webhook URL validation, and prompt truncation.
- Fixed private-route caching so dashboard/auth/app HTML routes are `private, no-cache, no-store` by default and only known public pages receive short public CDN caching.
- Serialized product/service package-limit enforcement by locking the parent account row in the product-limit trigger before counting existing products.
- Added focused tests for Next.js cache headers and serialized product-limit SQL hardening.
- Fixed `/ai-test` usage-limit error handling so a Supabase RPC/setup failure is no longer shown as "Monthly AI reply limit reached."

## In Progress

- None.

## Next

- Run the manual QA checklist against a real Supabase project and a Meta test WhatsApp number.
- Onboard the first controlled pilot client using `docs/FIRST_CLIENT_ONBOARDING.md`.
- Review and replace MVP legal placeholder copy before public production launch.
- Consider deeper webhook integration tests with mocked Supabase/Meta/AI clients.
- After changing an existing account's package in `/super-admin`, confirm `/usage`, `/products`, and `/leads` reflect the new limits and feature gates.
- For Growth/Custom accounts, enable "Show Advanced CRM tools" in `/super-admin` only when you intentionally want those users to see Contacts, Pipelines, Broadcasts, Automations, and Flows.
- Visually confirm the new `/super-admin` Businesses card layout while signed in as a super admin.
- If the old `/super-admin` `Table is not defined` overlay persists in the browser after reload, restart `npm run dev` to clear the stale compiled page state.
- Test `/bot-settings`, `/needs-reply`, and inbox Pause/Resume Bot controls against the real Supabase project.
- Test real inbound WhatsApp behavior after a manual reply pauses a conversation, then after resuming the bot.
- Apply `supabase/migrations/026_security_hardening.sql` to the real Supabase project and verify RLS/column privileges there.
- If `/ai-test` shows "AI usage check failed," verify `supabase/migrations/026_security_hardening.sql` has been pushed and `SUPABASE_SERVICE_ROLE_KEY` is set on the running app.
- If `supabase db push` reports duplicate inbound customer message IDs, clean those duplicate rows before applying the new WhatsApp idempotency unique index.
- Consider setting `AUTOMATION_WEBHOOK_ALLOWED_HOSTS` before enabling Advanced CRM webhook steps for customers.
- Confirm deployed responses for `/dashboard`, `/inbox`, `/super-admin`, and other authenticated pages include private no-store cache headers after deployment.

## Blocked

- Repo-wide `npm run format:check` reports pre-existing formatting differences across 180 files, including legacy app files and `supabase/.temp/linked-project.json`. Touched Markdown/TS/TSX files were formatted with targeted Prettier.
- The sandboxed `npm run build` cannot fetch the configured Google Font without network access. The network-approved build passed.

## Risks

- Current CRM features are broader than the MVP. Future phases must simplify navigation/package visibility without deleting useful reusable code too early.
- AI reply generation must be strictly business-scoped to avoid hallucinations or unrelated answers.
- Usage limits must be enforced before AI provider calls to control cost.
- WhatsApp and AI credentials must remain server-only and must not be exposed through dashboard APIs.
- Business owners with direct database access must not be able to change package limits. Migration `023_saas_account_settings.sql` narrows `accounts` UPDATE privileges so package columns are service-role managed.
- The AI test page calls the configured provider directly; missing or invalid AI env vars will show an error instead of sending anything to WhatsApp.
- Current Phase 4 webhook integration skips AI when an active Flow consumes the inbound message. Existing automations can still run as before, so accounts using automations and AI together should be tested carefully for duplicate responses.
- Lead detection is deterministic keyword/product matching for MVP reliability; it may need tuning with real Botswana/Southern Africa customer phrasing after pilot usage.
- Public legal pages are MVP placeholders and need operator/legal review before production use.
- The MVP still relies on manual onboarding; Embedded Signup and billing are intentionally not implemented.
- Advanced CRM tools remain broader than the core chatbot MVP and are intentionally opt-in for selected non-Starter accounts only.
- `whatsapp_config` tokens are encrypted, no longer selected by the normal settings UI, and migration `026_security_hardening.sql` narrows authenticated column privileges. Verify these privileges on the remote Supabase project after pushing migrations.
- The new WhatsApp idempotency unique index can fail to apply if the existing remote database already has duplicate inbound customer messages in the same conversation.
- Advanced CRM webhook steps are intentionally powerful. Keep the Advanced CRM flag off by default and use `AUTOMATION_WEBHOOK_ALLOWED_HOSTS` when enabling webhook steps for customers.
