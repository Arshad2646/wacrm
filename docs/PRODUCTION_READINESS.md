# Production Readiness Notes

This document separates what is ready for manual MVP testing from what still
needs hardening before broad production use.

## Ready for Manual MVP Testing

- One shared SaaS app using existing `accounts.id` / `account_id` tenancy.
- Manual account/business management through `/super-admin`.
- Starter, Growth, and Custom package settings.
- Business dashboard editing for business info, products/services, and FAQs / knowledge.
- Server-side Gemini/OpenAI AI test flow.
- WhatsApp webhook flow that can save inbound messages, generate account-scoped AI replies, send outbound replies, log usage, and detect lead intent.
- Starter Lead Lite indicators inside conversations.
- Growth/Custom Full Leads page and status/notes workflow.
- Public `/privacy`, `/terms`, and `/data-deletion` pages for Meta setup.

## Not Production-Ready Yet

- Billing is not implemented.
- Meta Embedded Signup is not implemented.
- Onboarding is manual and operator-run.
- No dedicated error monitoring service is configured.
- No automated backup/restore runbook is included.
- Lead detection is deterministic and should be tuned with real customer phrasing.
- Legal pages are editable MVP placeholders and should be reviewed before public launch.
- WhatsApp credentials are still managed through existing settings/super-admin workflows and need careful operator handling.

## Meta App Requirements

- The app must be served over HTTPS for production webhooks.
- Meta webhook callback URL must point to the deployed `/api/whatsapp/webhook` route.
- Webhook verify token must match the saved account configuration.
- `META_APP_SECRET` should be set so webhook POST signatures can be validated.
- Meta app Live mode requires appropriate business verification, app review, privacy policy URL, terms URL, and data deletion URL.

## Token and Security Considerations

- Keep `SUPABASE_SERVICE_ROLE_KEY`, WhatsApp access tokens, Meta app secrets, encryption keys, and AI provider keys server-side only.
- Do not paste real tokens into screenshots, logs, issues, or public docs.
- Rotate a client's WhatsApp token if it may have been exposed.
- Confirm `ENCRYPTION_KEY` is stable before saving production WhatsApp credentials.
- Confirm Supabase RLS policies are enabled after migrations.
- Use a different Supabase project for local/staging and production.

## Logging and Monitoring Needed

- Add structured error logging for webhook failures, AI provider errors, and Meta send failures.
- Monitor AI provider latency and error rate.
- Monitor WhatsApp send failures and webhook delivery failures.
- Monitor account usage near monthly limits.
- Add an alert for repeated provider or Meta API errors.

## Backups Needed

- Enable Supabase backups for production.
- Define restore steps for contacts, conversations, messages, account knowledge, products, and leads.
- Export or snapshot the database before running major migrations on production.

## Manual Onboarding Process

- Create or invite the business owner.
- Set account package and limits in `/super-admin`.
- Add WhatsApp credentials in account settings.
- Add business info, products/services, and FAQs / knowledge.
- Test with `/ai-test`.
- Turn the bot on only after controlled WhatsApp tests pass.

## Suggested First-Client Testing Plan

1. Use a friendly pilot business with a small product catalog.
2. Start on Starter or Growth with conservative limits.
3. Add 10-20 real products/services and common FAQs.
4. Test known price, availability, delivery, payment, and opening-hours questions.
5. Test unknown product and unrelated questions.
6. Run live WhatsApp tests from two staff phones before allowing real customers.
7. Review every bot conversation daily for the first week.
8. Update knowledge from missed or unclear enquiries.
9. Tune lead-detection keywords based on real Botswana/Southern Africa phrasing.
10. Keep a manual fallback process for urgent customer replies.
