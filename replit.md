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
- `shared/schema.ts` - TypeScript interfaces + Drizzle table definitions (tbrSnapshots, tbrSchedules, tbrStaging, clientAccounts, arOnlyClients)
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
- **12-Month Lookback Window**: All financial data (labor hours, invoices, revenue) uses a consistent trailing 12-month window from current date.
- **Agreement Revenue**: Uses actual invoiced Agreement-type invoice totals from the trailing 12 months (primary). Falls back to projected `billAmount * 12` only if no invoices are found. This ensures numbers match accounting system actuals.
- **Project Revenue**: Sum of Standard/Progress/Miscellaneous invoices from the last 12 months.
- **Total Revenue**: Agreement + Project (annualized).

## Margin Calculation (Separated Service vs Project)
- **Agreement Margin** = (Agreement Rev − MS Rev − Agreement Labor − Product Costs) / (Agreement Rev − MS Rev). Only agreement labor (service tickets) and third-party product costs count against agreement revenue.
- **Project Margin** = (Project Rev − Project Labor − Project Product Costs − Expense Costs) / Project Rev. Project ticket labor, non-agreement product costs, and expense costs count against project revenue.
- **Overall Margin** = (Total Rev − MS Rev − All Labor − Product Costs − Project Product Costs − Expense Costs) / (Total Rev − MS Rev). Combined view.
- **Labor Cost Separation**: `serviceLaborCost` from service ticket time entries, `projectLaborCost` from project ticket time entries. Both from `/time/entries` with `chargeToType` field.
- **Addition Cost**: Uses actual invoiced costs from CW Reports API `Product` report (primary) — sums `Extended_Cost` for agreement-linked products invoiced in trailing 12 months. Falls back to projected `/finance/agreements/{id}/additions` costs × 12 only if no invoiced product data found.
- **Project Product Cost**: Non-agreement product costs from the Product report — products on Standard/Progress/Misc invoices that aren't tied to an agreement. These are standalone hardware, software, or project-related product sales. Previously missing, which inflated margins.
- **Expense Cost**: From CW Reports API `Expense` report — sums `Expense_Cost` for invoiced expense entries (Parts and Supplies, mileage, etc.) in the trailing 12 months. Deducted from project margin and overall margin.
- **Addition Categories**: "labor" (managed services with labor-backed cost), "microsoft" (fixed ~16% margin, pass-through, excluded from margin calc), or "other" (third-party products included in margin).
- **Microsoft Licensing Toggle**: "Include MS Licensing" switch on Accounts page. OFF (default) = MS excluded from both revenue and cost in margin calc. ON = MS revenue and cost both included. Toggle applies to summary cards, table margin column, and detail dialog. Backend analysis insights always use the "excluded" baseline.
- **Margin Thresholds (Agreement/Project)**: green ≥60%, yellow 50–59%, red <50%. **(Overall)**: green ≥52%, yellow 43–51%, red <43%.

## Margin Analysis Engine
Rule-based analysis generates concise, plain-English insights stored in `marginAnalysis` jsonb. Computed during sync and on-the-fly for existing data. Analysis checks:
- Agreement Margin (agreement labor + product costs vs agreement revenue)
- Project Margin (project labor vs project revenue)
- Unbilled Project Work (project hours with $0 revenue)
- Microsoft Licensing info (excluded from margin)
- Low-Margin Third-Party Products (<20%)
- Expensive Engineer Concentration (>40% of cost at $80+/hr)
- Overall Margin warnings (<55%) and suggestions (<70%)

## Accounts Receivable (AR) Tracking
- **Data Source**: CW `/finance/invoices` API — fetches all invoices per company for trailing 18 months
- **Payment Timing**: Uses `_info.lastUpdated` as payment date proxy for paid invoices. Compares against invoice date to compute days-to-pay.
- **Aging Buckets**: Current (not yet due), 1–30 days overdue, 31–60, 61–90, 91+ days past due
- **On-Time Calculation**: Payment is "on-time" if days-to-pay ≤ (due days + 5 day grace period)
- **Payment Score**: A (avg ≤30d, ≥80% on-time, no 61+ aging), B (avg ≤45d, ≥60% on-time, no 91+ aging), C (avg ≤60d or ≥40% on-time), D (worse or no data)
- **Monthly Trend**: On-time percentage by invoice month, last 12 months
- **Stored in**: `arSummary` jsonb column on `clientAccounts` (managed services) and `arOnlyClients` table (agreement-only). Both synced during 6-hour auto-sync.
- **arOnlyClients table**: Stores companies with active CW agreements that are NOT in the managed services roster (not one of the 3 MS agreement types). Fields: `cwCompanyId`, `companyName`, `agreementTypes`, `agreementMonthlyRevenue`, `arSummary` (jsonb), `lastSyncedAt`.
- **Receivables endpoint**: `GET /api/receivables/clients` merges `clientAccounts` + `arOnlyClients` into a unified list with `source` field ("managed" or "agreement-only"). AR-only client IDs are offset by +100000 to avoid collision.
- **Frontend**: `/receivables` page — portfolio summary cards, aging bar, sortable client table with drill-down dialog showing aging breakdown, payment trend chart, and invoice-level detail. Source filter (All/Managed/Agreement Only) and "AGR" badge on agreement-only rows.
- **Catch-Up Analysis**: Checkbox multi-select (up to 6 clients) opens a catch-up panel showing per-client payment velocity (recent 6mo vs prior 6mo), running balance trend, monthly payment chart overlaid with cumulative balance, and recent payment activity table. Auto-labels "Catching Up" (freq +10% or balance -10%), "Falling Behind" (freq -20% and balance +10%), or "Steady".
- **Invoice paidDate**: `ARInvoiceEntry.paidDate` derived from CW `_info.lastUpdated` for paid invoices, enables payment timeline analysis.
- **On-demand refresh**: `GET /api/accounts/:id/ar-refresh` for single-account AR update

## Schema Columns (clientAccounts)
`laborCost`, `serviceLaborCost`, `projectLaborCost`, `additionCost`, `projectProductCost`, `expenseCost`, `msLicensingRevenue`, `msLicensingCost`, `totalCost`, `serviceMarginPercent`, `projectMarginPercent`, `grossMarginPercent`, `serviceHours`, `projectHours`, `totalHours`, `engineerBreakdown` (jsonb), `agreementAdditions` (jsonb with category field), `marginAnalysis` (jsonb)

## Auto-Sync
- ConnectWise financial data syncs automatically every 6 hours (first run 30s after startup)
- Sync includes: 48 managed services clients (financials + AR) + ~67 agreement-only clients (AR only)
- Manual "Sync from ConnectWise" button still available (syncs both sets)
- `GET /api/receivables/sync` triggers AR-only client sync independently
- Sync only updates financial data (`client_accounts`) and AR data (`ar_only_clients`); TBR schedules and snapshots are stored separately and never overwritten by sync
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
