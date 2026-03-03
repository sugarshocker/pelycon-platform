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
- `shared/schema.ts` - TypeScript interfaces + Drizzle table definitions (tbrSnapshots, tbrSchedules, tbrStaging)
- `server/db.ts` - PostgreSQL database connection (drizzle-orm/node-postgres)
- `server/storage.ts` - Storage interface for TBR snapshot, schedule, and staging CRUD operations
- `server/routes.ts` - All API routes (auth, proxy to MSP APIs, CSV parsing, AI, export, TBR finalization, schedules, staging)
- `server/services/ninjaone.ts` - NinjaOne API integration (Legacy API Keys, HMAC-SHA1)
- `server/services/huntress.ts` - Huntress API integration (Basic auth)
- `server/services/connectwise.ts` - ConnectWise Manage API integration (Basic auth)
- `server/services/roadmap.ts` - Claude AI roadmap generation (executive summary + priority items)
- `server/services/export.ts` - HTML summary export ("No Surprises" framework)
- `server/services/email.ts` - SMTP2GO REST API email service for TBR reminders (uses SMTP2GO_API_KEY + SMTP_FROM)
- `server/services/reminderJob.ts` - Background job checking every hour for TBRs due in 2 days, sends email reminders
- `client/src/App.tsx` - Main app with auth, wouter routing, shadcn sidebar navigation
- `client/src/pages/login.tsx` - Email/password login page with first-time setup flow (Pelycon branded)
- `client/src/pages/user-management.tsx` - Admin user management: create, edit, delete user accounts with role assignment
- `client/src/pages/dashboard.tsx` - Main TBR dashboard with all sections + Finalize TBR
- `client/src/pages/tracker.tsx` - TBR Tracker: review schedules, overdue/upcoming alerts, recent completions
- `client/src/pages/staging.tsx` - TBR Staging Area: pre-enter engineer/SM notes, upload MFA/License CSVs
- `client/src/components/` - Dashboard section components
- `client/src/pages/accounts.tsx` - Client Accounts: managed services roster, TBR compliance, revenue, tier management
- `client/src/components/meeting-export.tsx` - Export buttons: PDF download (html2pdf.js) and Print (passes previousSnapshot to export)

## API Routes
- `POST /api/auth/login` - Email/password authentication (bearer token + user info)
- `GET /api/auth/check` - Session check (returns user info)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/needs-setup` - Check if initial admin account needs to be created
- `POST /api/auth/setup` - Create first admin account (one-time setup)
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create new user (admin only)
- `PATCH /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only, cannot self-delete)
- `GET /api/status` - API connection status
- `GET /api/organizations` - List clients from NinjaOne
- `GET /api/devices/:orgId` - Device health from NinjaOne
- `GET /api/security/:orgId` - Security data from Huntress
- `GET /api/coverage-gap/:orgId` - Compare NinjaOne devices vs Huntress agents
- `GET /api/device-users/:orgId` - Device-user inventory (hostname, user, type, OS, age, Huntress status)
- `GET /api/tickets/:orgId` - Ticket data from ConnectWise
- `POST /api/reports/mfa` - Upload MFA CSV
- `POST /api/reports/license` - Upload License CSV
- `GET /api/projects/:orgId` - Project items from ConnectWise (project board + project tickets)
- `POST /api/projects/summarize` - AI-generated project summary
- `POST /api/roadmap/generate` - AI roadmap generation
- `POST /api/export/summary` - HTML summary export (accepts previousSnapshot for trends)
- `GET /api/export/snapshot/:id` - Generate PDF-ready HTML from a stored TBR snapshot's fullData
- `POST /api/tbr/save-draft` - Save TBR as draft (preserves CSV reports, notes, roadmap, live data)
- `GET /api/tbr/draft/:orgId` - Load existing draft for an org
- `DELETE /api/tbr/draft/:id` - Discard a draft
- `GET /api/tbr/drafts` - List all open drafts across all clients
- `POST /api/tbr/finalize` - Finalize TBR snapshot (promotes draft if exists), returns snapshot with ID
- `POST /api/connectwise/ticket` - Create follow-up ticket in ConnectWise (Medium priority, client's service board, saves cwTicketId to snapshot)
- `POST /api/tbr/unfinalize/:id` - Reopen a finalized TBR as a draft (blocked if draft already exists for that client)
- `GET /api/tbr/history/:orgId` - List finalized TBR snapshots for an org
- `GET /api/tbr/snapshot/:id` - Get a single snapshot by ID
- `GET /api/tbr/latest/:orgId` - Get latest + previous finalized snapshot for trend comparison
- `GET /api/reminders/status` - Check email configuration and pending reminders
- `POST /api/reminders/send-now` - Manually trigger sending due reminders
- `GET /api/accounts` - List all client accounts with TBR status, revenue, tier info
- `GET /api/accounts/sync` - Sync managed services clients from ConnectWise agreements
- `PATCH /api/accounts/:id/tier` - Override client tier (A/B/C)

## Dashboard Architecture (Two-View Workflow)
- **Overview View**: Client selector, draft management banner, inline past review list with expand/collapse, per-snapshot actions (Download PDF, Reopen as Draft), Start New Review button. No live API data loaded.
- **Editor View**: On-demand data loading from NinjaOne/Huntress/ConnectWise. All editing sections (Device Health, Security, Tickets, Projects, CIPP Reports, Internal Notes, Client Feedback, AI Roadmap). Save Draft / Finalize / PDF export. Back button returns to Overview.
- **Draft auto-load**: Editor loads draft fullData (CSV reports, notes, feedback, roadmap) when resuming a draft.
- **Staging auto-import**: When starting a new review (no draft), if staging data exists for that client, a banner appears offering to import engineer notes, SM notes, MFA/license reports. After finalizing, staging data is automatically cleared.
- **Un-finalize**: Reopens a finalized TBR as a draft for editing; blocked if another draft exists for that client.

## TBR Snapshot System
- **Save Draft**: Saves current TBR state including live data (deviceHealth, security, tickets), CSV reports, notes, roadmap, and client feedback as a draft. Only one draft per org at a time.
- **Finalize TBR**: Records key metrics as a finalized snapshot. Promotes existing draft if one exists. Used for trend comparison.
- **Past Reviews**: Inline list in Overview with expandable detail cards showing metrics, trend comparisons, notes, and feedback.
- **Trend Tracking**: Editor shows previous TBR banner; snapshot cards show deltas between consecutive reviews.
- **Export Integration**: HTML export includes "Progress Since Last Review" table when previous snapshot exists. Stored snapshots can generate PDFs from fullData.
- **Schedule Linkage**: Snapshots can be linked to a schedule entry via `scheduleId` and `reviewDate`. When navigating from a scheduled calendar event, the `scheduleId` and `reviewDate` are passed through URL params → dashboard → save-draft/finalize payload. On finalization, if linked to a schedule, the schedule's `lastReviewDate` is updated and `nextReviewDate` is auto-advanced by the schedule's frequency. Calendar shows finalized TBRs on their `reviewDate` (not `createdAt`) when linked.
- **Schema**: `tbr_snapshots` table with orgId, orgName, createdAt, updatedAt, status (draft/finalized), fullData (jsonb with deviceHealth, security, tickets, mfaReport, licenseReport, roadmap, internalNotes, clientFeedback), cwTicketId (ConnectWise follow-up ticket number), scheduleId (linked schedule entry), reviewDate (scheduled review date string), and ~20 metric columns

## Client Accounts & Revenue
- **Tier Logic**: A (≥$60k/yr), B ($24k–$60k/yr), C (<$24k/yr) based on total revenue. Manual tier overrides stored in `tier_override` column.
- **Agreement Revenue**: Annualized from ConnectWise `billAmount * 12` on non-cancelled agreements. Falls back to actual Agreement-type invoice totals from the last 12 months when billAmount is $0 (common for addition-billed agreements). Also falls back to `getManagedServicesClients` known revenue during sync.
- **Project Revenue**: Sum of Standard/Progress/Miscellaneous invoices from the last 12 months.
- **Total Revenue**: Agreement + Project (annualized).
- **Labor Cost & Margin**: Calculated from ConnectWise `/time/entries` for the last 12 months. Groups hours by engineer, fetches `hourlyCost` from `/system/members/{id}` (cached). Cost = sum(hours × engineer cost rate). Margin = (revenue - labor cost) / revenue. Per-engineer breakdown stored in `engineerBreakdown` jsonb column showing service hours, project hours, hourly cost, and total cost per engineer. Sorted by highest cost contributor first.
- **Engineer Breakdown Dialog**: Click on any client's Labor Cost or Margin cell to see per-engineer breakdown with hours, cost rates, and cost share percentage. Warning shown if engineers lack cost rates in ConnectWise.
- **Schema Columns**: `laborCost`, `totalCost`, `serviceHours`, `projectHours`, `totalHours`, `engineerBreakdown` (jsonb)
- **Next TBR**: Only shows scheduled review dates within the next 12 months (filtered by `now <= date <= now+12mo`).
- **TBR Status**: Green (recent review + future scheduled), Yellow (missing one or both), Red (never reviewed).

## Export Report Structure ("No Surprises" Framework)
1. **Operational Readiness** - Security incidents, MFA coverage, SAT enrollment, lingering tickets, antivirus status
2. **Capacity Planning** - Device inventory, aging hardware, EOL OS, patch compliance, stale devices
3. **Financial Efficiency** - License utilization, waste calculations, cost trends
4. **Recommended Actions** - Executive summary + AI-generated priority roadmap items (3-7)
5. **Progress Since Last Review** - Trend comparison table (when previous TBR exists)

## API Implementation Notes
- **NinjaOne**: Uses Legacy API Keys with HMAC-SHA1 signatures (instance: us2.ninjarmm.com). Device details fetched per-device in batches of 10. Patch data from `/v2/queries/os-patches?df=org=X` — only patches pending 30+ days are counted as "awaiting installation." Device age uses warranty/purchase date when available, falls back to model-based estimation (comprehensive lookup table for Dell, HP, Lenovo, Microsoft Surface, Apple models), then created date. Model-estimated ages shown with `~` prefix in UI.
- **Huntress**: Paginates through all organizations (91+). Incidents from `/v1/incident_reports?organization_id=X` using `sent_at` field (not `created_at`). Agents from `/v1/agents?organization_id=X` with `defender_status` for managed antivirus. Org detail from `/v1/organizations/{id}` for agents_count, sat_learner_count, microsoft_365_users_count. Basic SAT enrollment data (learner count, coverage %) comes from Huntress org detail API.
- **Curricula (Huntress SAT)**: OAuth2 Client Credentials flow to `https://mycurricula.com/oauth/token`, data from `https://mycurricula.com/api/v1/*`. Uses JSON:API format. HUNTRESS_SAT_API_KEY/SECRET are OAuth2 Client ID/Secret. Token expires after 60 minutes. Fetches `/accounts` to match org name to Curricula account, then per-account endpoints: `/accounts/{id}/learners` (active learner count, total users), `/accounts/{id}/assignments` (completion tracking by status), `/accounts/{id}/phishing-campaigns` (attemptStats with sent, uniqueClicks, compromised, reported). Accounts list cached 10 minutes. SecuritySummary includes: enrollment (learner count, coverage %), training completion (modules completed/assigned, completion %), phishing simulation (click rate, compromise rate, report rate, campaign count, recent campaigns with per-campaign stats).
- **Auth**: Bearer token stored in sessionStorage, sent in Authorization header

## Environment Variables
All API keys stored as Replit Secrets:
- NINJAONE_CLIENT_ID, NINJAONE_CLIENT_SECRET, NINJAONE_INSTANCE
- NINJAONE_LEGACY_KEY_ID, NINJAONE_LEGACY_SECRET
- HUNTRESS_API_KEY, HUNTRESS_API_SECRET
- HUNTRESS_SAT_API_KEY, HUNTRESS_SAT_API_SECRET (optional, dedicated SAT API credentials)
- CW_COMPANY_ID, CW_PUBLIC_KEY, CW_PRIVATE_KEY, CW_CLIENT_ID, CW_SITE_URL
- DASHBOARD_PASSWORD
- SESSION_SECRET
- SMTP2GO_API_KEY, SMTP_FROM (for email reminders via SMTP2GO REST API)
- DATABASE_URL (auto-configured)
- AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL (auto-configured)
