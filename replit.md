# Pelycon Executive Management Platform

## Overview
A full-stack executive dashboard for Pelycon Technologies (MSP). Pulls live data from NinjaOne, Huntress, and ConnectWise. Features client management, stack compliance tracking, receivables, TBR snapshot history, AR/catch-up analysis, per-user page access control, and AI-generated roadmaps.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js API routes
- **Database**: PostgreSQL (Neon-backed), Drizzle ORM
- **Auth**: Email/password login (bcrypt), role-based access (admin/editor/viewer), per-user page access control (jsonb `pageAccess`), bearer token sessions
- **AI**: Anthropic Claude via Replit AI Integrations for roadmap generation
- **Brand**: Pelycon Technologies — Orange #E77125, Storm Gray #394442, Poppins font

## Navigation Structure
- **Sales** → Sales Pipeline skeleton (`/sales`, Quoter API pending)
- **Clients** → Client Management (`/clients`), Receivables (`/receivables`)
- **Operations** → TBR Tracker (`/`), TBR Reviews (`/reviews`), TBR Staging (`/staging`)
- **Admin** → User Management (`/users`, admin-only)

## Key Files
- `shared/schema.ts` — All TypeScript interfaces + Drizzle table definitions
- `server/db.ts` — PostgreSQL connection (drizzle-orm/node-postgres)
- `server/storage.ts` — IStorage interface + DatabaseStorage implementation
- `server/routes.ts` — All API routes
- `server/services/ninjaone.ts` — NinjaOne API (Legacy API Keys, HMAC-SHA1)
- `server/services/huntress.ts` — Huntress API (Basic auth)
- `server/services/connectwise.ts` — ConnectWise Manage API
- `server/services/cipp.ts` — CIPP integration (MS Business Premium + Secure Score, uses CIPP_BASE_URL + CIPP_API_KEY)
- `server/services/roadmap.ts` — Claude AI roadmap generation
- `server/services/export.ts` — HTML summary export
- `server/services/email.ts` — SMTP2GO email service for TBR reminders
- `server/services/reminderJob.ts` — Background job for TBR reminders
- `client/src/App.tsx` — Main app, auth, grouped sidebar navigation, route gating
- `client/src/pages/login.tsx` — Login + first-time setup
- `client/src/pages/clients.tsx` — **NEW** Client Management: list + stack compliance table + side panel (Overview/Financials/TBR/AR tabs)
- `client/src/pages/sales.tsx` — **NEW** Sales Pipeline skeleton (Quoter API pending)
- `client/src/pages/dashboard.tsx` — TBR Reviews: main TBR dashboard with finalize flow
- `client/src/pages/tracker.tsx` — TBR Tracker: schedules, overdue/upcoming alerts
- `client/src/pages/staging.tsx` — TBR Staging: engineer/SM notes, MFA/License CSVs, **warranty data** (server HW, Meraki, LOB apps)
- `client/src/pages/receivables.tsx` — AR/Receivables analysis
- `client/src/pages/user-management.tsx` — User management with per-page access toggles

## Database Tables
- `tbr_snapshots` — Finalized TBR reviews
- `tbr_schedules` — Review schedules (frequency, next date)
- `tbr_staging` — Staging notes, CSVs, **warranty_data** jsonb (serverHardware, merakiLicensing, lobApplications)
- `client_accounts` — Managed services clients with financial data, margin analysis, AR summary, **stack_compliance** jsonb
- `client_mapping` — **NEW** Maps cwCompanyId → ninjaOrgId, huntressOrgId, cippTenantId for cross-system matching
- `ar_only_clients` — Additional clients with AR-only data (CW IDs offset +100000)
- `users` — User accounts with roles and pageAccess jsonb

## Stack Compliance
Tools tracked per client:
- **ninjaRmm** — NinjaOne org match (auto-detected by name)
- **huntressEdr** — Huntress org match (auto-detected by name)
- **huntressItdr** — Huntress ITDR (manual or future API)
- **huntressSat** — Huntress SAT (manual or future API)
- **dropSuite** — DropSuite Backup (manual toggle)
- **zorusDns** — Zorus DNS (future: Ninja installed SW scan)
- **connectSecure** — ConnectSecure (manual or future API)
- **huntressSiem** — Huntress SIEM (manual or future API)
- **msBizPremium** — Microsoft Business Premium (CIPP, requires CIPP_BASE_URL + CIPP_API_KEY)
- **secureScore** — Secure Score % (CIPP, requires CIPP_BASE_URL + CIPP_API_KEY)

Stack data is refreshed via `POST /api/clients/:id/stack/refresh`. Manual overrides stored in `manualOverrides` jsonb field.

## Page Access Keys
Defined in `ALL_PAGE_KEYS` in `App.tsx`:
- `sales`, `clients`, `receivables`, `dashboard`, `reviews`, `staging`
Admin users always have full access.

## External API Credentials (Environment Secrets)
- `NINJA_API_URL`, `NINJA_CLIENT_ID`, `NINJA_CLIENT_SECRET` — NinjaOne
- `HUNTRESS_API_KEY`, `HUNTRESS_API_SECRET`, `HUNTRESS_SAT_API_KEY`, `HUNTRESS_SAT_API_SECRET` — Huntress
- `CW_BASE_URL`, `CW_CLIENT_ID`, `CW_PUBLIC_KEY`, `CW_PRIVATE_KEY`, `CW_COMPANY_ID` — ConnectWise
- `CIPP_BASE_URL`, `CIPP_API_KEY` — CIPP (MS Business Premium + Secure Score)
- `ANTHROPIC_API_KEY` — Claude AI
- `SMTP2GO_API_KEY`, `EMAIL_FROM` — Email reminders
