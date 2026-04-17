# Pelycon Platform — Claude working notes

Full-stack TypeScript platform for Pelycon Technologies (MSP). React + Vite + Tailwind + shadcn/ui frontend, Express backend, PostgreSQL via Drizzle ORM (Neon-hosted). Originally exported from Replit.

## Product horizons

1. **Now** — internal MSP tool: TBR lifecycle, client accounts + margin analysis, stack compliance, receivables/AR, sales pipeline
2. **Next** — client portal with M365 SSO: ticket "pizza tracker", invoices + pay links, agreements, security dashboard (Secure Score, MFA, DKIM/DMARC/SPF), assets, trends, announcements/KB
3. **Later** — multi-MSP SaaS: `tenantId` on every record, PSA/RMM/Security/M365 through adapter interfaces (ConnectWise today, HaloPSA next), per-tenant branding

## Source-of-truth planning docs (read first for substantive work)

- `pelycon-platform-architecture-plan.md` — full multi-tenant target architecture
- `phase1-task-checklist.md` — restructure + tenant schema + adapter stubs
- `phase2-task-checklist.md` — ConnectWise adapter, M365 SSO, client portal MVP
- `replit.md` — original Replit-generated overview (still the best integration reference)

## Architectural rules (do not break)

- **Every new table gets `tenantId: integer().notNull()`** — default `1` (Pelycon) during backfill. No exceptions.
- **Portal routes never call `connectwise.ts` / `ninjaone.ts` / `huntress.ts` directly.** Go through the adapter (`server/adapters/psa/*`, etc.). Internal legacy routes can still call services directly until they're migrated.
- **Client-facing routes live under `/api/portal/*`** and require `requireClientAuth` — they must be scoped by the authenticated user's `clientId`. Never trust a `clientId` from the request body.
- **No secrets in committed files.** `.env` is gitignored — keep it that way.

## Code layout

```
server/
  routes/              # domain modules (auth, tbr, accounts, clients, ...)
    portal/            # client-facing (tickets, invoices, security, ...)
  middleware/          # auth, tenant, portalAuth
  adapters/            # psa, rmm, security, m365 — interface + factory + impls
  services/            # integration clients + background jobs
  scripts/             # seed-tenant.ts, one-off maintenance
  utils/               # matching.ts, shared helpers
  db.ts storage.ts index.ts routes.ts (thin registrar) static.ts vite.ts
shared/
  schema.ts            # all Drizzle tables — single source of truth
  types/               # adapter-layer types (psa.ts, ...)
client/src/
  pages/               # internal (MSP staff) pages
  portals/client/      # client-facing portal pages
  components/ hooks/ lib/ App.tsx
```

## Brand

- Orange `#E77125`, Storm Gray `#394442`, Poppins font
- Name on login + sidebar: "Pelycon Executive Management Platform"

## Dev commands

```bash
npm run dev        # tsx server/index.ts — dev server
npm run build      # tsx script/build.ts
npm run start      # node dist/index.cjs — prod
npm run check      # tsc — type check
npm run db:push    # drizzle-kit push — apply schema to DB
```

After any schema change: `npm run db:push` before testing.
After any code change: `npm run check` to verify TypeScript.

## Integrations (env vars in `.env.example`)

ConnectWise Manage (PSA), NinjaOne (RMM), Huntress EDR + SAT, CIPP (M365/Secure Score), DropSuite (backup), Quoter (sales), Anthropic Claude (AI roadmaps), SMTP2GO (TBR reminder emails).

## Current status (as of 2026-04-17)

Phase 1 restructure is substantially done; Phase 2 client portal scaffolding exists with real code (tickets, pizza tracker, invoices, agreements, security, assets, trends, KB — ~2,200 lines). Both phases were uncommitted as of this date; see git log to confirm what's landed.
