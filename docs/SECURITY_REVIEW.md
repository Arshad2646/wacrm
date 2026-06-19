# Security Review

Last updated: 2026-06-19 11:15 CAT

This note records the security hardening pass for the managed WhatsApp AI chatbot SaaS MVP. The review used a repository-wide Codex Security workflow with subagent shards for auth/RLS, account APIs, WhatsApp routes, AI/usage, and Advanced CRM automation surfaces.

## Hardened Areas

- Package gates are centralized for Full Leads and multiple-user access.
- Starter is forced to Lead Lite only and cannot invite staff.
- Growth receives Full Leads by package rule.
- Custom receives Full Leads only when `full_leads_enabled` is true.
- Advanced CRM tools are app-gated and database-gated behind `advanced_crm_tools_enabled`, and Starter is always blocked.
- WhatsApp encrypted token columns are removed from normal browser queries and narrowed by database grants in migration `026_security_hardening.sql`.
- Profile trust columns are narrowed at the database privilege layer: authenticated browser clients can update only `profiles.full_name` and `profiles.avatar_url`, not `account_id` or `account_role`.
- WhatsApp send, reaction, config, broadcast/template, automation, and flow routes require the relevant account role or release flag before sensitive work.
- AI test chat and inbound WhatsApp AI replies reserve monthly usage atomically before provider calls and refund the reservation if provider/send work fails.
- Product/service limit checks now lock the account row before counting catalog rows, preventing concurrent inserts from racing past package limits.
- Inbound WhatsApp customer messages are deduplicated by `(conversation_id, message_id)` before unread counts, flows, automations, or AI can run again.
- AI prompts truncate oversized business profile, product/service, FAQ, transcript, and customer-message text before provider calls.
- Advanced CRM `send_webhook` automation steps require HTTPS, reject credentialed/local/private destinations, check DNS-resolved addresses at runtime, disable redirects, and can be restricted with `AUTOMATION_WEBHOOK_ALLOWED_HOSTS`.
- Manual WhatsApp replies and bot/webhook service-role updates use explicit `account_id` filters where practical.
- Dashboard/auth/app HTML routes are private `no-store` by default; only known public pages receive short public CDN caching.
- Provider/database details are logged server-side and replaced with generic client-facing API errors in the most sensitive routes.
- Database hardening migration adds Full Leads/staff helper gates, Advanced CRM helper gates, token column privileges, and tenant-consistency triggers.

## Findings Fixed

- `auth-001-C01`: low-privilege users could self-edit `profiles.account_id` / `profiles.account_role` through direct Supabase access and bypass role/tenant checks. Fixed with profile column privileges in migration `026_security_hardening.sql`.
- `ai-usage-001-C01` and `ai-usage-001-C02`: AI usage checks could overshoot monthly limits under concurrent `/ai-test` or WhatsApp inbound requests. Fixed with atomic reservation/refund RPCs.
- `ai-usage-001-C03`: unbounded business knowledge could inflate every provider prompt. Fixed with prompt-size truncation.
- `advanced-crm-001-C01`: automation webhook steps could make arbitrary server-side requests. Fixed with public HTTPS destination validation, DNS private-address blocking, no redirects, and optional host allowlist.
- `whatsapp-001-C01`: replayed valid Meta webhook deliveries could duplicate messages and re-run side effects. Fixed with inbound message idempotency and duplicate handling.
- `CAND-CACHE-001`: global non-API HTML caching could mark authenticated dashboard pages as publicly cacheable. Fixed by defaulting app HTML to `private, no-cache, no-store, max-age=0, must-revalidate` and allowlisting public cache only for `/`, `/privacy`, `/terms`, and `/data-deletion`.
- `CAND-PRODUCT-LIMIT-001`: concurrent product/service inserts could race past package product limits. Fixed by redefining the product-limit trigger to lock the parent `accounts` row before counting existing products.
- `CAND-MEDIA-001`: authenticated WhatsApp media responses were publicly cacheable. Fixed with `private, no-store, max-age=0`.
- `CAND-SR-001`: some service-role contact phone self-heal writes lacked final `account_id` filters. Fixed with account-scoped update filters.

## Checks Run

- `npm run typecheck` passed.
- `npm run lint` passed with 15 existing warnings in legacy UI files.
- `npm run test` passed: 37 files, 457 tests.
- Targeted security tests passed for the original scan fixes: 6 files, 44 tests.
- Additional cache/product-limit focused tests passed: 2 files, 11 tests.
- `git diff --check` passed.
- Targeted Prettier ran on touched migration/TS/TSX/test/Markdown files.
- Repo-wide `npm run format:check` still fails on 180 pre-existing formatting differences outside the security scope.
- Sandboxed `npm run build` fails because Google Fonts cannot be fetched without network access; network-approved `npm run build` passed.

## Residual Risks

- Apply migration `026_security_hardening.sql` to the remote Supabase project and verify RLS/column grants/functions there.
- Real WhatsApp webhook, Meta send, and provider error paths still need manual testing with a Meta test number.
- If the database already contains duplicate inbound customer `messages.message_id` values in the same conversation, the new unique index may require manual duplicate cleanup before migration push.
- Consider setting `AUTOMATION_WEBHOOK_ALLOWED_HOSTS` in production so Advanced CRM webhook steps can call only known public providers.
- Public `flow-media` storage remains intentionally public for Meta fetches; do not upload private-only material there.
- A human security review and real Supabase/Meta production configuration review are still recommended before broad public launch.
