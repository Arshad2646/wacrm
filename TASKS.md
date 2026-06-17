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

## In Progress

- None.

## Next

- Phase 5: UI cleanup and final SaaS MVP polish.
- Add or refine public Meta-required pages: `/privacy`, `/terms`, `/data-deletion`.
- Improve package-specific navigation/visibility beyond the new Full Leads gate.
- Add README setup notes for running migrations and testing the WhatsApp AI flow in SaaS mode.
- Consider deeper webhook integration tests with mocked Supabase/Meta/AI clients.

## Blocked

- Repo-wide `npm run format:check` reports pre-existing formatting differences across many files. Touched Markdown/TS/TSX files were formatted and pass targeted Prettier checks.
- None for Phase 4 checks. Build requires Supabase env values and network access for the Google font fetch.

## Risks

- Current CRM features are broader than the MVP. Future phases must simplify navigation/package visibility without deleting useful reusable code too early.
- AI reply generation must be strictly business-scoped to avoid hallucinations or unrelated answers.
- Usage limits must be enforced before AI provider calls to control cost.
- WhatsApp and AI credentials must remain server-only and must not be exposed through dashboard APIs.
- Business owners with direct database access must not be able to change package limits. Migration `023_saas_account_settings.sql` narrows `accounts` UPDATE privileges so package columns are service-role managed.
- The AI test page calls the configured provider directly; missing or invalid AI env vars will show an error instead of sending anything to WhatsApp.
- Current Phase 4 webhook integration skips AI when an active Flow consumes the inbound message. Existing automations can still run as before, so accounts using automations and AI together should be tested carefully for duplicate responses.
- Lead detection is deterministic keyword/product matching for MVP reliability; it may need tuning with real Botswana/Southern Africa customer phrasing after pilot usage.
