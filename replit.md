# MSP Technology Business Review (TBR) Dashboard

## Overview
A client-facing TBR dashboard for MSP owners to screen-share during 30-minute semi-annual client review meetings. Pulls live data from MSP tools (NinjaOne, Huntress, ConnectWise), accepts manual CSV report uploads, and uses AI to generate a plain-language priority roadmap. Features TBR snapshot history for trend tracking across reviews.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js API routes
- **Database**: PostgreSQL (Neon-backed) for TBR snapshot history
- **Auth**: Simple password-protected login (bearer token, no user accounts)
- **AI**: Anthropic Claude via Replit AI Integrations for roadmap generation
- **Brand**: Pelycon Technologies (Orange #E77125, Storm Gray #394442, Poppins font)

## Key Files
- `shared/schema.ts` - TypeScript interfaces + Drizzle table definitions (tbrSnapshots)
- `server/db.ts` - PostgreSQL database connection (drizzle-orm/node-postgres)
- `server/storage.ts` - Storage interface for TBR snapshot CRUD operations
- `server/routes.ts` - All API routes (auth, proxy to MSP APIs, CSV parsing, AI, export, TBR finalization)
- `server/services/ninjaone.ts` - NinjaOne API integration (Legacy API Keys, HMAC-SHA1)
- `server/services/huntress.ts` - Huntress API integration (Basic auth)
- `server/services/connectwise.ts` - ConnectWise Manage API integration (Basic auth)
- `server/services/roadmap.ts` - Claude AI roadmap generation (executive summary + priority items)
- `server/services/export.ts` - HTML summary export ("No Surprises" framework)
- `client/src/App.tsx` - Main app with auth state management
- `client/src/pages/login.tsx` - Password login page (Pelycon branded)
- `client/src/pages/dashboard.tsx` - Main dashboard with all sections + Finalize TBR
- `client/src/components/` - Dashboard section components
- `client/src/components/meeting-export.tsx` - Export buttons: PDF download (html2pdf.js) and Print (passes previousSnapshot to export)

## API Routes
- `POST /api/auth/login` - Password authentication (bearer token)
- `GET /api/auth/check` - Session check
- `POST /api/auth/logout` - Logout
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
- `POST /api/tbr/finalize` - Finalize TBR snapshot (promotes draft if exists)
- `POST /api/tbr/unfinalize/:id` - Reopen a finalized TBR as a draft (blocked if draft already exists for that client)
- `GET /api/tbr/history/:orgId` - List finalized TBR snapshots for an org
- `GET /api/tbr/snapshot/:id` - Get a single snapshot by ID
- `GET /api/tbr/latest/:orgId` - Get latest + previous finalized snapshot for trend comparison

## Dashboard Architecture (Two-View Workflow)
- **Overview View**: Client selector, draft management banner, inline past review list with expand/collapse, per-snapshot actions (Download PDF, Reopen as Draft), Start New Review button. No live API data loaded.
- **Editor View**: On-demand data loading from NinjaOne/Huntress/ConnectWise. All editing sections (Device Health, Security, Tickets, Projects, CIPP Reports, Internal Notes, Client Feedback, AI Roadmap). Save Draft / Finalize / PDF export. Back button returns to Overview.
- **Draft auto-load**: Editor loads draft fullData (CSV reports, notes, feedback, roadmap) when resuming a draft.
- **Un-finalize**: Reopens a finalized TBR as a draft for editing; blocked if another draft exists for that client.

## TBR Snapshot System
- **Save Draft**: Saves current TBR state including live data (deviceHealth, security, tickets), CSV reports, notes, roadmap, and client feedback as a draft. Only one draft per org at a time.
- **Finalize TBR**: Records key metrics as a finalized snapshot. Promotes existing draft if one exists. Used for trend comparison.
- **Past Reviews**: Inline list in Overview with expandable detail cards showing metrics, trend comparisons, notes, and feedback.
- **Trend Tracking**: Editor shows previous TBR banner; snapshot cards show deltas between consecutive reviews.
- **Export Integration**: HTML export includes "Progress Since Last Review" table when previous snapshot exists. Stored snapshots can generate PDFs from fullData.
- **Schema**: `tbr_snapshots` table with orgId, orgName, createdAt, updatedAt, status (draft/finalized), fullData (jsonb with deviceHealth, security, tickets, mfaReport, licenseReport, roadmap, internalNotes, clientFeedback), and ~20 metric columns

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
- DATABASE_URL (auto-configured)
- AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL (auto-configured)
