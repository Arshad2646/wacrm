# MVP QA Checklist

Use this checklist before onboarding a real client. Test with a non-production
WhatsApp number first.

## Super Admin

- [ ] Sign in with an email listed in `SUPER_ADMIN_EMAILS`.
- [ ] Confirm `/super-admin` loads.
- [ ] Confirm an unlisted email cannot access `/super-admin`.
- [ ] View all accounts/businesses.
- [ ] Create or select a business account.
- [ ] Set package to Starter, Growth, and Custom.
- [ ] Confirm Starter applies 1500 replies/month, 20 products/services, Lead Lite, and no Full Leads.
- [ ] Confirm Growth applies 5000 replies/month, 100 products/services, and Full Leads.
- [ ] Confirm Custom accepts manual reply/product limits and feature flags.
- [ ] Turn bot on/off for the account.
- [ ] View current monthly AI usage.
- [ ] View current product/service count.

## Business User

- [ ] Business user can sign in.
- [ ] Business user sees only their own account data.
- [ ] Business user can edit business info, location, opening hours, delivery, payment, and order instructions.
- [ ] Business user can add/edit products and services.
- [ ] Product/service limit is enforced.
- [ ] Business user can add/edit FAQs / knowledge entries.
- [ ] `/ai-test` answers using only the current account knowledge.
- [ ] `/ai-test` refuses unrelated questions.
- [ ] `/usage` shows package, usage, product count, bot status, lead mode, and WhatsApp readiness.

## WhatsApp

- [ ] Webhook verification succeeds from Meta.
- [ ] Webhook POST validates Meta signature when `META_APP_SECRET` is set.
- [ ] Incoming message maps to the correct account by WhatsApp phone number ID.
- [ ] Inbound customer message is saved in the conversation.
- [ ] Bot enabled generates an AI reply.
- [ ] Outgoing AI reply is saved.
- [ ] Outgoing AI reply is sent through WhatsApp Cloud API.
- [ ] Monthly AI usage increments after successful AI-generated sends.
- [ ] Bot disabled does not call AI.
- [ ] Usage limit reached does not call AI and uses fallback message.
- [ ] Provider error does not crash the webhook and uses fallback behavior.
- [ ] Unknown product question does not hallucinate; reply says the team will confirm.
- [ ] Unrelated question is refused politely.
- [ ] Mixed business/unrelated question answers only the business part.

## Packages

- [ ] Starter AI replies work.
- [ ] Starter Lead Lite indicator appears in conversations when buying intent is detected.
- [ ] Starter does not expose the Leads nav/page workflow.
- [ ] Growth AI replies work.
- [ ] Growth creates or updates Full Leads when buying intent is detected.
- [ ] Growth lead status and notes can be updated.
- [ ] Growth lead links back to the source conversation where practical.
- [ ] Custom limits and lead flags behave as manually configured.

## Security

- [ ] WhatsApp access tokens are not visible in frontend responses.
- [ ] AI API keys are not visible in frontend responses.
- [ ] Super-admin writes require server-side `SUPER_ADMIN_EMAILS` authorization.
- [ ] Account-scoped RLS prevents one business from reading another business's contacts, conversations, messages, products, knowledge, usage, and leads.
- [ ] Service role key is used only server-side.
- [ ] No real secrets are committed to the repository.
