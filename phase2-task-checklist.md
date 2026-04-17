# Phase 2 — PSA Adapter + Client Portal MVP

**Goal:** Build the ConnectWise adapter, M365 SSO for clients, and the client-facing portal with tickets (pizza tracker), invoices, agreements, announcements, and KB.

**Prerequisites:**
- Phase 1 complete (modular routes, tenant schema, adapter stubs)
- `npx drizzle-kit push` run against live DB
- `npx tsx server/scripts/seed-tenant.ts` run to populate tenants/clients

---

## Task 1: Build the ConnectWise PSA adapter

Wrap the existing `server/services/connectwise.ts` functions behind the PSAAdapter interface. This is NOT a rewrite — it's a thin translation layer.

### 1a: Define the full PSAAdapter interface

Update `server/adapters/psa/types.ts` with the complete interface (from the architecture plan Section 4). Key types:

```typescript
export interface PSATicket {
  id: string;
  summary: string;
  description: string;
  status: PSATicketStatus;        // Normalized stage
  statusRaw: string;              // CW-native status string
  priority: string;
  clientId: string;
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  assignedTo: string | null;
  boardName: string | null;
  dateCreated: string;
  dateUpdated: string;
  dateClosed: string | null;
  lastActionDate: string | null;
  scheduledDate: string | null;
  requiresOnsite: boolean;
  slaInfo: {
    responseTarget: string | null;
    resolutionTarget: string | null;
    isBreached: boolean;
  } | null;
}

export type PSATicketStatus = 'received' | 'working' | 'waiting' | 'waiting_client' | 'resolved';

export interface PSATicketCreate {
  summary: string;
  description: string;
  clientId: string;
  contactEmail?: string;
  priority?: string;
  boardId?: string;
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
  type: string;
  date: string;
  dueDate: string;
  total: number;
  balance: number;
  status: 'open' | 'paid' | 'partial' | 'void';
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
  status: 'active' | 'cancelled' | 'expired';
  additions: { name: string; quantity: number; unitPrice: number }[];
}
```

### 1b: Build the CW status normalizer

Create `server/adapters/psa/statusMap.ts`:

```typescript
// ConnectWise status → client-facing pizza tracker stage
const CW_STATUS_MAP: Record<string, PSATicketStatus> = {
  // Received
  'New': 'received',
  'New (email)*': 'received',
  'New (Portal)*': 'received',
  'New (N-Able)': 'received',
  'New (CW Chat)': 'received',
  'Customer Updated': 'received',
  'Re-Opened': 'received',

  // Working on it
  'Assigned': 'working',
  'In Progress': 'working',
  'Need to Escalate': 'working',
  'Needs Follow Up': 'working',
  'Requires Onsite': 'working',
  'Need Sales': 'working',
  'Update Needed': 'working',
  'Recurring': 'working',

  // Waiting (general)
  'On Hold': 'waiting',
  'Waiting on Parts': 'waiting',
  'Waiting on Vendor': 'waiting',
  'Scheduled': 'waiting',

  // Waiting on client (special — triggers "we need you" callout)
  'Waiting Client Response*': 'waiting_client',

  // Resolved
  'Completed': 'resolved',
  'Completed*': 'resolved',
  'Enter Time': 'resolved',
  'Closed-(Auto)': 'resolved',
  '>Closed by Nable': 'resolved',
};

export function normalizeCWStatus(cwStatus: string): PSATicketStatus {
  return CW_STATUS_MAP[cwStatus] || 'working'; // default to working if unknown
}

// Client-facing labels for each stage
export const STAGE_LABELS: Record<PSATicketStatus, string> = {
  received: 'We received your request',
  working: 'A technician is working on this',
  waiting: "We're waiting on something",
  waiting_client: 'We need something from you',
  resolved: 'This has been resolved',
};

// Sub-labels for specific CW statuses that add context
export function getStatusDetail(cwStatus: string): string | null {
  switch (cwStatus) {
    case 'Requires Onsite': return 'Onsite visit planned';
    case 'Waiting on Parts': return 'Waiting on parts to arrive';
    case 'Waiting on Vendor': return 'Waiting on a vendor response';
    case 'Scheduled': return null; // Will show scheduled date instead
    case 'On Hold': return 'Temporarily on hold';
    case 'Need to Escalate': return 'Being escalated to a senior engineer';
    default: return null;
  }
}
```

### 1c: Implement ConnectWiseAdapter class

Create `server/adapters/psa/connectwise.ts`:

This wraps the existing service functions. For each method:
- Import the existing function from `server/services/connectwise.ts`
- Call it
- Normalize the return type to match the PSAAdapter interface

**Ticket methods to implement:**

```typescript
class ConnectWiseAdapter implements PSAAdapter {
  // getTicketsForClient — new CW API call:
  //   GET /service/tickets?conditions=company/id={clientId} AND closedFlag=false
  //   Map each ticket through normalizeCWStatus()
  //   Pull assignedTo from resources, contactName/Email from contact

  // getTicketById — GET /service/tickets/{id}

  // getTicketNotes — GET /service/tickets/{id}/notes
  //   Filter: only return notes where internalFlag !== true for client portal

  // createTicket — POST /service/tickets
  //   Map PSATicketCreate fields to CW ticket format

  // addTicketNote — POST /service/tickets/{id}/notes

  // getTicketSummary — delegates to existing connectwise.getTicketSummary()

  // getInvoicesForClient — GET /finance/invoices?conditions=company/id={clientId}
  //   Normalize to PSAInvoice type

  // getAgreementsForClient — GET /finance/agreements?conditions=company/id={clientId} AND cancelledFlag=false
  //   Include additions via GET /finance/agreements/{id}/additions

  // Existing methods just delegate:
  // getManagedServicesClients → connectwise.getManagedServicesClients()
  // getAllAgreementClients → connectwise.getAllAgreementClients()
  // getCompanyFinancials → connectwise.getCompanyFinancials()
  // getCompanyARSummary → connectwise.getCompanyARSummary()
  // createFollowUpTicket → connectwise.createFollowUpTicket()
  // getProjectsForClient → connectwise.getProjectItems()
}
```

**Important:** Don't break existing routes. Existing internal routes continue calling `connectwise.*` directly for now. The adapter is used by the NEW portal routes. Migrate internal routes to the adapter in a later pass.

### 1d: Create adapter factory

Update `server/adapters/psa/factory.ts`:

```typescript
import { ConnectWiseAdapter } from './connectwise';

export function createPSAAdapter(psaType: string, config: any): PSAAdapter {
  switch (psaType) {
    case 'connectwise':
      return new ConnectWiseAdapter(config);
    case 'halopsa':
      throw new Error('HaloPSA adapter not yet implemented');
    default:
      throw new Error(`Unknown PSA type: ${psaType}`);
  }
}
```

### 1e: Add tenant PSA resolver middleware

Update `server/middleware/tenant.ts` to also resolve the PSA adapter for the current tenant:

```typescript
export async function resolveTenant(req, res, next) {
  const tenantId = 1; // Hardcoded for now
  const tenant = await storage.getTenantById(tenantId);
  (req as any).tenantId = tenantId;
  (req as any).tenant = tenant;
  (req as any).psaAdapter = createPSAAdapter(tenant.psaType, tenant.psaConfig);
  next();
}
```

**Verification:** Adapter compiles. Factory returns a ConnectWiseAdapter. Existing app still works — nothing calls the adapter yet.

---

## Task 2: M365 SSO authentication

### 2a: Install dependencies

```bash
npm install @azure/msal-node jsonwebtoken
npm install -D @types/jsonwebtoken
```

### 2b: Add Azure AD app registration config to tenant

The tenant's `m365Config` JSONB should store:
```json
{
  "clientId": "YOUR_AZURE_APP_CLIENT_ID",
  "clientSecret": "YOUR_AZURE_APP_CLIENT_SECRET",
  "tenantId": "common",
  "redirectUri": "https://your-domain.com/api/auth/microsoft/callback"
}
```

You'll need to register an app in Azure AD (Entra ID):
1. Go to portal.azure.com → App registrations → New registration
2. Name: "Pelycon Client Portal"
3. Redirect URI: https://your-replit-url/api/auth/microsoft/callback
4. Under API permissions: Microsoft Graph → User.Read
5. Under Certificates & secrets: create a client secret
6. Under Authentication: enable ID tokens

### 2c: Build M365 auth routes

Create `server/routes/portalAuth.ts`:

```typescript
// GET /api/auth/microsoft
//   Generate MSAL authorization URL
//   State param includes returnUrl
//   Redirect user to Microsoft login

// GET /api/auth/microsoft/callback
//   Exchange code for tokens via MSAL
//   Extract user info from ID token: email, name, tenant domain
//   Look up client by matching tenant domain to clients.m365_tenant_domain
//   If no match → show "Your organization is not registered" error
//   If match → find or create user record (auth_provider='microsoft', role='client_user')
//   Create session token → redirect to portal with token

// GET /api/auth/microsoft/userinfo
//   Return current SSO user info for the portal UI
```

### 2d: Update auth middleware for dual auth

Update `server/middleware/auth.ts` to handle both local (Bearer token) and SSO sessions:

```typescript
export function requireAuth(req, res, next) {
  // Check Bearer token first (existing flow — MSP staff)
  // Then check session/cookie (SSO flow — client users)
  // Attach user to req either way
}

// New middleware: restrict to client portal users only
export function requireClientAuth(req, res, next) {
  // Must be authenticated
  // Must have role 'client_user' or 'client_admin'
  // Must have a clientId
  // Attach clientId to request for scoping
}

// New middleware: restrict to MSP staff only
export function requireStaffAuth(req, res, next) {
  // Must be authenticated
  // Must have role 'msp_admin', 'msp_editor', or 'msp_viewer'
  // clientId must be null
}
```

### 2e: Client user management (internal side)

Add to internal routes — MSP admins can:
- View portal users per client
- Enable/disable portal access per client (set `clients.portal_enabled = true`)
- Designate client admins (set user role to `client_admin`)
- Pre-register client contacts (so SSO auto-matches on first login)

**Verification:** SSO login flow works end-to-end. A test user from a client M365 tenant can authenticate and get redirected to the portal. User record is created with correct tenant/client scoping.

---

## Task 3: Client portal routes (API layer)

All portal routes live under `/api/portal/` and require `requireClientAuth` middleware. Every query is scoped by the authenticated user's `clientId`.

### 3a: `server/routes/portal/tickets.ts`

```typescript
// GET /api/portal/tickets
//   Returns open tickets for this client via psaAdapter.getTicketsForClient()
//   Each ticket includes normalized status, stage label, status detail, assigned tech
//   Query params: ?status=open|resolved&limit=50

// GET /api/portal/tickets/:ticketId
//   Returns single ticket with full detail + notes (non-internal only)
//   Includes pizza tracker data: status timeline, SLA info, scheduled date
//   Verify ticket belongs to this client before returning

// POST /api/portal/tickets
//   Create a new ticket via psaAdapter.createTicket()
//   Check permissions: client_admin can always create, client_user only if enabled
//   Auto-populate clientId and contact info from authenticated user

// POST /api/portal/tickets/:ticketId/notes
//   Add a note to a ticket (client reply / additional info)
//   Mark as external note (not internal)
//   Verify ticket belongs to this client
```

### 3b: `server/routes/portal/invoices.ts`

```typescript
// GET /api/portal/invoices
//   Returns invoices for this client via psaAdapter.getInvoicesForClient()
//   Query params: ?status=open|paid|all&limit=50
//   Each invoice includes paymentLink → pay.pelycon.com

// GET /api/portal/invoices/summary
//   Returns AR summary: outstanding balance, overdue amount, payment history chart data
```

Payment link logic:
```typescript
function getPaymentLink(invoice: PSAInvoice): string {
  // All invoices link to pay.pelycon.com
  // If you want per-invoice deep links later, the adapter can provide them
  return 'https://pay.pelycon.com';
}
```

### 3c: `server/routes/portal/agreements.ts`

```typescript
// GET /api/portal/agreements
//   Returns active agreements for this client
//   Includes agreement additions (line items)
//   Shows renewal dates, monthly cost breakdown
```

### 3d: `server/routes/portal/security.ts`

```typescript
// GET /api/portal/security
//   Returns tenant security overview:
//   - Microsoft Secure Score (from CIPP via existing cipp service)
//   - MFA coverage percentage (from stored TBR data or live CIPP call)
//   - Email posture: DKIM, DMARC, SPF, DNSSEC status
//   Scoped by client's m365_tenant_domain

// For email posture, do DNS lookups:
//   DMARC: TXT record at _dmarc.{domain}
//   DKIM: TXT record at selector1._domainkey.{domain} and selector2._domainkey.{domain}
//   SPF: TXT record at {domain} containing v=spf1
//   DNSSEC: Check DS record presence
```

Note: DNS lookups need the `dns` Node.js module (built-in, no install needed). Since Replit has network access, these will work.

### 3e: `server/routes/portal/assets.ts`

```typescript
// GET /api/portal/assets
//   Returns device inventory for this client via NinjaOne
//   Uses existing ninjaone.getDeviceHealth() scoped to client's rmm_org_id
//   Returns: device list, OS breakdown, age analysis, patch status

// GET /api/portal/assets/licensing
//   Returns license utilization from stored TBR data
//   If no recent TBR data, returns null with message "Data available after next review"
```

### 3f: `server/routes/portal/announcements.ts`

```typescript
// GET /api/portal/announcements
//   Returns announcements for this client's tenant
//   Includes tenant-wide announcements (client_id IS NULL) and client-specific ones
//   Filter: published_at <= now AND (expires_at IS NULL OR expires_at > now)
//   Order by published_at DESC

// GET /api/portal/kb
//   Returns KB articles (type = 'kb' or 'service_guide')
//   Same scoping as announcements
```

### 3g: `server/routes/portal/trends.ts`

```typescript
// GET /api/portal/trends
//   Returns analysis data:
//   - Ticket volume by month (last 12 months)
//   - Top ticket categories (repeat issues)
//   - Problem assets (devices with most tickets — cross-ref NinjaOne + CW)
//   - AI-generated recommendations (from stored TBR roadmap data)
//   
//   This mostly pulls from existing TBR snapshot data + live ticket queries
```

### 3h: `server/routes/portal/index.ts`

Register all portal routes:

```typescript
export function registerPortalRoutes(app: Express) {
  // Apply client auth middleware to all /api/portal routes
  app.use('/api/portal', requireAuth, requireClientAuth);

  registerPortalTicketRoutes(app);
  registerPortalInvoiceRoutes(app);
  registerPortalAgreementRoutes(app);
  registerPortalSecurityRoutes(app);
  registerPortalAssetRoutes(app);
  registerPortalAnnouncementRoutes(app);
  registerPortalTrendRoutes(app);
}
```

**Verification:** All portal API endpoints return properly scoped data. A client user can only see their own company's tickets, invoices, etc. Test with curl or Postman using a client auth token.

---

## Task 4: Client portal frontend

### 4a: Update App.tsx routing

Add portal route detection. Same app, role-based routing:

```typescript
// In App.tsx:
// If user.role === 'client_user' || user.role === 'client_admin'
//   → render ClientPortalLayout with client portal routes
// Else
//   → render existing AuthenticatedApp (internal portal)

// Client portal routes:
// /portal              → ClientDashboard (overview)
// /portal/tickets      → TicketList
// /portal/tickets/:id  → TicketDetail (pizza tracker)
// /portal/invoices     → Invoices
// /portal/agreements   → Agreements
// /portal/security     → SecurityDashboard
// /portal/assets       → AssetInventory
// /portal/trends       → TrendsAnalysis
// /portal/kb           → KnowledgeBase
```

### 4b: Client portal layout

Create `client/src/portals/client/ClientLayout.tsx`:

- Sidebar with Pelycon branding (or tenant branding from tenant.branding config)
- Navigation: Dashboard, Tickets, Invoices, Agreements, Security, Assets, Trends, Knowledge Base
- User menu showing client user name + company name
- "Sign out" button (clears SSO session)
- Use Pelycon brand colors: Orange `#E77125`, Storm Gray `#394442`

### 4c: Client dashboard (overview page)

Create `client/src/portals/client/ClientDashboard.tsx`:

Summary cards at the top:
- Open tickets count (with badge if any are "waiting on you")
- Outstanding balance (with "Pay now" link to pay.pelycon.com)
- Secure Score gauge (from CIPP)
- Total devices count

Below the cards:
- Recent tickets (last 5, with pizza tracker status pills)
- Recent announcements (last 3)
- Quick action: "Submit a new ticket" button

### 4d: Ticket list page

Create `client/src/portals/client/Tickets.tsx`:

- Table/list of tickets with columns: Ticket #, Summary, Status (pizza tracker pill), Assigned To, Last Updated
- Status filter tabs: All | Open | Waiting on You | Resolved
- "New Ticket" button (if user has permission)
- Each row clickable → goes to ticket detail

### 4e: Ticket detail page (pizza tracker)

Create `client/src/portals/client/TicketDetail.tsx`:

This is the signature feature. Show:

**Pizza tracker progress bar:**
```
[Received] ——→ [Working on it] ——→ [Waiting] ——→ [Resolved]
   ●              ●                  ○               ○
```
- Filled circles for completed/current stages
- Current stage highlighted (Pelycon orange)
- If status is `waiting_client`, show a prominent callout: "We need something from you"

**Ticket details:**
- Summary and description
- Assigned technician name
- Created date, last updated date
- If scheduled: "Scheduled for [date]"
- If requires onsite: "Onsite visit planned"
- Status detail text from getStatusDetail()

**Activity timeline:**
- List of non-internal notes in chronological order
- Each note shows: who posted, when, and the content
- Client can add a reply (textarea + submit button)

**SLA indicator (if available):**
- Response time: met / at risk / breached
- Resolution target: on track / at risk / breached

### 4f: Invoices page

Create `client/src/portals/client/Invoices.tsx`:

- Table: Invoice #, Date, Amount, Status (paid/open/overdue badge), Actions
- "Pay now" button on each open invoice → links to pay.pelycon.com
- Summary card at top: total outstanding, overdue amount
- Filter: All | Open | Paid

### 4g: Agreements page

Create `client/src/portals/client/Agreements.tsx`:

- List of active agreements with: name, type, monthly cost, start date, renewal date
- Expandable to show line items (additions) per agreement
- No edit capability — view only

### 4h: Security dashboard

Create `client/src/portals/client/SecurityDashboard.tsx`:

- Microsoft Secure Score gauge (circular progress)
- MFA coverage bar (X of Y users covered)
- Email posture cards: DKIM (pass/fail), DMARC (pass/fail), SPF (pass/fail), DNSSEC (pass/fail)
  - Each card shows green check or red X
  - Tooltip or expandable detail explaining what each one means
- Recent security incidents count (without sensitive details)

### 4i: Assets page

Create `client/src/portals/client/AssetInventory.tsx`:

- Device list table: Name, Type, OS, Age, Patch Status, Last Seen
- Summary cards: Total devices, Workstations, Servers
- Highlight aging devices (>5 years) with warning badge
- Highlight EOL OS devices
- License utilization section (if TBR data available):
  - Table of licenses with used/total counts
  - Highlight wasted licenses

### 4j: Trends page

Create `client/src/portals/client/TrendsAnalysis.tsx`:

- Ticket volume chart (bar chart, last 12 months) using Recharts (already a dependency)
- Top ticket categories (horizontal bar chart)
- Problem assets section: devices generating the most tickets
- AI recommendations section: pulled from latest TBR roadmap data
  - Each item shows: title, business impact, priority badge

### 4k: Knowledge base page

Create `client/src/portals/client/KnowledgeBase.tsx`:

- List of KB articles and service guide content
- Categorized: "Getting Started", "What to Expect", "Service Guide", "Announcements"
- Each article expandable or click-through to full content
- Search/filter capability

### 4l: New ticket form

Create `client/src/portals/client/NewTicket.tsx` (or as a dialog in Tickets.tsx):

- Fields: Summary (required), Description (required), Priority (dropdown: Low/Medium/High)
- Auto-populated: client info, contact email from authenticated user
- Submit → calls POST /api/portal/tickets
- Success → redirect to ticket detail page with pizza tracker

**Verification:** Complete client portal flow works:
1. Client user logs in via M365 SSO
2. Sees their dashboard with summary cards
3. Can browse tickets, see pizza tracker status
4. Can create a new ticket
5. Can view invoices with pay links
6. Can see agreements, security posture, assets, trends
7. Can read announcements and KB articles
8. Cannot see other clients' data
9. Cannot access internal portal pages

---

## Task 5: Announcement management (internal side)

### 5a: Add announcement CRUD routes

Create `server/routes/announcements.ts`:

```typescript
// GET /api/announcements — list all (admin/editor only)
// POST /api/announcements — create new
// PATCH /api/announcements/:id — update
// DELETE /api/announcements/:id — delete
// POST /api/announcements/:id/publish — set publishedAt to now
```

### 5b: Add announcement management UI to internal portal

Add a page or section (probably under a new "Portal Management" nav group) where MSP admins can:
- Create announcements (title, body, type, target client or all)
- Set publish/expire dates
- Write KB articles and service guide content
- Preview how it looks in the client portal

---

## Task 6: Client portal enablement (internal side)

### 6a: Add portal toggle to client management page

In the existing Clients page, add per-client:
- Toggle: "Enable client portal" (sets clients.portal_enabled)
- Button: "Manage portal users" → shows SSO users who have logged in
- Ability to designate client admins
- Ability to pre-register client contacts (email) so they're auto-approved on first SSO login

### 6b: Add portal settings to client record

Portal settings per client (stored in clients.portal_settings JSONB):
```json
{
  "allowTicketCreation": true,
  "ticketCreationRoles": ["client_admin", "client_user"],
  "showInvoices": true,
  "showAgreements": true,
  "showSecurityDashboard": true,
  "showAssets": true,
  "showTrends": true,
  "paymentUrl": "https://pay.pelycon.com"
}
```

Portal pages check these settings and hide/show sections accordingly.

---

## Task 7: Final integration and testing

### 7a: Wire up all portal routes in server/routes.ts

```typescript
import { registerPortalRoutes } from "./routes/portal";
// ... in registerRoutes():
registerPortalRoutes(app);
```

### 7b: Update frontend routing in App.tsx

Add the client portal layout and routes alongside the existing internal routes.

### 7c: Test the full flow

1. Enable portal for a test client
2. Register an Azure AD app for M365 SSO
3. Log in as a client user → see client dashboard
4. Log in as MSP admin → see internal dashboard (existing)
5. Verify data scoping — client sees only their data
6. Create a ticket from client portal → verify it appears in ConnectWise
7. Update ticket status in CW → verify pizza tracker updates on portal
8. Check invoices show correct pay link
9. Verify security dashboard pulls from CIPP
10. Post an announcement from internal side → verify client sees it

### 7d: Commit and push

```bash
git add -A
git commit -m "Phase 2 complete - PSA adapter, M365 SSO, client portal MVP"
git push
```

---

## Done — Phase 2 complete

At this point you have:
- ✅ ConnectWise PSA adapter with normalized ticket statuses
- ✅ Status mapping for pizza tracker (25 CW statuses → 5 client-facing stages)
- ✅ M365 SSO authentication for client users
- ✅ Client portal with role-based routing (same app, different views)
- ✅ Ticket center with pizza tracker status visualization
- ✅ New ticket creation from portal
- ✅ Invoice list with pay.pelycon.com links
- ✅ Agreement viewer
- ✅ Security dashboard (Secure Score, MFA, email posture)
- ✅ Asset inventory and licensing
- ✅ Trends and analysis page
- ✅ Announcements and KB system
- ✅ Internal announcement management
- ✅ Per-client portal enablement with configurable features

**Next:** Phase 3 adds real-time webhook updates for the pizza tracker, deeper security analytics, SLA dashboards, and starts the HaloPSA adapter.
