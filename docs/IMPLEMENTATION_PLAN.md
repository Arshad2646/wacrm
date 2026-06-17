# Implementation Plan

This plan is based on the current repository inspection. The repo already has a useful WhatsApp CRM foundation: inbox, contacts, deals/pipelines, broadcasts, automations, flows, team accounts, role helpers, account-scoped RLS, WhatsApp config, encrypted tokens, webhook verification, signature validation, and Meta API helpers.

The SaaS MVP should build on those pieces instead of replacing them.

## Phase 1: Project Memory and Documentation

Status: complete for the first Codex run.

Deliverables:

- Project memory files.
- SaaS product context.
- Architecture documentation.
- Future Embedded Signup documentation.
- AI provider adapter design notes.
- Gemini/OpenAI environment variable examples.

No database schema or application behavior changes should happen in this phase.

## Phase 2: SaaS Tenant and Package Foundation

Status: complete.

Goal: make the app safely manageable as one shared SaaS for multiple businesses.

Tasks:

- Decided existing `accounts/account_id` is the business tenant model.
- Added super admin mode for manual account/business management.
- Added package field: Starter, Growth, Custom.
- Added package defaults:
  - Starter: 1500 replies/month, 20 products/services, Lead Lite.
  - Growth: 5000 replies/month, 100 products/services, Full Leads.
  - Custom: manual limits/features.
- Added business bot settings.
- Added usage limit settings and monthly AI usage buckets.
- Added product/service limit settings.
- Added feature flags such as `full_leads_enabled`.
- Preserved tenant isolation and RLS.

Product/service tables are still Phase 3, so product count/enforcement is a stored limit foundation for now.

## Phase 3: Knowledge Editing and AI Provider Layer

Status: complete.

Goal: let business owners manage knowledge and prepare strict AI replies.

Tasks:

- Added products/services management.
- Added FAQ and business-info editing.
- Added delivery/payment/order instructions.
- Added AI provider adapter for Gemini/OpenAI.
- Added strict business-scoped reply prompt.
- Added server-only AI calls through `/ai-test`.
- Confirmed Gemini/OpenAI setup through existing env vars.

No WhatsApp webhook behavior was changed in Phase 3.

## Phase 4: Webhook AI Replies and Leads

Status: complete.

Goal: turn inbound WhatsApp messages into saved, package-aware AI replies and lead signals.

Tasks:

- Routed inbound messages to the correct business using the existing `whatsapp_config.phone_number_id` mapping.
- Saved inbound messages and outgoing bot replies using existing conversation/message patterns.
- Checked bot status, conversation bot pause, and usage limits before AI calls.
- Generated replies from only that business's loaded profile, products/services, and knowledge entries.
- Sent fallback when the limit is reached or the AI provider fails.
- Tracked monthly AI reply usage after successful AI-generated WhatsApp sends.
- Added deterministic buying-intent detection.
- Added Starter Lead Lite indicators in conversations.
- Added Growth/Custom Full Leads creation/update and a simple `/leads` follow-up page.

## Phase 5: UI Cleanup, Tests, and Final Docs

Status: next.

Goal: make the MVP usable and sellable.

Tasks:

- Simplify dashboard navigation by package.
- Add or refine public pages: `/privacy`, `/terms`, `/data-deletion`.
- Add README setup instructions for SaaS mode, migrations, and manual onboarding checks.
- Add deeper integration-style tests for the webhook AI flow with mocked Supabase, Meta, and AI provider clients if practical.
- Refine usage/settings UI so owners can see bot state and limits clearly.
- Polish small-business dashboard copy and remove non-MVP navigation where appropriate.
- Update architecture docs and worklog.

## Practical MVP Principle

Starter should answer customers.

Growth should answer customers and help close leads.

Manual onboarding comes first. Embedded Signup and billing come later.
