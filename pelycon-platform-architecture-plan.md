# Pelycon Executive Management Platform — Architecture Plan

**Version:** 1.0
**Date:** March 26, 2026
**Scope:** Multi-tenant platform rebuild with client portal, PSA abstraction, and future dispatch capability

---

## 1. Current state summary

The existing Replit application is a ~16,500-line TypeScript monolith (React + Express + PostgreSQL via Drizzle ORM) with 7 external integrations (ConnectWise, NinjaOne, Huntress, CIPP, Dropsuite, Quoter, Anthropic). It handles TBR lifecycle management, client account/margin analysis, stack compliance tracking, receivables, and sales pipeline.

Key limitations that block expansion:
- `routes.ts` is a 2,600-line monolith with all business logic inline
- Single-tenant — no concept of MSP tenants or client-scoped access
- In-memory session storage (`Map<string, TokenSession>`) — sessions lost on redeploy
- No PSA abstraction — ConnectWise is hard-wired throughout
- No background job infrastructure beyond `setInterval`
- Auth is internal-only (email/password) — no SSO capability

---

## 2. Target architecture

### 2.1 Multi-tenant model

Every record gets a `tenantId`. Pelycon is tenant 1. Future MSP customers get their own tenant.

**Tenant** = an MSP organization (Pelycon, or a future customer MSP)
**Client** = a company serviced by a tenant (e.g., REB Architects is a client of Pelycon)
**User** = a person who logs in — either MSP staff or client end-user

### 2.2 Role hierarchy

```
platform_admin       → Manages all tenants (Nick/Anthropic — future SaaS admin)
  └─ msp_admin       → Full access within their tenant (Nick, Matt, Rob)
      └─ msp_editor  → Can create/modify data (engineers, account managers)
          └─ msp_viewer → Read-only internal access
      └─ client_admin → Designated client contact — can manage their org's portal users
          └─ client_user → Standard client portal access (view tickets, assets, etc.)
      └─ technician   → Dispatch portal access (Phase 3)
```

### 2.3 Auth flows

**MSP staff:** Email/password login (existing) — optionally add M365 SSO later.

**Client users:** Microsoft Entra ID (M365) SSO via OAuth2 Authorization Code flow.
- User clicks "Sign in with Microsoft" → redirected to their M365 tenant
- On callback, extract the user's tenant domain from the ID token
- Match domain to a `clientMapping.cippTenantId` → resolve to `tenantId` + `clientId`
- Create or update the user record with `role: "client_user"`
- Client admins are pre-designated by MSP admin in the internal portal

**Session management:** Redis-backed sessions (replace in-memory Map). JWT access tokens with Redis-stored refresh tokens. Token rotation on each refresh.

---

## 3. Database schema changes

### 3.1 New tables

```sql
-- MSP tenants (Pelycon = tenant 1)
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,           -- URL-safe identifier
  psa_type TEXT NOT NULL DEFAULT 'connectwise',  -- 'connectwise' | 'halopsa'
  psa_config JSONB,                    -- encrypted PSA credentials
  rmm_type TEXT DEFAULT 'ninjaone',
  rmm_config JSONB,
  security_type TEXT DEFAULT 'huntress',
  security_config JSONB,
  m365_type TEXT DEFAULT 'cipp',
  m365_config JSONB,
  branding JSONB,                      -- logo URL, colors, portal name
  features JSONB,                      -- feature flags per tenant
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Client organizations within a tenant
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  psa_company_id INTEGER,              -- CW company ID or Halo client ID
  rmm_org_id INTEGER,                  -- NinjaOne org ID
  security_org_id INTEGER,             -- Huntress org ID
  m365_tenant_domain TEXT,             -- CIPP tenant ID / domain
  company_name TEXT NOT NULL,
  portal_enabled BOOLEAN DEFAULT FALSE,
  portal_settings JSONB,               -- per-client portal config
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, psa_company_id)
);

-- Announcements / KB articles pushed to client portals
CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  client_id INTEGER REFERENCES clients(id),  -- NULL = all clients
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'announcement',  -- 'announcement' | 'kb' | 'service_guide'
  published_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook event log (for pizza tracker real-time updates)
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  source TEXT NOT NULL,                 -- 'connectwise' | 'halopsa'
  event_type TEXT NOT NULL,             -- 'ticket.updated' | 'ticket.created' etc.
  payload JSONB NOT NULL,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Modified tables — add tenant_id

Every existing table gets a `tenant_id INTEGER NOT NULL REFERENCES tenants(id)` column. During migration, all existing rows get `tenant_id = 1` (Pelycon).

Tables to modify:
- `users` — add `tenant_id`, `client_id` (nullable — NULL for MSP staff), `auth_provider` ('local' | 'microsoft'), `external_id` (M365 object ID)
- `client_accounts` — add `tenant_id`, add `client_id REFERENCES clients(id)`
- `client_mapping` — **replace with `clients` table** (mappings become columns on `clients`)
- `tbr_snapshots` — add `tenant_id`
- `tbr_schedules` — add `tenant_id`
- `tbr_staging` — add `tenant_id`
- `ar_only_clients` — add `tenant_id`
- `dropsuite_accounts` — add `tenant_id`
- `app_settings` — add `tenant_id` (settings become per-tenant)

### 3.3 Updated users table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  client_id INTEGER REFERENCES clients(id),  -- NULL = MSP staff
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT,                   -- NULL for SSO-only users
  auth_provider TEXT NOT NULL DEFAULT 'local',  -- 'local' | 'microsoft'
  external_id TEXT,                     -- M365 object ID for SSO users
  role TEXT NOT NULL DEFAULT 'client_user',
  page_access JSONB,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);
```

---

## 4. PSA adapter interface

The critical abstraction layer. All ticket, invoice, agreement, project, and financial operations go through this interface. The app never calls ConnectWise or Halo directly.

```typescript
// server/adapters/psa/types.ts

export interface PSATicket {
  id: string;                    // PSA-native ticket ID
  summary: string;
  description: string;
  status: string;                // Normalized: 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  statusRaw: string;             // PSA-native status string
  priority: string;              // Normalized: 'critical' | 'high' | 'medium' | 'low'
  clientId: string;              // PSA-native company/client ID
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  assignedTo: string | null;
  boardName: string | null;
  dateCreated: string;           // ISO 8601
  dateUpdated: string;
  dateClosed: string | null;
  lastActionDate: string | null; // For pizza tracker — when was it last touched
  slaInfo: {
    responseTarget: string | null;
    resolutionTarget: string | null;
    responseMetAt: string | null;
    isBreached: boolean;
  } | null;
}

export interface PSATicketCreate {
  summary: string;
  description: string;
  clientId: string;
  contactEmail?: string;
  priority?: string;
  boardId?: string;
  ticketType?: string;
}

export interface PSATicketNote {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
  isInternal: boolean;
}

export interface PSAInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  type: string;                  // 'agreement' | 'standard' | 'project' | 'misc'
  date: string;
  dueDate: string;
  total: number;
  balance: number;
  status: string;                // 'open' | 'paid' | 'partial' | 'void'
  paymentLink: string | null;    // Alternative payments URL
}

export interface PSAAgreement {
  id: string;
  name: string;
  type: string;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  monthlyRevenue: number;
  status: string;                // 'active' | 'cancelled' | 'expired'
  additions: PSAAgreementAddition[];
}

export interface PSAAgreementAddition {
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  billingCycle: string;
}

export interface PSAProject {
  id: string;
  name: string;
  clientId: string;
  status: string;
  dateCreated: string;
  dateClosed: string | null;
  boardName: string | null;
}

export interface PSACompanyFinancials {
  agreementRevenue: number;
  projectRevenue: number;
  totalRevenue: number;
  laborCost: number;
  serviceLaborCost: number;
  projectLaborCost: number;
  additionCost: number;
  projectProductCost: number;
  expenseCost: number;
  msLicensingRevenue: number;
  msLicensingCost: number;
  totalCost: number;
  serviceMarginPercent: number | null;
  projectMarginPercent: number | null;
  grossMarginPercent: number | null;
  serviceHours: number;
  projectHours: number;
  totalHours: number;
  engineers: EngineerCostEntry[];
  agreementAdditions: AgreementAdditionEntry[];
}

export interface PSAARSummary {
  outstandingBalance: number;
  overdueBalance: number;
  aging: { current: number; days30: number; days60: number; days90: number; days90Plus: number };
  avgDaysToPay: number | null;
  paymentScore: 'A' | 'B' | 'C' | 'D';
  recentInvoices: PSAInvoice[];
  lastPaymentDate: string | null;
}

// The adapter interface — implemented by ConnectWiseAdapter and HaloPSAAdapter
export interface PSAAdapter {
  // Connection
  isConfigured(): boolean;
  testConnection(): Promise<boolean>;

  // Tickets (client portal + internal)
  getTicketsForClient(clientId: string, options?: { status?: string; limit?: number }): Promise<PSATicket[]>;
  getTicketById(ticketId: string): Promise<PSATicket | null>;
  getTicketNotes(ticketId: string): Promise<PSATicketNote[]>;
  createTicket(ticket: PSATicketCreate): Promise<PSATicket>;
  addTicketNote(ticketId: string, note: { text: string; isInternal: boolean }): Promise<PSATicketNote>;
  getTicketSummary(clientName: string): Promise<TicketSummary>;  // Reuse existing type

  // Invoices & AR (client portal)
  getInvoicesForClient(clientId: string, options?: { status?: string; limit?: number }): Promise<PSAInvoice[]>;
  getARSummary(clientId: string): Promise<PSAARSummary | null>;
  getPaymentLink(invoiceId: string): string | null;

  // Agreements (client portal)
  getAgreementsForClient(clientId: string): Promise<PSAAgreement[]>;
  getManagedServicesClients(): Promise<{ psaCompanyId: number; companyName: string; agreementTypes: string[]; monthlyRevenue: number }[]>;
  getAllAgreementClients(): Promise<{ psaCompanyId: number; companyName: string; agreementTypes: string[]; monthlyRevenue: number }[]>;

  // Projects
  getProjectsForClient(clientName: string): Promise<PSAProject[]>;

  // Financials (internal)
  getCompanyFinancials(clientId: string): Promise<PSACompanyFinancials>;
  getCompanyARSummary(clientId: number): Promise<PSAARSummary | null>;

  // Follow-up tickets (TBR workflow)
  createFollowUpTicket(companyName: string, tasks: string[], tbrDate: string): Promise<{ ticketId: number; ticketUrl: string }>;

  // Webhooks (pizza tracker)
  registerWebhook?(callbackUrl: string, events: string[]): Promise<void>;
  parseWebhookPayload?(payload: any): { eventType: string; ticketId: string; data: any };
}
```

### 4.1 ConnectWise adapter

Wraps your existing `server/services/connectwise.ts` functions. The refactor is mostly renaming and normalizing return types. Your existing CW code is solid — this is a thin wrapper, not a rewrite.

### 4.2 HaloPSA adapter

HaloPSA's REST API maps cleanly to this interface:
- `GET /api/tickets?client_id=X` → `getTicketsForClient()`
- `POST /api/tickets` → `createTicket()`
- `GET /api/tickets/{id}/actions` → `getTicketNotes()`
- `GET /api/invoices?client_id=X` → `getInvoicesForClient()`
- `GET /api/clientcontract?client_id=X` → `getAgreementsForClient()`
- Webhook events: `New Ticket Logged`, `Ticket Updated` → pizza tracker

HaloPSA uses OAuth2 Client Credentials (same pattern as your existing CIPP integration).

### 4.3 Adapter factory

```typescript
// server/adapters/psa/factory.ts
export function createPSAAdapter(tenant: Tenant): PSAAdapter {
  switch (tenant.psaType) {
    case 'connectwise':
      return new ConnectWiseAdapter(tenant.psaConfig);
    case 'halopsa':
      return new HaloPSAAdapter(tenant.psaConfig);
    default:
      throw new Error(`Unknown PSA type: ${tenant.psaType}`);
  }
}
```

Same pattern for RMM (NinjaOne today, Datto/Syncro later), Security (Huntress), and M365 (CIPP).

---

## 5. Client portal feature map

### 5.1 Ticket center
- **Open tickets list** — pulls from PSA via `getTicketsForClient()`
- **Create ticket** — form → `createTicket()` — respects permission (client_admin vs client_user)
- **Pizza tracker** — per-ticket status view showing:
  - Current status (with human-friendly labels, not PSA-native codes)
  - Timeline of status changes (from ticket notes/actions)
  - Assigned technician name
  - SLA status (on track / at risk / breached)
  - Real-time updates via webhook → WebSocket push to connected clients

### 5.2 Agreements & invoices
- **Active agreements** with line items and renewal dates
- **Invoice list** with status badges (paid / open / overdue)
- **Pay now** link — routes to PSA's alternative payment URL per invoice
- **Payment history** with trend chart

### 5.3 Tenant security
- **Microsoft Secure Score** (from CIPP)
- **MFA coverage** percentage and uncovered users
- **Email posture** — DKIM, DMARC, SPF, DNSSEC status (from DNS lookups + CIPP)
- **Security incidents** summary (from Huntress, without exposing sensitive details)

### 5.4 Assets & licensing
- **Device inventory** — from NinjaOne with age, OS, patch status
- **License utilization** — wasted licenses highlighted
- **Device-user mapping** — who uses what

### 5.5 Trends & analysis
- **Repeat ticket patterns** — recurring issues flagged with recommendation
- **Problem assets** — devices generating the most tickets
- **Ticket volume trends** — monthly chart with YoY comparison
- **Suggested upgrades/enhancements** — AI-generated from TBR data

### 5.6 Announcements & KB
- **Announcements** — MSP-published updates (maintenance windows, new services, policy changes)
- **Knowledge base** — "What to expect" guide, service level descriptions, onboarding docs
- **Service guide** — how to submit tickets, escalation paths, hours of operation

---

## 6. File structure (post-restructure)

```
server/
├── adapters/
│   ├── psa/
│   │   ├── types.ts              # PSAAdapter interface + shared types
│   │   ├── factory.ts            # createPSAAdapter()
│   │   ├── connectwise.ts        # ConnectWiseAdapter (wraps existing CW code)
│   │   └── halopsa.ts            # HaloPSAAdapter (new)
│   ├── rmm/
│   │   ├── types.ts              # RMMAdapter interface
│   │   ├── factory.ts
│   │   └── ninjaone.ts           # NinjaOneAdapter (wraps existing)
│   ├── security/
│   │   ├── types.ts              # SecurityAdapter interface
│   │   ├── factory.ts
│   │   └── huntress.ts           # HuntressAdapter (wraps existing)
│   └── m365/
│       ├── types.ts              # M365Adapter interface
│       ├── factory.ts
│       └── cipp.ts               # CIPPAdapter (wraps existing)
├── routes/
│   ├── auth.ts                   # Login, SSO, session management
│   ├── users.ts                  # User CRUD, role management
│   ├── tbr.ts                    # TBR snapshots, drafts, finalization
│   ├── accounts.ts               # Client accounts, sync, financials
│   ├── receivables.ts            # AR, invoices
│   ├── sales.ts                  # Quoter integration
│   ├── clients.ts                # Stack compliance, mappings
│   ├── staging.ts                # TBR staging
│   ├── portal/                   # Client-facing routes (scoped by client_id)
│   │   ├── tickets.ts
│   │   ├── invoices.ts
│   │   ├── security.ts
│   │   ├── assets.ts
│   │   ├── announcements.ts
│   │   └── trends.ts
│   └── webhooks.ts               # Incoming PSA webhook handler
├── middleware/
│   ├── auth.ts                   # requireAuth, requireRole, requireTenant
│   ├── tenant.ts                 # Tenant resolution middleware
│   └── rateLimit.ts              # Rate limiting for portal routes
├── services/
│   ├── email.ts                  # SMTP (existing)
│   ├── export.ts                 # TBR HTML export (existing)
│   ├── roadmap.ts                # AI roadmap generation (existing)
│   ├── reminderJob.ts            # TBR reminders (existing)
│   ├── marginAnalysis.ts         # Margin calculation (extracted from routes.ts)
│   ├── syncEngine.ts             # Account sync orchestrator
│   └── webhookProcessor.ts       # Process incoming webhooks → WebSocket push
├── db.ts
├── storage.ts                    # Add tenant-scoped queries
├── index.ts
├── static.ts
└── vite.ts

client/src/
├── portals/
│   ├── internal/                 # Existing MSP-facing pages
│   │   ├── dashboard.tsx
│   │   ├── tracker.tsx
│   │   ├── staging.tsx
│   │   ├── clients.tsx
│   │   ├── accounts.tsx
│   │   ├── receivables.tsx
│   │   ├── sales.tsx
│   │   └── user-management.tsx
│   └── client/                   # New client-facing pages
│       ├── ClientDashboard.tsx    # Overview / home
│       ├── Tickets.tsx            # Open tickets + create
│       ├── TicketDetail.tsx       # Pizza tracker per-ticket
│       ├── Invoices.tsx           # Invoices + pay links
│       ├── Agreements.tsx         # Active agreements
│       ├── Security.tsx           # Secure Score, MFA, email posture
│       ├── Assets.tsx             # Device inventory + licensing
│       ├── Trends.tsx             # Analysis + recommendations
│       └── KnowledgeBase.tsx      # Announcements + service guide
├── components/                   # Shared UI components
├── hooks/
├── lib/
│   ├── queryClient.ts
│   └── auth.ts                   # Token management, SSO helpers
└── App.tsx                       # Route split: internal vs client portal
```

---

## 7. Migration plan

### Phase 1 — Restructure (weeks 1-2)

1. Push Replit project to GitHub
2. Set up Railway/Render with PostgreSQL + Redis
3. Break `routes.ts` into domain modules (mechanical — no logic changes)
4. Extract `marginAnalysis` and `syncEngine` from routes into services
5. Add `tenantId` column to all existing tables (default = 1)
6. Create `tenants` and `clients` tables
7. Migrate `client_mapping` data into `clients` table
8. Replace in-memory `tokenSessions` Map with Redis
9. Add tenant-resolution middleware
10. Verify all existing functionality works identically

### Phase 2 — PSA adapter + client portal MVP (weeks 3-6)

1. Build PSAAdapter interface and ConnectWiseAdapter wrapper
2. Refactor all CW calls in routes to go through the adapter
3. Implement M365 SSO auth flow (Azure AD OAuth2)
4. Build client role scoping middleware
5. Build client portal pages: tickets, ticket detail (pizza tracker v1), invoices, agreements, announcements/KB
6. Add webhook endpoint for PSA ticket status changes
7. WebSocket infrastructure for real-time pizza tracker updates

### Phase 3 — Security & intelligence (weeks 7-9)

1. Client portal security dashboard (Secure Score, MFA, email posture)
2. Asset inventory + licensing views
3. Trends engine (repeat tickets, problem assets, AI recommendations)
4. DKIM/DMARC/SPF/DNSSEC checking (DNS queries + CIPP data)

### Phase 4 — HaloPSA + polish (weeks 10-12)

1. Build HaloPSAAdapter
2. Test with a staging Halo instance
3. CSAT/NPS survey integration
4. SLA dashboard
5. Document sharing
6. QBR scheduling through portal

### Phase 5 — Multi-MSP productization (future)

1. Tenant onboarding flow
2. Per-tenant branding and custom domains
3. Billing/subscription management
4. Tenant admin self-service for PSA/RMM/security configuration
5. Marketplace for additional integration connectors

---

## 8. Infrastructure

**Hosting:** Railway or Render (PaaS — simple deploys, auto-scaling)
**Database:** PostgreSQL (Neon or Railway-managed)
**Cache/Sessions:** Redis (Upstash or Railway-managed)
**Real-time:** WebSocket server (ws library — already a dependency)
**Background jobs:** BullMQ on Redis (replaces setInterval for sync, reminders)
**File storage:** S3-compatible bucket for exports, uploaded CSVs (Cloudflare R2 is cheapest)
**DNS/SSL:** Cloudflare (portal.pelycon.com + future custom domains for multi-MSP)
**CI/CD:** GitHub Actions → Railway auto-deploy on main branch

---

## 9. Security considerations

- All PSA/RMM/security credentials encrypted at rest in tenant config (AES-256-GCM)
- Client portal routes scoped by tenant + client — no cross-tenant data leakage
- Rate limiting on all portal API endpoints (express-rate-limit + Redis store)
- Webhook signature verification (both CW callbacks and Halo webhooks sign payloads)
- CORS locked to portal domain only
- Audit log for all write operations (who changed what, when)
- Client users cannot see internal notes, margin data, or other clients' data
- CSP headers on client portal preventing XSS

---

## 10. Key decisions summary

| Decision | Choice | Rationale |
|---|---|---|
| Multi-tenant from day 1 | Yes | Product ambition requires it — retrofitting is 3x harder |
| PSA adapter pattern | Interface + factory | CW→Halo migration in 12 months; future MSP tenants pick their PSA |
| Same pattern for RMM/security/M365 | Yes | Future tenants may use Datto, SentinelOne, etc. |
| One URL, role-based views | portal.pelycon.com | Simpler infrastructure, shared auth layer |
| M365 SSO for clients | Azure AD OAuth2 | Every managed client is on Business Premium — zero friction |
| Redis for sessions | Yes | Survives redeploys, supports WebSocket scaling |
| BullMQ for background jobs | Yes | Reliable job queue, retry logic, cron scheduling |
| Client portal first, dispatch later | Phase 2 vs Phase 5 | Client portal is the differentiator; dispatch can wait |
