# MSP Technology Business Review (TBR) Dashboard

## Overview
A client-facing TBR dashboard for MSP owners to screen-share during 30-minute semi-annual client review meetings. Pulls live data from MSP tools (NinjaOne, Huntress, ConnectWise), accepts manual CSV report uploads, and uses AI to generate a plain-language priority roadmap. Features TBR snapshot history for trend tracking across reviews.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js API routes
- **Database**: PostgreSQL (Neon-backed) for TBR snapshot history
- **Auth**: Individual user accounts with email/password login (bcrypt hashed), role-based access (admin/editor/viewer), bearer token sessions
- **AI**: Anthropic Claude via Replit AI Integrations for roadmap generation
- **Brand**: Pelycon Technologies (Orange #E77125, Storm Gray #394442, Poppins font)

## Key Files
- `shared/schema.ts` - TypeScript interfaces + Drizzle table definitions (tbrSnapshots, tbrSchedules, tbrStaging, clientAccounts)
- `server/db.ts` - PostgreSQL database connection (drizzle-orm/node-postgres)
- `server/storage.ts` - Storage interface for TBR snapshot, schedule, staging, and client account CRUD operations
- `server/routes.ts` - All API routes (auth, proxy to MSP APIs, CSV parsing, AI, export, TBR finalization, schedules, staging, accounts sync, margin analysis)
- `server/services/ninjaone.ts` - NinjaOne API integration (Legacy API Keys, HMAC-SHA1)
- `server/services/huntress.ts` - Huntress API integration (Basic auth)
- `server/services/connectwise.ts` - ConnectWise Manage API integration (Basic auth), addition categorization, labor/project cost separation
- `server/services/roadmap.ts` - Claude AI roadmap generation (executive summary + priority items)
- `server/services/export.ts` - HTML summary export ("No Surprises" framework)
- `server/services/email.ts` - SMTP2GO REST API email service for TBR reminders
- `server/services/reminderJob.ts` - Background job checking every hour for TBRs due in 2 days
- `client/src/App.tsx` - Main app with auth, wouter routing, shadcn sidebar navigation
- `client/src/pages/login.tsx` - Email/password login page with first-time setup flow
- `client/src/pages/dashboard.tsx` - Main TBR dashboard with all sections + Finalize TBR
- `client/src/pages/tracker.tsx` - TBR Tracker: review schedules, overdue/upcoming alerts
- `client/src/pages/staging.tsx` - TBR Staging Area: pre-enter engineer/SM notes, upload MFA/License CSVs
- `client/src/pages/accounts.tsx` - Client Accounts: managed services roster, TBR compliance, revenue, tier management, separated service/project margins
- `client/src/components/meeting-export.tsx` - Export buttons: PDF download (html2pdf.js) and Print

## Client Accounts & Revenue
- **Tier Logic**: A (≥$60k/yr), B ($24k–$60k/yr), C (<$24k/yr) based on total revenue. Manual tier overrides stored in `tier_override` column.
- **12-Month Lookback Window**: All financial data (labor hours, invoices, revenue) uses a consistent 12-month lookback from current date.
- **Agreement Revenue**: Annualized from ConnectWise `billAmount * 12` on non-cancelled agreements. Falls back to actual Agreement-type invoice totals from the last 12 months.
- **Project Revenue**: Sum of Standard/Progress/Miscellaneous invoices from the last 12 months.
- **Total Revenue**: Agreement + Project (annualized).

## Margin Calculation (Separated Service vs Project)
- **Service Margin** = (Agreement Rev − MS Rev − Service Labor − Product Costs) / (Agreement Rev − MS Rev). Only agreement labor (service tickets) and third-party product costs count against agreement revenue.
- **Project Margin** = (Project Rev − Project Labor) / Project Rev. Only project ticket labor counts against project revenue.
- **Overall Margin** = (Total Rev − MS Rev − All Labor − Product Costs) / (Total Rev − MS Rev). Combined view.
- **Labor Cost Separation**: `serviceLaborCost` from service ticket time entries, `projectLaborCost` from project ticket time entries. Both from `/time/entries` with `chargeToType` field.
- **Addition Cost**: From `/finance/agreements/{id}/additions` — uses `extendedCost/qty` when available (preferred), falls back to `unitCost`. Debug logging shows raw API values for verification.
- **Addition Categories**: "labor" (managed services with labor-backed cost), "microsoft" (fixed ~16% margin, pass-through, excluded from margin calc), or "other" (third-party products included in margin).
- **Microsoft Licensing**: Excluded from all margin calculations. Tracked separately (`msLicensingRevenue`, `msLicensingCost`). Never cited as improvement opportunity in insights.
- **Margin Thresholds**: green ≥70%, yellow ≥55%, orange <55%.

## Margin Analysis Engine
Rule-based analysis generates concise, plain-English insights stored in `marginAnalysis` jsonb. Computed during sync and on-the-fly for existing data. Analysis checks:
- Service Agreement Margin (service labor + product costs vs agreement revenue)
- Project Margin (project labor vs project revenue)
- Unbilled Project Work (project hours with $0 revenue)
- Microsoft Licensing info (excluded from margin)
- Low-Margin Third-Party Products (<20%)
- Expensive Engineer Concentration (>40% of cost at $80+/hr)
- Overall Margin warnings (<55%) and suggestions (<70%)

## Schema Columns (clientAccounts)
`laborCost`, `serviceLaborCost`, `projectLaborCost`, `additionCost`, `msLicensingRevenue`, `msLicensingCost`, `totalCost`, `serviceMarginPercent`, `projectMarginPercent`, `grossMarginPercent`, `serviceHours`, `projectHours`, `totalHours`, `engineerBreakdown` (jsonb), `agreementAdditions` (jsonb with category field), `marginAnalysis` (jsonb)

## Auto-Sync
- ConnectWise financial data syncs automatically every 6 hours (first run 30s after startup)
- Manual "Sync from ConnectWise" button still available
- Sync only updates financial data (`client_accounts`); TBR schedules and snapshots are stored separately and never overwritten by sync
- TBR status (green/yellow/red) is computed live on each Accounts page load by matching schedule `orgName` to account `companyName` (case-insensitive)

## TBR Status
- Green = reviewed within 6mo AND has future scheduled review
- Yellow = missing one or both
- Red = never reviewed

## Environment Variables
All API keys stored as Replit Secrets:
- NINJAONE_CLIENT_ID, NINJAONE_CLIENT_SECRET, NINJAONE_INSTANCE
- NINJAONE_LEGACY_KEY_ID, NINJAONE_LEGACY_SECRET
- HUNTRESS_API_KEY, HUNTRESS_API_SECRET
- HUNTRESS_SAT_API_KEY, HUNTRESS_SAT_API_SECRET
- CW_COMPANY_ID, CW_PUBLIC_KEY, CW_PRIVATE_KEY, CW_CLIENT_ID, CW_SITE_URL
- DASHBOARD_PASSWORD, SESSION_SECRET
- SMTP2GO_API_KEY, SMTP_FROM
- DATABASE_URL (auto-configured)
- AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL (auto-configured)

## User Preferences
Simple language in explanations. Iterative development. Ask before major changes. Detailed explanations.
