# wacrm — CRM Template for WhatsApp

## SaaS MVP Pivot

This fork is being converted into a managed multi-client WhatsApp AI chatbot SaaS MVP for small businesses in Botswana and Southern Africa.

The target product is a simple WhatsApp AI sales assistant:

- Starter Bot answers customer enquiries.
- Growth Bot + Leads answers customers and helps close serious buyers.
- Manual onboarding comes first.
- Meta Embedded Signup and billing come later.

Start with the project memory files before changing product behavior:

- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)
- [`TASKS.md`](./TASKS.md)
- [`DECISIONS.md`](./DECISIONS.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md)
- [`docs/FUTURE_EMBEDDED_SIGNUP.md`](./docs/FUTURE_EMBEDDED_SIGNUP.md)

For manual MVP onboarding, set `SUPER_ADMIN_EMAILS` in the server
environment and visit `/super-admin` while signed in with one of those
emails. The internal page manages account package settings, bot status,
reply/product limits, and lead feature gates without exposing WhatsApp
tokens.

Business users maintain chatbot knowledge from the dashboard:

- `/business-info` for business profile, opening hours, delivery/payment, ordering instructions, fallback message, and bot tone.
- `/products` for package-limited products/services.
- `/knowledge` for FAQs and reusable answers.
- `/ai-test` to test Gemini/OpenAI replies with account knowledge without sending WhatsApp messages.

AI provider switching is controlled server-side with `AI_PROVIDER=gemini` or
`AI_PROVIDER=openai` and the provider-specific env vars in
`.env.local.example`.

> Self-hostable CRM template for WhatsApp® — shared inbox, contacts,
> sales pipelines, broadcasts, and no-code automations. Fork it, brand
> it, host it.

<p align="center">
  <a href="https://www.hostinger.com/web-apps-hosting">
    <img src="./.github/assets/hostinger-deploy.png" alt="Ship your Node.js app in one click — Deploy to Hostinger" width="900">
  </a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![CI](https://github.com/ArnasDon/wacrm/actions/workflows/ci.yml/badge.svg)](https://github.com/ArnasDon/wacrm/actions/workflows/ci.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ecf8e?logo=supabase)](https://supabase.com)
[![Stars](https://img.shields.io/github/stars/ArnasDon/wacrm?style=social)](https://github.com/ArnasDon/wacrm/stargazers)

The marketing site and self-host docs live in a separate repo:
[ArnasDon/wacrm-site](https://github.com/ArnasDon/wacrm-site)
([wacrm.tech](https://wacrm.tech)). This repo is the product —
clone or fork it to run your own CRM.

## What you get out of the box

- **Shared inbox** on the official WhatsApp Business API — multiple
  agents working one number, per-conversation assignment, status, and
  notes.
- **Contacts + tags + custom fields**, CSV import, deduplication.
- **Sales pipelines** (Kanban) with deals linked to conversations.
- **Broadcasts** with Meta-approved templates, delivery + read
  tracking, per-recipient variable substitution.
- **No-code automations** — triggers on inbound messages, new
  contacts, keywords, or schedule; conditional branches, waits,
  tags, webhooks. Visual builder.
- **Real-time dashboard** — response times, daily volume, pipeline
  value, cross-module activity feed.
- **Team accounts** — invite teammates by link, role-based access
  (owner / admin / agent / viewer), ownership transfer. Every install
  is account-scoped, so one shared inbox can be staffed by a whole
  team. Solo use stays single-user with zero setup.
- **Account management** — email, password, avatar, global sign-out.

## Why fork this?

This is a **template**, not a product. Forking means you get:

- **Full ownership** — your code, your Supabase project, your domain,
  your data. No SaaS lock-in, no seat pricing, no trust dance.
- **Full customisation** — add the fields your team needs, remove the
  modules you don't, redesign anything. The stack is boring on
  purpose (Next.js + Supabase + Tailwind) so the learning curve is
  short.
- **Zero ops to start** — [Hostinger](https://www.hostinger.com/web-apps-hosting)
  Managed Node.js deploys a fork in a few clicks. No Docker, no
  Kubernetes, no infra team needed.
  ([See below ↓](#-deploy-on-hostinger-recommended))
- **Real security primitives** — token encryption (AES-256-GCM), RLS
  on every table, HMAC-verified webhooks, CSP, rate limiting, CI
  typecheck/build on every PR.

Not a framework. Not an SDK. A concrete, working CRM you can stand up
in an afternoon and make yours.

## Quick start

```bash
# Fork on GitHub first: https://github.com/ArnasDon/wacrm → Fork
git clone https://github.com/<your-username>/wacrm.git
cd wacrm
npm install
cp .env.local.example .env.local   # fill in Supabase + Meta creds
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login` (or
`/dashboard` if already signed in).

## Manual SaaS MVP Setup

Use these steps when running this fork as the WhatsApp AI chatbot SaaS
MVP.

### 1. Install and Configure Supabase

1. Create a Supabase project.
2. Copy `.env.local.example` to `.env.local`.
3. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_KEY`
   - `META_APP_SECRET`
4. Link the local Supabase CLI to your project.
5. Push migrations:

```bash
supabase db push
```

If your hosted Supabase project reports a UUID extension error, make sure
the latest migrations in this repo are present; UUID defaults use
`extensions.uuid_generate_v4()`.

### 2. Configure Super Admin Access

Add your operator emails to `.env.local`:

```bash
SUPER_ADMIN_EMAILS=owner@example.com,ops@example.com
```

Sign in with one of those emails, then open `/super-admin`. This route
uses server-side checks before service-role access. Do not use a
`NEXT_PUBLIC_` prefix for this variable.

### 3. Configure AI Provider

For Gemini testing:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
```

For OpenAI:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

AI calls are server-side only. Test safely from `/ai-test` before
connecting live WhatsApp traffic.

### 4. Optional Advanced CRM Webhook Allowlist

Advanced CRM automation webhook steps are HTTPS-only and block local/private
destinations by default. If you want to restrict them to known providers, set:

```bash
AUTOMATION_WEBHOOK_ALLOWED_HOSTS=hooks.zapier.com,*.make.com
```

Keep Advanced CRM tools disabled in `/super-admin` until you intentionally want
a Growth/Custom business to use those tools.

### 5. Configure Meta WhatsApp

In Meta for Developers and WhatsApp Manager, collect:

- WhatsApp phone number ID
- WABA ID
- access token
- webhook verify token
- Meta app secret

Set the webhook callback URL to:

```text
https://your-domain.com/api/whatsapp/webhook
```

For local testing, expose the app with a trusted HTTPS tunnel and use a
Meta test number or controlled pilot number. Do not invite real customer
traffic until the QA checklist passes.

### 6. Create and Configure a Business

1. Sign in as super admin and open `/super-admin`.
2. Create or select a business account.
3. Set package:
   - Starter: 1500 replies/month, 20 products/services, Lead Lite.
   - Growth: 5000 replies/month, 100 products/services, Full Leads.
   - Custom: manual reply/product limits and lead flags.
4. Add or confirm WhatsApp settings.
5. Turn the bot off until business knowledge and tests are ready.

### 7. Add Business Knowledge

Business users maintain their own normal updates:

- `/business-info`: description, location, opening hours, services, delivery, payment, ordering instructions, fallback message, and tone.
- `/products`: products and services with prices, availability, category, and description.
- `/knowledge`: FAQs and reusable answers.
- `/ai-test`: WhatsApp-style test chat using only that account's knowledge.
- `/usage`: package, AI reply usage, product count, bot status, lead mode, and WhatsApp readiness.

### 8. Test WhatsApp Safely

1. Test price, stock, opening hours, delivery, payment, and ordering in `/ai-test`.
2. Test unknown products and confirm the bot says the team will confirm.
3. Test unrelated questions and mixed questions.
4. Turn the bot on for the pilot account.
5. Send one controlled WhatsApp message from a staff phone.
6. Confirm the inbound and outgoing messages appear in `/inbox`.
7. Confirm `/usage` increments after the successful AI WhatsApp reply.
8. For Starter, confirm Lead Lite indicators appear in conversations only.
9. For Growth/Custom Full Leads, confirm `/leads` creates or updates a lead.

More operator docs:

- [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md)
- [`docs/FIRST_CLIENT_ONBOARDING.md`](./docs/FIRST_CLIENT_ONBOARDING.md)
- [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md)

## 🚀 Deploy on Hostinger (recommended)

<p align="center">
  <a href="https://www.hostinger.com/web-apps-hosting">
    <img src="./.github/assets/hostinger-deploy.png" alt="Ship your Node.js app in one click — Deploy to Hostinger" width="1000">
  </a>
</p>
<p align="center">
  <a href="https://wacrm.tech/docs/deployment-hostinger">
    <img src="https://img.shields.io/badge/Step--by--step_guide-wacrm.tech%2Fdocs-111?style=for-the-badge" alt="Step-by-step guide" height="44">
  </a>
</p>

**wacrm is built to run on [Hostinger](https://www.hostinger.com/web-apps-hosting).**
It's the path we test, document, and recommend — and the fastest way
to get a production-grade CRM live without owning a VPS or a
Kubernetes cluster.

### Why Hostinger?

|                                     |                                                                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One-click Git deploy**            | Connect your fork, push to `main`, Hostinger builds and ships it. No SSH, no Docker, no CI to wire up — this repo's own `main` deploys this way.                                                                            |
| **Managed Node.js**                 | Next.js 16 (App Router, server actions, ISR) runs out of the box on [Premium, Business, and Cloud](https://www.hostinger.com/web-apps-hosting) shared plans. You don't manage Node versions, processes, or reverse proxies. |
| **Free SSL + free domain**          | Automatic Let's Encrypt on your custom domain (or a free one included with annual plans). HTTPS is on by default — required for the WhatsApp Business webhook.                                                              |
| **Global CDN + LiteSpeed**          | Static assets cached at the edge, dynamic routes served from LiteSpeed. Snappy dashboards out of the box, no Cloudflare setup required.                                                                                     |
| **Env vars + logs in hPanel**       | Set `SUPABASE_*`, `WHATSAPP_*`, and `ENCRYPTION_KEY` from the panel — no `.env` on the server. Live application logs in the same UI.                                                                                        |
| **DDoS protection + daily backups** | Built-in, no add-ons. The webhook endpoint is a public target — having protection at the edge matters.                                                                                                                      |
| **Cheaper than a VPS**              | Plans start at a few dollars a month — order-of-magnitude less than a comparable managed Node.js host, and you don't pay extra for the database (that's Supabase).                                                          |
| **24/7 human support**              | Live chat support in 20+ languages — useful when your CRM is the thing your team relies on to talk to customers.                                                                                                            |

### The 60-second version

1. **Fork** this repo on GitHub.
2. In **hPanel → Websites → Create**, pick **Node.js** and connect
   your fork.
3. Paste your Supabase + Meta env vars into hPanel.
4. Push to `main`. Hostinger builds and serves it. Done.

Full walkthrough with screenshots:
**[wacrm.tech/docs/deployment-hostinger](https://wacrm.tech/docs/deployment-hostinger)**.

> _Note: wacrm is MIT-licensed and runs anywhere Node.js does
> (Vercel, Railway, your own VPS). Hostinger is recommended, not
> required._

## Documentation

Full self-host documentation — Supabase migrations, WhatsApp Business
API config, and production deploy — lives at
**[wacrm.tech/docs](https://wacrm.tech/docs)**
(source: [ArnasDon/wacrm-site](https://github.com/ArnasDon/wacrm-site)).

Key pages:

- [Getting started](https://wacrm.tech/docs/getting-started)
- [Supabase setup](https://wacrm.tech/docs/supabase-setup)
- [WhatsApp setup](https://wacrm.tech/docs/whatsapp-setup)
- [Environment variables](https://wacrm.tech/docs/environment-variables)
- [Deploy on Hostinger](https://wacrm.tech/docs/deployment-hostinger)
- [Architecture](https://wacrm.tech/docs/architecture)
- [Troubleshooting](https://wacrm.tech/docs/troubleshooting)

## Stack

- **App** — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- **Data** — Supabase (Postgres + Auth + Storage + RLS).
- **WhatsApp** — Meta Cloud API (official WhatsApp Business API).

## Contributing

This is a template, not a collaborative product — the expected flow is
fork → customise → deploy, **not** upstream contribution. Bug reports
and security issues are welcome; feature PRs often belong in your fork
rather than here. Details in
[`CONTRIBUTING.md`](./CONTRIBUTING.md) and
[`.github/SECURITY.md`](./.github/SECURITY.md).

## License

[MIT](./LICENSE). Fork it, brand it, host it.
