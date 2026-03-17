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
- `tbr_schedules` — Review schedules (frequency, next date, reminderEmail)
- `tbr_staging` — Staging notes, CSVs, **warranty_data** jsonb (serverHardware, merakiLicensing, lobApplications)
- `client_accounts` — Managed services clients with financial data, margin analysis, AR summary, **stack_compliance** jsonb
- `client_mapping` — Maps cwCompanyId → ninjaOrgId, huntressOrgId, cippTenantId, dropsuiteUserId for cross-system matching
- `dropsuite_accounts` — All DropSuite accounts from CSV imports (userId PK, companyName) — used for dropdown in mapping panel
- `app_settings` — Key-value application settings (e.g. TBR reminder emails: tbrEmailServiceManager, tbrEmailLeadEngineer, tbrEmailOther)
- `ar_only_clients` — Additional clients with AR-only data (CW IDs offset +100000)
- `users` — User accounts with roles and pageAccess jsonb

## Stack Compliance
Tools tracked per client. **Score excludes connectSecure and huntressSiem** (optional tools, shown but not counted):
- **ninjaRmm** — NinjaOne org match (required)
- **huntressEdr** — Huntress org match (required)
- **huntressItdr** — Huntress ITDR (required)
- **huntressSat** — Huntress SAT (required)
- **dropSuite** — DropSuite Backup (required)
- **zorusDns** — Zorus DNS (required)
- **connectSecure** — ConnectSecure (optional, not in score)
- **huntressSiem** — Huntress SIEM (optional, not in score)
- **msBizPremium** — Microsoft Business Premium (required, CIPP)
- **secureScore** — Secure Score % (CIPP) — shown in both list view and stack tab

Stack data is refreshed via `POST /api/clients/:id/stack/refresh`. Manual overrides stored in `manualOverrides` jsonb field.

## TBR Email Reminders
- Reminder job runs hourly, sends 3 days before any scheduled TBR
- Global recipients stored in `app_settings` (tbrEmailServiceManager, tbrEmailLeadEngineer, tbrEmailOther)
- Per-schedule email in `tbrSchedules.reminderEmail` (account manager)
- Configure global emails via "TBR Reminder Emails" card on the tracker page
- `/api/app-settings` GET/POST endpoints (admin-only write)

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
