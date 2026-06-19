# Worklog

## 2026-06-16

What changed:

- Started Phase 1 only.
- Inspected repository structure, package scripts, existing docs, environment example, Supabase migrations, auth/account helpers, WhatsApp config route, WhatsApp send route, webhook route, sidebar navigation, and shared types.
- Created project memory files for the SaaS pivot.
- Created architecture and future Embedded Signup docs.
- Created implementation plan documentation.
- Added Gemini/OpenAI AI provider environment variable examples to `.env.local.example`.
- Added a README pointer to the SaaS MVP docs.

Files changed:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/FUTURE_EMBEDDED_SIGNUP.md`
- `.env.local.example`
- `README.md`

Checks run:

- Repository inspection commands only so far.
- No application tests were required for the documentation-only Phase 1 changes.
- Attempted `npx prettier --check` on touched docs/env files, but it tried to reach `registry.npmjs.org` and failed because network is restricted.
- Attempted local `./node_modules/.bin/prettier --check`, but `node_modules` is not installed in this checkout.
- Reviewed git status/diff and sampled generated docs.

What remains:

- Phase 2 remains unimplemented by instruction.
- Before code-changing tasks, install dependencies and re-check whether `node_modules/next/dist/docs/` exists.

## 2026-06-16 Phase 2

What changed:

- Reused `accounts.id` / `account_id` as the SaaS business tenant model.
- Added account package settings and feature gates through migration `023_saas_account_settings.sql`.
- Added `account_ai_usage_months` for monthly AI reply usage tracking.
- Added package defaults/helper logic in `src/lib/saas/packages.ts`.
- Added env-gated super-admin helper in `src/lib/auth/super-admin.ts`.
- Added internal `/super-admin` page for manual account/package management.
- Added `SUPER_ADMIN_EMAILS` example env var.
- Updated README and architecture/memory docs.

Files changed:

- `.env.local.example`
- `README.md`
- `DECISIONS.md`
- `TASKS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `supabase/migrations/023_saas_account_settings.sql`
- `src/app/(dashboard)/super-admin/page.tsx`
- `src/lib/auth/super-admin.ts`
- `src/lib/saas/packages.ts`
- `src/types/index.ts`

Checks run:

- Installed dependencies with `npm install` so local checks could run.
- Read relevant local Next.js 16 docs after dependencies were installed:
  - `node_modules/next/dist/docs/01-app/02-guides/forms.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `npm run typecheck` passed.
- `npm run lint` passed with 19 existing warnings.
- `npm run test` passed: 27 files, 400 tests.
- `npm run build` passed after providing dummy local Supabase/secret env values and allowing network for the Google font fetch.
- `npm run format:check` failed repo-wide due pre-existing formatting differences across many files.
- Targeted `npx prettier --check` passed for touched Markdown/TS/TSX files. `.env.local.example` was excluded because Prettier cannot infer a parser for env example files.

What remains:

- Phase 3 product/service tables and editors.
- Product count display and product limit enforcement once those tables exist.
- AI provider adapter and AI reply engine.
- WhatsApp webhook AI routing and usage increments.

## 2026-06-16 Phase 3

What changed:

- Added account-scoped business profile, products/services, and FAQ/knowledge database tables.
- Added RLS policies for business knowledge tables.
- Added database product-limit trigger for `account_products`.
- Added `/business-info` page for chatbot profile and business settings.
- Added `/products` page for product/service management with package product limit display and server-side insert checks.
- Added `/knowledge` page for FAQ/knowledge entry management.
- Added `/ai-test` page for provider-backed AI reply testing without WhatsApp sends.
- Added server-side Gemini/OpenAI provider adapter.
- Added strict business-scoped prompt builder and prompt unit test.
- Added dashboard navigation links for Business Info, Products, Knowledge, and AI Test.
- Updated architecture and planning docs.

Files changed:

- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `supabase/migrations/024_business_knowledge_ai_foundation.sql`
- `src/app/(dashboard)/ai-test/page.tsx`
- `src/app/(dashboard)/business-info/page.tsx`
- `src/app/(dashboard)/knowledge/page.tsx`
- `src/app/(dashboard)/products/page.tsx`
- `src/components/layout/sidebar.tsx`
- `src/lib/ai/chatbot.ts`
- `src/lib/ai/prompt.test.ts`
- `src/lib/ai/prompt.ts`
- `src/lib/ai/provider.ts`
- `src/lib/knowledge/load.ts`
- `src/lib/knowledge/types.ts`

Checks run:

- `npm run typecheck` passed.
- `npm run lint` passed with 19 existing warnings.
- `npm run test` passed: 28 files, 401 tests.
- `npm run build` passed after providing dummy local Supabase/secret env values and allowing network for the Google font fetch.
- Targeted `npx prettier --check` passed for touched Markdown/TS/TSX files.

What remains:

- Phase 4 WhatsApp webhook AI reply routing.
- Usage-limit checks before real AI calls.
- Save outgoing AI replies to conversations and send through WhatsApp Cloud API.
- Lead Lite metadata and Growth Full Leads creation/update.

## 2026-06-16 23:03 CAT Phase 4

What changed:

- Extended the existing WhatsApp webhook to hand saved inbound customer text messages to the account-scoped AI bot handler.
- Added server-side AI reply decisioning for bot disabled, conversation paused, missing text, and monthly usage limit states.
- Added fallback sending for usage-limit/provider-error cases without counting fallback replies as AI usage.
- Added atomic monthly usage increment RPC and used it only after successful AI-generated WhatsApp sends.
- Added deterministic buying-intent detection using customer text plus active product/service names.
- Added Starter Lead Lite metadata on conversations and an inbox interest badge.
- Added account-scoped Full Leads storage for Growth and enabled Custom accounts.
- Added `/leads` page with status filters, notes editing, and source conversation links.
- Hid the Leads sidebar item unless the signed-in account has Full Leads enabled.

Files changed:

- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `supabase/migrations/025_whatsapp_ai_leads.sql`
- `src/app/(dashboard)/leads/page.tsx`
- `src/app/api/whatsapp/webhook/route.ts`
- `src/components/inbox/message-thread.tsx`
- `src/components/layout/sidebar.tsx`
- `src/hooks/use-auth.tsx`
- `src/lib/ai/whatsapp-bot.ts`
- `src/lib/ai/whatsapp-bot.test.ts`
- `src/lib/leads/detect.ts`
- `src/lib/leads/detect.test.ts`
- `src/types/index.ts`

Checks run:

- Read local Next.js 16 route handler and page docs relevant to the touched App Router files.
- `npm run typecheck` passed.
- Targeted tests passed: `npm test -- src/lib/ai/whatsapp-bot.test.ts src/lib/leads/detect.test.ts src/lib/ai/prompt.test.ts`.
- `npm test` passed: 30 files, 410 tests.
- `npm run lint` passed with 19 existing warnings.
- Targeted `npx prettier --write` was run on touched TS/TSX files and the new migration path.
- Initial `npm run build` failed in the restricted sandbox because Next could not fetch Google Fonts.
- Network-approved `npm run build` then compiled but failed because Supabase env vars were absent in the shell.
- Final build passed with dummy local Supabase/secret env values and approved network access for the Google font fetch.

What remains:

- Phase 5 UI cleanup and final MVP polish.
- Public `/privacy`, `/terms`, and `/data-deletion` pages for Meta production setup.
- README setup/admin instructions for applying migrations and testing the WhatsApp AI SaaS flow.
- Deeper webhook integration tests with mocked Supabase/Meta/AI clients if practical.
- Real-world tuning of deterministic lead detection after pilot conversations.

## 2026-06-17 14:28 CAT Supabase Migration Fix

What changed:

- Fixed fresh Supabase `db push` failure where `uuid_generate_v4()` was not found because hosted Supabase exposes `uuid-ossp` functions through the `extensions` schema.
- Added `CREATE SCHEMA IF NOT EXISTS extensions` and installed `uuid-ossp` with `WITH SCHEMA extensions`.
- Qualified all migration UUID defaults as `extensions.uuid_generate_v4()`.

Files changed:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/006_automations.sql`
- `supabase/migrations/009_message_actions.sql`
- `supabase/migrations/010_flows.sql`
- `supabase/migrations/017_account_sharing.sql`
- `supabase/migrations/023_saas_account_settings.sql`
- `supabase/migrations/024_business_knowledge_ai_foundation.sql`
- `supabase/migrations/025_whatsapp_ai_leads.sql`
- `WORKLOG.md`

Checks run:

- Searched all migrations for `uuid_generate_v4()` usage and confirmed remaining calls are schema-qualified.

What remains:

- User should rerun `supabase db push` against the fresh remote project.

## 2026-06-17 15:05 CAT Business Info Runtime Warning Fix

What changed:

- Fixed Base UI uncontrolled `FieldControl` warning after saving `/business-info` by keying the form on the loaded profile timestamp so inputs remount when server defaults change after revalidation.

Files changed:

- `src/app/(dashboard)/business-info/page.tsx`
- `WORKLOG.md`

Checks run:

- `npm run typecheck` passed.

What remains:

- User should retry saving business info in the running dev app.

## 2026-06-17 16:12 CAT Pre-Phase 5 Super Admin and AI Test Fixes

What changed:

- Added `/api/super-admin/status` so dashboard chrome can tell the signed-in operator when `SUPER_ADMIN_EMAILS` is active.
- Surfaced Super Admin mode in the sidebar, header badge, and account dropdown.
- Expanded `/super-admin` with summary cards, product counts, and a manual business-owner creation form backed by Supabase Admin Auth.
- Kept privileged super-admin data and writes server-side through `requireSuperAdmin()` and the service-role client.
- Added transcript-aware business-scoped prompt building for AI test conversations.
- Added `/api/ai-test/chat` so AI test messages call the provider through a server route.
- Replaced the single-message `/ai-test` page with a WhatsApp-style local chat simulator that keeps recent context and shows provider/model plus prompt preview.

Files changed:

- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `src/app/(dashboard)/ai-test/page.tsx`
- `src/app/(dashboard)/super-admin/page.tsx`
- `src/app/api/ai-test/chat/route.ts`
- `src/app/api/super-admin/status/route.ts`
- `src/components/ai-test/ai-chat-tester.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `src/hooks/use-auth.tsx`
- `src/lib/ai/chatbot.ts`
- `src/lib/ai/prompt.ts`
- `src/lib/ai/prompt.test.ts`
- `src/lib/auth/super-admin.ts`

Checks run:

- Read relevant local Next.js 16 route handler docs before adding new route handlers.
- `npm run typecheck` passed.
- `npm test -- src/lib/ai/prompt.test.ts` passed.
- `npm test` passed: 30 files, 411 tests.
- `npm run lint` passed with the existing 19 warnings.
- `npm run build` passed with dummy local Supabase/secret env values and approved network access for the Google font fetch.
- Targeted `npx prettier --write` ran on touched TS/TSX files.

What remains:

- User should restart or let `npm run dev` hot-reload, then confirm `/super-admin` appears in navigation for a `SUPER_ADMIN_EMAILS` user and `/ai-test` behaves as a multi-turn chat.
- Phase 5 can proceed after this pre-Phase-5 fix is accepted.

## 2026-06-17 16:38 CAT Phase 5 MVP Polish and QA Prep

What changed:

- Simplified the dashboard navigation for the WhatsApp AI chatbot SaaS MVP.
- Renamed owner-facing labels to Conversations, Products & Services, FAQs / Knowledge, Test Bot Reply, and Usage.
- Kept Leads visible only for Full-Leads-enabled accounts.
- Added `/usage` so business users can see their package, monthly AI reply usage, product/service count, bot status, lead mode, and WhatsApp readiness.
- Updated dashboard quick actions to point at chatbot setup/testing workflows instead of legacy CRM modules.
- Added public `/privacy`, `/terms`, and `/data-deletion` pages for Meta setup.
- Added manual QA, production readiness, and first-client onboarding docs.
- Expanded README setup guidance for Supabase, migrations, super admin access, Gemini/OpenAI, Meta WhatsApp setup, manual onboarding, AI testing, safe WhatsApp testing, usage limits, and Lead Lite vs Full Leads.
- Added targeted tests for package gates, product limits, and `SUPER_ADMIN_EMAILS` parsing.
- Recorded Phase 5 decisions and architecture updates.

Files changed:

- `README.md`
- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/QA_CHECKLIST.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/FIRST_CLIENT_ONBOARDING.md`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/products/page.tsx`
- `src/app/(dashboard)/usage/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/data-deletion/page.tsx`
- `src/components/dashboard/quick-actions.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `src/lib/auth/super-admin.test.ts`
- `src/lib/saas/packages.test.ts`
- `src/lib/saas/product-limits.ts`
- `src/lib/saas/product-limits.test.ts`
- `src/middleware.ts`

Checks run:

- Targeted `npx prettier --write` ran on touched Markdown/TS/TSX files.
- `npm run typecheck` passed.
- `npm run lint` passed with existing warnings only.
- `npm run test` passed: 33 files, 421 tests.
- First sandboxed `npm run build` failed because Next/Turbopack could not fetch Google Fonts.
- Network-approved `npm run build` passed with dummy local Supabase/secret env values.
- `npm run format:check` still failed because of pre-existing repo-wide formatting differences across many files, including legacy source files and Supabase temp files.

What remains:

- Run `docs/QA_CHECKLIST.md` against a real Supabase project and Meta test WhatsApp number.
- Onboard the first controlled pilot client with `docs/FIRST_CLIENT_ONBOARDING.md`.
- Replace/review MVP legal placeholder copy before public production use.
- Add deeper mocked webhook integration tests if the next phase focuses on hardening.

## 2026-06-17 19:02 CAT Super Admin Package Defaults and Settings Clarity

What changed:

- Fixed existing-account package tier changes in `/super-admin` so Starter/Growth defaults can be applied on save.
- Added a package-settings resolver that resets reply limits, product/service limits, and lead flags for Starter/Growth while keeping Custom manual.
- Added tests for package default application and Custom manual behavior.
- Added explanatory cards to `/settings` for Profile, WhatsApp, Templates, Tags, Custom Fields, Deals, Appearance, and Members.
- Added an "Advanced CRM tools" disclosure in the sidebar for Contacts, Pipelines, Broadcasts, Automations, and Flows. These modules are still present; they are just secondary to the chatbot SaaS workflow.
- Updated task, decision, and architecture memory.

Files changed:

- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `src/app/(dashboard)/super-admin/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/components/layout/sidebar.tsx`
- `src/lib/saas/packages.ts`
- `src/lib/saas/packages.test.ts`

Checks run:

- Targeted `npx prettier --write` ran on touched TS/TSX files.
- `npm run typecheck` passed.
- `npm test -- src/lib/saas/packages.test.ts` passed.
- `npm run lint` passed with existing warnings only.
- `npm run build` passed with dummy local Supabase/secret env values and approved network access for the Google font fetch.

What remains:

- In the browser, change an existing account from Starter to Growth in `/super-admin` with "Apply selected package defaults" checked, then confirm the row updates to 5000 replies/month, 100 products/services, and Full Leads.
- For Custom accounts, confirm manual limits remain manual.
- Test the real WhatsApp webhook once Meta credentials/test number are ready.

## 2026-06-17 19:15 CAT Advanced CRM Tools Release Gate

What changed:

- Added `advanced_crm_tools_enabled` as an account feature flag stored in `accounts.feature_flags`.
- Added a `/super-admin` checkbox to enable Advanced CRM tools for selected accounts.
- Forced Advanced CRM tools off for Starter accounts even if the flag is submitted manually.
- Hid the Advanced CRM tools sidebar group unless the current account is Growth/Custom and the feature flag is enabled.
- Gated direct page access to Contacts, Pipelines, Broadcasts, Automations, and Flows when the feature is off.
- Gated key advanced API routes with a `403` response when the feature is off.
- Added tests for Starter exclusion, default-off Growth/Custom behavior, and explicit Growth/Custom enablement.
- Updated task, decision, and architecture memory.

Files changed:

- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `src/app/(dashboard)/super-admin/page.tsx`
- `src/components/layout/sidebar.tsx`
- `src/hooks/use-auth.tsx`
- `src/lib/saas/packages.ts`
- `src/lib/saas/packages.test.ts`
- `src/middleware.ts`

Checks run:

- Targeted `npx prettier --write` ran on touched TS/TSX/Markdown files.
- `npm run typecheck` passed.
- `npm test -- src/lib/saas/packages.test.ts` passed.
- `npm run lint` passed with existing warnings only.

What remains:

- In `/super-admin`, enable "Show Advanced CRM tools" only for selected Growth/Custom accounts when ready.
- Confirm Starter accounts cannot see the sidebar group and are redirected from direct advanced CRM URLs.
- Run full build before the next deploy.

## 2026-06-17 20:00 CAT Super Admin Businesses Layout Fix

What changed:

- Replaced the wide `/super-admin` Businesses table with one responsive account card per business.
- Grouped controls into readable sections: Business and package, Usage, WhatsApp, Limits, Feature gates, and collapsible Feature flags JSON.
- Kept the same server actions and package/feature behavior; this was a layout repair only.
- Updated task and architecture memory.

Files changed:

- `TASKS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `src/app/(dashboard)/super-admin/page.tsx`

Checks run:

- Targeted `npx prettier --write` ran on the touched TSX file.
- `npm run typecheck` passed.
- `npm run lint` passed with existing warnings only.
- In-app browser reached `http://localhost:3000/login` when navigating to `/super-admin`, so authenticated visual screenshot validation was blocked by login state.
- `npm run build` passed with dummy local Supabase/secret env values and approved network access for the Google font fetch.

What remains:

- While signed in as a super admin, visually confirm the Businesses section no longer has the oversized table gaps shown in the screenshot.

## 2026-06-17 20:38 CAT Bot Controls, Human Queue, and Focused Security Review

What changed:

- Added `/bot-settings` for business owner/admin account-wide bot ON/OFF control.
- Added `/needs-reply` as a simple human-attention queue for unread chats, AI-paused chats, and buying-intent chats.
- Added `/api/conversations/[id]/bot-pause` so agent+ users can pause/resume AI for a specific conversation.
- Added inbox Pause/Resume Bot controls and an "AI paused" indicator.
- Updated successful manual WhatsApp replies and template replies to pause AI for that conversation.
- Added `canManageAccountBot` role helper and tests.
- Hardened `/api/whatsapp/send` and `/api/whatsapp/react` so `agent` role is required before Meta API side effects.
- Hardened `/api/whatsapp/config` POST/DELETE so `admin` role is required before Meta verification, registration/subscription, save, or reset.
- Narrowed the WhatsApp settings UI query so encrypted access/verify token columns are not selected into browser state.
- Performed a focused security review of the touched bot controls, WhatsApp send/config routes, RLS/tenant filters, and token exposure paths.

Files changed:

- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `src/app/(dashboard)/bot-settings/page.tsx`
- `src/app/(dashboard)/needs-reply/page.tsx`
- `src/app/(dashboard)/inbox/page.tsx`
- `src/app/api/conversations/[id]/bot-pause/route.ts`
- `src/app/api/whatsapp/send/route.ts`
- `src/app/api/whatsapp/react/route.ts`
- `src/app/api/whatsapp/config/route.ts`
- `src/components/inbox/message-thread.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/settings/whatsapp-config.tsx`
- `src/hooks/use-can.ts`
- `src/lib/auth/roles.ts`
- `src/lib/auth/roles.test.ts`
- `src/lib/ai/whatsapp-bot.test.ts`
- `src/lib/supabase/admin.ts`
- `src/middleware.ts`

Checks run:

- Targeted `npx prettier --write` ran on touched TS/TSX/Markdown files.
- `npm run typecheck` passed.
- `npm test -- src/lib/auth/roles.test.ts src/lib/ai/whatsapp-bot.test.ts src/lib/saas/packages.test.ts src/lib/leads/detect.test.ts` passed.
- `npm run lint` passed with 16 existing warnings in legacy/touched-elsewhere files.
- First sandboxed `npm run build` failed because Turbopack could not fetch the configured Google Font.
- Network-approved `npm run build` passed.
- `npm test` passed: 33 files, 429 tests.

What remains:

- Test `/bot-settings`, `/needs-reply`, and inbox Pause/Resume Bot controls while signed into the real Supabase project.
- Test real WhatsApp inbound flow after manual reply pauses a conversation, then after resuming the bot.
- Run the existing manual QA checklist with a Meta test WhatsApp number before pilot onboarding.
- Consider a future defense-in-depth pass for stricter `whatsapp_config` column privileges or a server-only safe config view.

## 2026-06-18 13:53 CAT Super Admin Runtime Log Check

What changed:

- Investigated the reported `/super-admin` `ReferenceError: Table is not defined` runtime log.
- Confirmed the current `src/app/(dashboard)/super-admin/page.tsx` source no longer renders a `Table` at the reported line; line 513 is now the Businesses empty-state check.
- Fixed a TypeScript type mismatch in the advanced CRM feature-gate helper that was surfaced while running checks.
- Recorded the stale-error finding in task memory.

Files changed:

- `TASKS.md`
- `WORKLOG.md`
- `src/lib/saas/advanced-crm.ts`

Checks run:

- `npm run typecheck` passed.

What remains:

- Reload `/super-admin` while signed in as a super admin. If the old error overlay persists, restart `npm run dev` so Next clears the stale compiled page state.

## 2026-06-18 16:05 CAT Focused Security Hardening Follow-Up

What changed:

- Confirmed the `/super-admin` `Table is not defined` log is stale relative to current source; the page renders account cards now, not a `Table`.
- Centralized package gates for Full Leads and multiple-user support.
- Aligned app and database logic so Starter is Lead Lite only, Growth gets Full Leads by package, and Custom uses its manual Full Leads flag.
- Blocked Starter staff invitations through route-level checks and database helper coverage.
- Added/updated migration `026_security_hardening.sql` for WhatsApp token column grants, Advanced CRM/Full Leads/staff helper gates, least-privilege function execution, and tenant-consistency triggers.
- Tightened service-role writes in WhatsApp send/webhook/bot paths with explicit `account_id` filters where practical.
- Added AI test usage enforcement and transcript caps before provider calls.
- Hardened sensitive API responses so provider/database details are logged server-side and generic errors are returned to the browser.
- Updated sidebar/usage/bot-settings/AI-test views to use shared Full Leads package logic.
- Added security review documentation and targeted tests for package gates, Advanced CRM runtime gates, and SQL hardening.

Files changed:

- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/SECURITY_REVIEW.md`
- `supabase/migrations/026_security_hardening.sql`
- `src/lib/saas/packages.ts`
- `src/lib/saas/packages.test.ts`
- `src/lib/security/security-hardening-sql.test.ts`
- `src/lib/leads/detect.ts`
- `src/lib/automations/engine.ts`
- `src/lib/automations/engine.test.ts`
- `src/lib/automations/meta-send.ts`
- `src/lib/flows/engine.ts`
- `src/lib/flows/meta-send.ts`
- `src/lib/rate-limit.ts`
- `src/lib/ai/whatsapp-bot.ts`
- `src/components/layout/sidebar.tsx`
- `src/app/(dashboard)/ai-test/page.tsx`
- `src/app/(dashboard)/bot-settings/page.tsx`
- `src/app/(dashboard)/usage/page.tsx`
- `src/app/api/account/invitations/route.ts`
- `src/app/api/account/invitations/[id]/route.ts`
- `src/app/api/ai-test/chat/route.ts`
- `src/app/api/automations/*`
- `src/app/api/flows/*`
- `src/app/api/whatsapp/*`
- `src/components/ai-test/ai-chat-tester.tsx`
- `src/components/settings/members-tab.tsx`

Checks run:

- Targeted `./node_modules/.bin/prettier --write` ran on touched TS/TSX/test files.
- `npm run typecheck` passed.
- `npm test -- src/lib/saas/packages.test.ts src/lib/leads/detect.test.ts src/lib/ai/whatsapp-bot.test.ts src/lib/security/security-hardening-sql.test.ts` passed.
- `npm run lint` passed with 16 existing warnings.
- `npm test` passed: 34 files, 439 tests.
- `npm run format:check` failed because the legacy repo has pre-existing formatting differences across 183 files.
- `npm run build` failed in the sandbox because Next/Turbopack could not fetch Google Fonts. The network-approved retry could not run because the approval system reported a usage-limit block.

What remains:

- Push/apply `supabase/migrations/026_security_hardening.sql` to the remote Supabase project and verify token column grants/RLS policies there.
- Run real WhatsApp webhook/manual-send testing with a Meta test number.
- Re-run `npm run build` in an environment with network access for Google Fonts or switch the app to a local/self-hosted font before deployment.
- Run a formal exhaustive security audit with coverage artifacts before broad production release.

## 2026-06-19 09:20 CAT Security Scan Fixes

What changed:

- Continued the repository security scan with completed subagent shards for auth/RLS, account APIs, WhatsApp routes, AI usage, and Advanced CRM automation surfaces.
- Fixed profile trust-column exposure by narrowing authenticated `profiles` writes to display fields only.
- Added atomic AI usage reservation/refund RPCs and wired `/api/ai-test/chat` plus inbound WhatsApp AI replies to reserve quota before provider calls.
- Added inbound WhatsApp message idempotency with a unique customer Meta message index and duplicate insert handling before side effects.
- Hardened Advanced CRM automation webhook steps with HTTPS-only validation, local/private destination blocking, runtime DNS checks, disabled redirects, and optional `AUTOMATION_WEBHOOK_ALLOWED_HOSTS`.
- Added prompt-size truncation for business profile, products/services, FAQ/knowledge, transcript, and customer-message text.
- Added targeted security tests for the new database grants, usage reservation, webhook replay handling, automation webhook URL validation, and prompt truncation.
- Updated security documentation and env examples.

Files changed:

- `.env.local.example`
- `TASKS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY_REVIEW.md`
- `supabase/migrations/026_security_hardening.sql`
- `src/app/api/ai-test/chat/route.ts`
- `src/app/api/whatsapp/webhook/route.ts`
- `src/lib/ai/prompt.ts`
- `src/lib/ai/prompt.test.ts`
- `src/lib/ai/whatsapp-bot.ts`
- `src/lib/automations/engine.ts`
- `src/lib/automations/validate.ts`
- `src/lib/automations/validate.test.ts`
- `src/lib/automations/webhook-url.ts`
- `src/lib/automations/webhook-url.test.ts`
- `src/lib/security/security-hardening-sql.test.ts`
- `src/lib/security/service-role-guards.test.ts`

Checks run:

- `npm test -- src/lib/security/security-hardening-sql.test.ts src/lib/security/service-role-guards.test.ts src/lib/automations/webhook-url.test.ts src/lib/automations/validate.test.ts src/lib/ai/prompt.test.ts src/lib/ai/whatsapp-bot.test.ts` passed: 6 files, 44 tests.
- `npm run typecheck` passed.
- `npm run lint` passed with 15 existing warnings in legacy UI files.
- `npm run test` passed: 36 files, 453 tests.
- Targeted `npx prettier --write` ran on touched migration/TS/test files.
- Initial sandboxed `npm run build` failed because Google Fonts could not be fetched.
- Network-approved `npm run build` passed.

What remains:

- Apply `supabase/migrations/026_security_hardening.sql` to the remote Supabase project.
- If the new WhatsApp idempotency unique index hits existing duplicate inbound customer messages, clean those duplicate rows before pushing the migration.
- Manually test real Meta webhook delivery, duplicate retry behavior, manual WhatsApp sends, AI provider failure fallback, and bot pause/resume with a Meta test number.
- Consider setting `AUTOMATION_WEBHOOK_ALLOWED_HOSTS` before enabling Advanced CRM webhook steps for customers.

## 2026-06-19 09:33 CAT Security Scan Final Hardening

What changed:

- Reviewed remaining scan surfaces for client-side secret exposure, storage policy shape, API route gates, package gates, human takeover behavior, webhook verification, and private route caching.
- Fixed a private-data caching risk by changing Next.js cache headers so dashboard/auth/app HTML routes are `private, no-cache, no-store, max-age=0, must-revalidate` by default.
- Kept short public CDN caching only for explicitly public pages: `/`, `/privacy`, `/terms`, and `/data-deletion`.
- Hardened product/service package limits against concurrent direct inserts by redefining `enforce_account_product_limit()` to lock the parent account row before counting products.
- Added focused regression tests for Next.js cache headers and product-limit trigger serialization.
- Updated security review, production readiness, architecture, tasks, and decisions docs.
- Finalized the security scan report artifacts with explicit validation and attack-path receipts for fixed candidates.

Files changed:

- `next.config.ts`
- `TASKS.md`
- `DECISIONS.md`
- `WORKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/SECURITY_REVIEW.md`
- `supabase/migrations/026_security_hardening.sql`
- `src/lib/security/next-cache-headers.test.ts`
- `src/lib/security/security-hardening-sql.test.ts`

Checks run:

- `npm test -- src/lib/security/next-cache-headers.test.ts src/lib/security/security-hardening-sql.test.ts` passed: 2 files, 11 tests.
- `npm run typecheck` passed.
- `npm run lint` passed with 15 existing warnings in legacy UI files.
- `npm run test` passed: 37 files, 457 tests.
- `git diff --check` passed.
- `npm run format:check` failed on 180 pre-existing formatting differences outside the security scope.
- Sandboxed `npm run build` failed because Google Fonts could not be fetched.
- Network-approved `npm run build` passed.

What remains:

- Apply `supabase/migrations/026_security_hardening.sql` to the remote Supabase project.
- Manually verify cache headers on the deployed authenticated pages and test real Meta WhatsApp flows.

## 2026-06-19 20:29 CAT AI Test Usage Error Fix

What changed:

- Fixed `/api/ai-test/chat` so usage reservation setup/RPC failures are reported separately from a real monthly AI limit block.
- Changed `reserveAccountAiReply` to return a reasoned result for `limit_reached` vs `reservation_error`.
- Kept inbound WhatsApp AI fail-closed behavior: reservation failures still avoid provider calls and use fallback handling.
- Added regression coverage for the new reservation result behavior.

Files changed:

- `TASKS.md`
- `WORKLOG.md`
- `src/app/api/ai-test/chat/route.ts`
- `src/lib/ai/whatsapp-bot.ts`
- `src/lib/ai/whatsapp-bot.test.ts`
- `src/lib/security/service-role-guards.test.ts`

Checks run:

- `npm run typecheck` passed.
- `npm test -- src/lib/ai/whatsapp-bot.test.ts src/lib/security/service-role-guards.test.ts` passed: 2 files, 13 tests.
- Targeted Prettier ran on touched TS/test files.

What remains:

- If the AI test now reports "AI usage check failed," push migration `026_security_hardening.sql` to Supabase and confirm `SUPABASE_SERVICE_ROLE_KEY` is present in the app environment.
