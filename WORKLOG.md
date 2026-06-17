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
