# First Client Onboarding

Use this runbook for the first manually onboarded small business.

## 1. Create Account / Business

1. Sign in as a super admin email listed in `SUPER_ADMIN_EMAILS`.
2. Open `/super-admin`.
3. Create the business owner account if needed, or find the existing account.
4. Rename the account to the business name.

## 2. Set Package

1. Choose Starter, Growth, or Custom.
2. Confirm the package defaults:
   - Starter: 1500 AI replies/month, 20 products/services, Lead Lite.
   - Growth: 5000 AI replies/month, 100 products/services, Full Leads.
   - Custom: manually configured limits and features.
3. For Custom, set reply limit, product limit, Lead Lite, and Full Leads flags manually.

## 3. Add WhatsApp Credentials

1. Open the business account's WhatsApp settings.
2. Add the WhatsApp phone number ID.
3. Add the WABA ID.
4. Add the WhatsApp access token.
5. Add/confirm the webhook verify token.
6. Verify registration/subscription if the settings page offers the action.
7. Confirm access tokens are not displayed after saving.

## 4. Add Business Info

1. Open `/business-info`.
2. Add the business description.
3. Add location.
4. Add opening hours.
5. Add services summary.
6. Add delivery instructions.
7. Add payment instructions.
8. Add order/contact instructions.
9. Add a safe fallback message.

## 5. Add Products / Services

1. Open `/products`.
2. Add product/service name.
3. Add price text.
4. Add availability/stock text.
5. Add short description.
6. Keep each active product clear enough for the bot to quote.
7. Confirm the package product/service limit is enforced.

## 6. Add FAQs / Knowledge

1. Open `/knowledge`.
2. Add common questions, policies, and service details.
3. Include delivery areas, payment terms, warranty, booking process, and collection instructions.
4. Keep unknown or unconfirmed claims out of the knowledge base.

## 7. Test AI in `/ai-test`

1. Ask about a known product price.
2. Ask about stock/availability.
3. Ask about location and opening hours.
4. Ask about delivery/payment.
5. Ask about an unknown product and confirm the bot says the team will confirm.
6. Ask an unrelated question and confirm polite refusal.
7. Ask a mixed business/unrelated question and confirm only the business part is answered.

## 8. Turn Bot On

1. In `/super-admin`, confirm `bot_enabled` is on.
2. Keep the bot off until `/ai-test` responses are acceptable.

## 9. Send Controlled WhatsApp Test Message

1. Use a staff/customer test phone.
2. Send one simple product enquiry.
3. Wait for the bot reply.
4. Do not use a real customer campaign for the first test.

## 10. Check Conversation Saved

1. Open `/inbox`.
2. Confirm the inbound customer message appears.
3. Confirm the outgoing AI reply appears.
4. Confirm the correct account is seeing the conversation.

## 11. Check AI Reply

1. Confirm the answer uses only the client's knowledge.
2. Confirm the reply does not invent prices, stock, or policies.
3. Confirm the tone is acceptable for the business.

## 12. Check Usage Count

1. Open `/usage`.
2. Confirm monthly AI replies increased after the successful WhatsApp AI reply.
3. Confirm product/service count is correct.

## 13. Check Lead Behavior

Starter:

1. Ask a buying-intent question.
2. Confirm an interest indicator appears in the conversation.
3. Confirm there is no full Leads workflow exposed.

Growth / Full-Leads Custom:

1. Ask a buying-intent question.
2. Open `/leads`.
3. Confirm a lead was created or updated.
4. Update status to Contacted.
5. Add a note.
6. Open the source conversation link if available.

## 14. Train Client on Dashboard

1. Show Dashboard, Conversations, Business Info, Products & Services, FAQs / Knowledge, Test Bot Reply, Usage, and WhatsApp Settings.
2. For Growth, show Leads.
3. Explain that product/FAQ edits affect future bot answers.
4. Explain that unknown items should be added after staff confirms them.
5. Explain usage limits and what happens when a limit is reached.

## 15. Improve After First Week

1. Review real conversations daily.
2. Add missing FAQs.
3. Update product names to match customer language.
4. Add common delivery areas and payment wording.
5. Tune package limits or upgrade to Growth if follow-up work is heavy.
