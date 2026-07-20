# Wholesale Ops

Internal wholesale operations dashboard for a China-based EV charger trading
company (B2B only — no retail/end-consumer sales). Independent app; no code
or data shared with any other internal tool.

## Architecture

Same lightweight pattern throughout: no build step, no framework, no
database server to manage.

- `index.html` — single-file vanilla JS SPA (login, nav shell, all pages).
- `api/*.js` — Vercel serverless functions, one file per data domain.
- Upstash Redis — one key per data domain (`customers`, `products`,
  `quotes`, `payments`, `users`, `settings`, `activity`), holding the whole
  list as JSON. All writes go through `api/_kv.js`, which whitelists which
  keys are writable.
- Auth: PIN login → HMAC-SHA256 signed session token (`api/_session.js`,
  `api/auth.js`). No passwords, no OAuth.
- Roles + per-user page grants: role (`admin` > `sales` / `procurement` /
  `finance` / `aftersales`) plus a `pages` array on each user, so e.g. a
  Sales lead can be granted Reports access without a new role.

## Modules in this build (Phase 1)

- Auth / roles
- CRM — buyer accounts (single contact per account for now)
- Product catalog — AC/DC charger specs live under a free-form
  `attributes` object so a future category (batteries, solar, ...) doesn't
  need a schema migration
- Quotes & Invoices — line items with a single negotiated unit price (no
  quantity-break tiers), multi-currency (USD/RMB/EUR) with a free-text FX
  note, deposit %/balance split, status flow draft → sent → accepted →
  deposit paid → in production → balance paid → shipped → closed, print/PDF
  view
- Payments — ledger entries against a quote (wire/T-T, Alibaba Trade
  Assurance/escrow, card/PayPal/Stripe), multiple payments per quote
- WhatsApp click-to-chat — `wa.me` link generated per buyer contact
- Settings — company name, default currency, notification emails
- Users & Roles, Activity Log (admin only)
- EN/中文 UI toggle, persisted per-browser

Not yet built (see "Suggested build order" from the original brief):
Procurement/Supplier Sourcing, Scheduling calendar, Expenses, Tasks,
Reports, After-Sales/Claims, lightweight Logistics tracker, full WhatsApp
Business API inbox.

## Decisions locked in for this build

- **Inventory:** most stock ships direct from the manufacturer to the
  buyer and isn't held in-house; where it is held, it's pooled across the
  Shanghai and Shenzhen offices rather than tracked per-location in v1.
- **Quote currency:** multi-currency (USD/RMB/EUR) with a free-text FX
  note field on the quote, not automatic conversion.
- **Pricing:** single negotiated price per quote line item — no
  quantity-break tier table.
- **CRM shape:** one contact per buyer account for now (company name,
  contact, tax ID, country, payment method, deal stage).

## Still open (confirm before Phase 3)

- After-Sales claim shape: what a claim looks like, whether photos/videos
  are required, and whether resolution is replacement/credit/refund.
- Whether Alibaba.com / Made-in-China / Global Sources should feed leads
  into the CRM, or all outreach stays direct.

## Setup

1. Create a new Upstash Redis database (separate from any other project).
2. Copy `.env.example` to `.env` (local dev) or set the same variables as
   Vercel project env vars:
   - `SESSION_SECRET` — long random string.
   - `BUILT_IN_PINS` — bootstrap admin(s), e.g.
     `1234:Mehmet:admin,5678:Wei:sales`. Used only when the `users` key is
     empty (first run).
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN` — from the Upstash dashboard.
3. Deploy with `vercel` (or connect the repo in the Vercel dashboard).
4. Log in with one of the `BUILT_IN_PINS`, then create real users from the
   Users & Roles page and rotate/remove the bootstrap PIN.

## Local development

Use the Vercel CLI (`vercel dev`) so the `/api/*` serverless functions run
alongside `index.html` — opening `index.html` directly in a browser will
not have a backend to talk to.
