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
  `quotes`, `payments`, `users`, `settings`, `activity`, `suppliers`,
  `purchaseOrders`, `tasks`, `expenses`), holding the whole list as JSON.
  All writes go through `api/_kv.js`, which whitelists which keys are
  writable.
- Auth: PIN login → HMAC-SHA256 signed session token (`api/_session.js`,
  `api/auth.js`). No passwords, no OAuth.
- Roles + per-user page grants: role (`admin` > `sales` / `procurement` /
  `finance` / `aftersales`) plus a `pages` array on each user, so e.g. a
  Sales lead can be granted Reports access without a new role.
- UI: off-canvas sidebar (hamburger toggle, top-left) so the content area
  is always full width — same layout on mobile and desktop. Brand palette
  (blue/green/navy) sampled from the MIDA logo; the sidebar brand mark is a
  styled placeholder pending the real logo asset file.

## Modules in this build

**Phase 1**
- Auth / roles
- CRM — buyer accounts (single contact per account for now)
- Product catalog — AC/DC charger specs live under a free-form
  `attributes` object so a future category (batteries, solar, ...) doesn't
  need a schema migration
- Quotes & Invoices — line items with a single negotiated unit price (no
  quantity-break tiers), multi-currency (RMB default, USD/EUR available) with a free-text FX
  note, deposit %/balance split, status flow draft → sent → accepted →
  deposit paid → in production → balance paid → shipped → closed, print/PDF
  view
- Payments — ledger entries against a quote (wire/T-T, Alibaba Trade
  Assurance/escrow, card/PayPal/Stripe), multiple payments per quote
- WhatsApp click-to-chat — `wa.me` link generated per buyer contact
- Settings — company name, default currency, notification emails
- Users & Roles, Activity Log (admin only)
- EN/中文 UI toggle, persisted per-browser

**Phase 2**
- Procurement / Supplier Sourcing — factory/supplier directory, purchase
  orders with a line-item cost table, RFQ→quoted→ordered→...→received
  status flow (RFQ comparison in v1 = create one draft PO per candidate
  supplier, mark the winner "ordered")
- Scheduling — hand-rolled month calendar surfacing quote and PO ready-by
  dates
- Expenses — photo capture (stored as a data URL, no blob storage wired up
  yet) + category (built-ins, or type your own under "Other" and optionally
  save it for reuse) + Finance/Admin approval, plus a period-total stat
  (last 24h / 7d / 30d / 1y, default 30d) broken out by currency. A gear
  icon on the page opens a settings panel to rename/delete saved custom
  categories (renames cascade onto existing expense records) and, for
  admins, change the app's default currency.
- Tasks — generic assignable task list with due dates. A notification bell
  in the topbar badges unread task assignments (polls every 45s) and opens
  a dropdown that jumps to the Tasks page; the badge clears on visiting it.
- Reports — revenue by buyer/product, spend by supplier, approved expenses
  by category, open pipeline value, computed on the fly (no stored key)

Not yet built: After-Sales/Claims, lightweight Logistics tracker, full
WhatsApp Business API inbox.

## Decisions locked in for this build

- **Inventory:** most stock ships direct from the manufacturer to the
  buyer and isn't held in-house; where it is held, it's pooled across the
  Shanghai and Shenzhen offices rather than tracked per-location in v1.
- **Quote currency:** multi-currency (RMB default, USD/EUR available) with a free-text FX
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
