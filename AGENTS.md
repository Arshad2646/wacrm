<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# WACRM SaaS MVP Agent Rules

## Project Goal

Convert this WhatsApp CRM template into one managed, multi-client WhatsApp AI chatbot SaaS MVP for small businesses in Botswana and Southern Africa.

The first sellable version is a practical WhatsApp AI sales assistant:

- Manual onboarding by the SaaS operator first.
- Business owners can maintain their own business info, products/services, prices, FAQs, opening hours, delivery/payment instructions, and bot settings.
- AI answers customer enquiries on WhatsApp using only that business's knowledge.
- Conversations are saved.
- Buying intent is detected.
- Starter customers get Lead Lite inside conversations.
- Growth customers get full lead management.

Do not rebuild the template from scratch. Keep useful existing CRM features such as inbox, contacts, WhatsApp Cloud API integration, encrypted WhatsApp credentials, webhook signature verification, account/team roles, broadcasts, automations, flows, and pipelines where they help the SaaS MVP.

## Required Context Protocol

At the start of every new task, read:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `TASKS.md`
- `DECISIONS.md`
- `docs/ARCHITECTURE.md`

At the end of every task, update:

- `TASKS.md`
- `WORKLOG.md`
- `DECISIONS.md` if an architecture or product decision changed
- `docs/ARCHITECTURE.md` if implementation or architecture changed

## Setup Commands

This repo uses Node.js 20+, Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, Supabase, and Vitest.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Fill Supabase, Meta, encryption, and AI provider environment variables before running real webhook or AI flows.

## Build, Test, and Lint Commands

From `package.json`:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:watch
npm run format:check
npm run format
```

Run the smallest relevant checks for the change. For broad TypeScript or app behavior changes, prefer at least `npm run typecheck`, `npm run lint`, and targeted `npm run test` files when practical.

## Next.js Rule

This repo uses Next.js 16. Before changing application code, read the relevant guide under `node_modules/next/dist/docs/` if present. If that directory is missing in the local checkout, note the absence and rely on the repo's existing patterns rather than older Next.js assumptions.

## Coding Conventions

- Follow existing App Router, TypeScript, Supabase, and component patterns.
- Keep changes small and phased.
- Prefer server-side route handlers/actions for sensitive work.
- Use existing role helpers and Supabase server clients where possible.
- Preserve encrypted WhatsApp token handling.
- Keep UI simple for small shop owners.
- Do not introduce new frameworks or services unless clearly needed for the MVP.
- Avoid broad refactors unless they are necessary for tenant isolation or security.

## Security Rules

- Never expose WhatsApp access tokens, Meta app secrets, Supabase service role keys, or AI API keys to the frontend.
- Do not log full secrets or access tokens.
- Keep AI calls server-side only.
- Keep WhatsApp credentials encrypted at rest when stored.
- Validate Meta webhook signatures using `META_APP_SECRET`.
- Preserve and extend Supabase RLS for tenant-owned data.
- Do not rely only on frontend filtering for tenant isolation.
- Sanitize and validate inputs.
- Do not hardcode real business credentials or API keys.

## SaaS and Multi-Tenant Rules

- The target product is one shared SaaS app for many businesses, not one codebase/workflow per client.
- Every tenant-owned table must be scoped to a business/tenant key.
- Existing schema currently uses account-based tenancy (`accounts`, `account_id`, `profiles.account_role`) after migration `017_account_sharing.sql`; future SaaS work must intentionally map or evolve this into the business tenant model instead of mixing meanings casually.
- Business users can only access their own business data.
- Super admin can manage all businesses.
- Sensitive provider credentials must stay server-only.

Tenant-owned data includes contacts, conversations, messages, leads, products, FAQs, knowledge base entries, bot settings, usage logs, WhatsApp credentials/settings, package/settings, and feature flags.

## Package and Feature-Gating Rules

All packages allow business owners to edit products, services, FAQs, prices, and business info.

Package differences are limits and lead-management power:

- Starter Bot: P1500/month, 1500 AI replies/month, 20 products/services, one business user/admin, AI auto-replies, dashboard editing, basic inbox, bot on/off, manual onboarding, Lead Lite only.
- Growth Bot + Leads: P3000/month, 5000 AI replies/month, 100 products/services, everything in Starter plus full leads dashboard, lead statuses, notes, filters, source conversation, manual replies, conversation-level bot control if practical, multiple staff if existing account structure supports it, improved analytics if practical.
- Custom: manually configured reply limit, product limit, and feature flags.

Starter Lead Lite may detect intent and show basic interest indicators inside conversations. It must not expose a full leads page, lead board, lead statuses, lead export, follow-up reminders, staff assignment, or advanced lead analytics.

Growth Full Leads may expose lead dashboard, statuses (`new`, `contacted`, `won`, `lost`), notes, filters, source conversation/message, and follow-up workflow.

## AI Rules

- Use an AI provider adapter selected by `AI_PROVIDER=gemini` or `AI_PROVIDER=openai`.
- Keep separate provider config: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`.
- Do not hardcode one provider throughout the app.
- Bot replies must use only the matched business's knowledge, products, FAQs, and settings.
- Refuse unrelated questions politely.
- If the bot does not know, do not hallucinate. Say the team will confirm and save the enquiry for follow-up.

## Do-Not Rules

- Do not build Meta Embedded Signup yet.
- Do not build billing yet.
- Do not add n8n as a requirement.
- Do not create one separate codebase/workflow per client.
- Do not make the super admin maintain every client's product catalog forever.
- Do not make package differences block product/FAQ editing.
- Do not overbuild enterprise CRM features before the simple WhatsApp AI sales assistant works.

## Definition of Done

A task is done when:

- The change matches the current phase and avoids out-of-scope features.
- Tenant isolation and secret handling are preserved.
- Package limits/feature gates are documented or implemented where relevant.
- Relevant docs and memory files are updated.
- Relevant checks have been run, or skipped with a clear reason.
- `TASKS.md` and `WORKLOG.md` reflect what changed and what remains.
