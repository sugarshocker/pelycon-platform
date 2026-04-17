# Phase 1 — Restructure & Foundation

**Goal:** Break the monolith into modules, add multi-tenant columns, set up proper infrastructure. Zero feature changes — the app should work identically when Phase 1 is done.

**Important:** After each task, run `npx tsc --noEmit` to verify no type errors. Commit after each task.

---

## Task 1: Break routes.ts into domain modules

This is the biggest single task. The 2,600-line `routes.ts` becomes 10+ smaller files.

**Create `server/routes/` directory and split as follows:**

### 1a: `server/routes/auth.ts`
Move from `routes.ts`:
- `POST /api/auth/login`
- `GET /api/auth/check`
- `POST /api/auth/logout`
- `POST /api/auth/setup`
- `GET /api/auth/needs-setup`
- The `requireAuth`, `requireAdmin`, `requireEditor` middleware functions
- The `TokenSession` interface and `tokenSessions` Map
- Move middleware functions to `server/middleware/auth.ts` and import them everywhere

### 1b: `server/routes/users.ts`
Move from `routes.ts`:
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

### 1c: `server/routes/tbr.ts`
Move from `routes.ts`:
- `POST /api/tbr/save-draft`
- `GET /api/tbr/drafts`
- `GET /api/tbr/draft/:orgId`
- `DELETE /api/tbr/draft/:id`
- `POST /api/tbr/finalize`
- `POST /api/tbr/unfinalize/:id`
- `GET /api/tbr/history/:orgId`
- `GET /api/tbr/snapshot/:id`
- `GET /api/tbr/latest/:orgId`
- `GET /api/tbr/all-finalized`
- The `buildSnapshotMetrics()` helper function
- `POST /api/connectwise/ticket` (TBR follow-up ticket creation)

### 1d: `server/routes/accounts.ts`
Move from `routes.ts`:
- `GET /api/accounts`
- `GET /api/accounts/sync`
- `PATCH /api/accounts/:id/tier`
- `GET /api/accounts/:id/ar-refresh`
- The `syncAccountsFromConnectWise()` function
- The `syncArOnlyClients()` function
- The auto-sync `setInterval` and `runAutoSync()`
- The `generateMarginAnalysis()` function and `fmtD()` helper → **move these to `server/services/marginAnalysis.ts`** and import

### 1e: `server/routes/clients.ts`
Move from `routes.ts`:
- `PATCH /api/clients/:id/stack`
- `PATCH /api/clients/:id/tbr-invite`
- `POST /api/clients/:id/stack/refresh`
- `POST /api/clients/stack/refresh-all`
- `GET /api/clients/stack/refresh-progress`
- `GET /api/client-mappings`
- `PUT /api/client-mappings/:cwCompanyId`
- The `refreshStackForAccount()` function
- The `fuzzyNameMatch()` function → **move to `server/utils/matching.ts`** and import
- The `bulkRefreshJob` state object

### 1f: `server/routes/receivables.ts`
Move from `routes.ts`:
- `GET /api/receivables/clients`
- `GET /api/receivables/sync`

### 1g: `server/routes/sales.ts`
Move from `routes.ts`:
- `GET /api/sales/quotes`

### 1h: `server/routes/devices.ts`
Move from `routes.ts`:
- `GET /api/devices/:orgId`
- `GET /api/device-users/:orgId`
- `GET /api/coverage-gap/:orgId`

### 1i: `server/routes/security.ts`
Move from `routes.ts`:
- `GET /api/security/:orgId`

### 1j: `server/routes/reports.ts`
Move from `routes.ts`:
- `POST /api/reports/mfa`
- `POST /api/reports/license`
- `POST /api/reports/process-staging`
- `POST /api/roadmap/generate`
- `POST /api/export/summary`
- `GET /api/export/snapshot/:id`
- `POST /api/projects/summarize`

### 1k: `server/routes/staging.ts`
Move from `routes.ts`:
- `GET /api/staging`
- `GET /api/staging/:orgId`
- `POST /api/staging/save`
- `POST /api/staging/upload-mfa`
- `POST /api/staging/upload-license`
- `DELETE /api/staging/:id`

### 1l: `server/routes/organizations.ts`
Move from `routes.ts`:
- `GET /api/organizations`
- `GET /api/huntress/organizations`
- `GET /api/cipp/tenants`
- `GET /api/status`

### 1m: `server/routes/settings.ts`
Move from `routes.ts`:
- `GET /api/app-settings`
- `POST /api/app-settings`
- `GET /api/reminders/status`
- `POST /api/reminders/send-now`

### 1n: `server/routes/dropsuite.ts`
Move from `routes.ts`:
- `POST /api/dropsuite/import-csv`
- `GET /api/dropsuite/accounts`

### 1o: `server/routes/debug.ts`
Move from `routes.ts`:
- `GET /api/cw-debug/financial-breakdown/:companyId`

### 1p: Update `routes.ts` to be a thin router
Replace the entire contents of `routes.ts` with a file that imports all route modules and registers them:

```typescript
import type { Express } from "express";
import type { Server } from "http";
import { registerAuthRoutes } from "./routes/auth";
import { registerUserRoutes } from "./routes/users";
import { registerTbrRoutes } from "./routes/tbr";
// ... etc for all modules

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerTbrRoutes(app);
  // ... etc
  return httpServer;
}
```

Each route module exports a function like:
```typescript
export function registerTbrRoutes(app: Express) {
  app.post("/api/tbr/save-draft", requireAuth, requireEditor, async (req, res) => { ... });
  // etc
}
```

**Verification:** Run the app. Every existing API endpoint should work exactly as before. No behavior changes.

---

## Task 2: Extract shared utilities

### 2a: `server/utils/matching.ts`
Move `fuzzyNameMatch()` from the routes into a shared utility.

### 2b: `server/services/marginAnalysis.ts`
Move `generateMarginAnalysis()` and `fmtD()` from routes into a service module.

### 2c: `server/services/syncEngine.ts`
Move `syncAccountsFromConnectWise()`, `syncArOnlyClients()`, and `runAutoSync()` into a dedicated sync service. The routes just call these functions.

**Verification:** `npx tsc --noEmit` passes. App runs. All API responses identical.

---

## Task 3: Create tenant and client tables

### 3a: Add tables to schema

Add to `shared/schema.ts`:

```typescript
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  psaType: text("psa_type").notNull().default("connectwise"),
  psaConfig: jsonb("psa_config"),
  rmmType: text("rmm_type").default("ninjaone"),
  rmmConfig: jsonb("rmm_config"),
  securityType: text("security_type").default("huntress"),
  securityConfig: jsonb("security_config"),
  m365Type: text("m365_type").default("cipp"),
  m365Config: jsonb("m365_config"),
  branding: jsonb("branding"),
  features: jsonb("features"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  psaCompanyId: integer("psa_company_id"),
  rmmOrgId: integer("rmm_org_id"),
  securityOrgId: integer("security_org_id"),
  m365TenantDomain: text("m365_tenant_domain"),
  companyName: text("company_name").notNull(),
  portalEnabled: text("portal_enabled").default("false"),
  portalSettings: jsonb("portal_settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 3b: Run migration

```bash
npx drizzle-kit push
```

### 3c: Seed Pelycon as tenant 1

Create a seed script or migration that:
1. Inserts Pelycon as tenant `id=1`
2. Populates `clients` table from existing `client_mapping` + `client_accounts` data

**Verification:** Tables exist. Seed data populated. App still runs.

---

## Task 4: Add tenantId to existing tables

### 4a: Add column to each table

For each table (`users`, `tbr_snapshots`, `tbr_schedules`, `tbr_staging`, `client_accounts`, `ar_only_clients`, `dropsuite_accounts`, `app_settings`):

1. Add `tenantId: integer("tenant_id").notNull().default(1)` to the schema
2. Run `npx drizzle-kit push`
3. All existing rows automatically get `tenant_id = 1`

### 4b: Add clientId to users table

Add to users:
- `clientId: integer("client_id")` — nullable, NULL for MSP staff
- `authProvider: text("auth_provider").notNull().default("local")`
- `externalId: text("external_id")` — for M365 SSO object ID

### 4c: Update storage.ts

Every query in `storage.ts` should accept a `tenantId` parameter and filter by it. For now, all calls pass `tenantId = 1` so behavior is unchanged.

Example:
```typescript
// Before
async getAllClientAccounts(): Promise<ClientAccount[]> {
  return db.select().from(clientAccounts);
}

// After
async getAllClientAccounts(tenantId: number): Promise<ClientAccount[]> {
  return db.select().from(clientAccounts).where(eq(clientAccounts.tenantId, tenantId));
}
```

**Verification:** Every API endpoint still returns the same data. The `tenantId = 1` filter matches all existing rows.

---

## Task 5: Create middleware directory

### 5a: `server/middleware/auth.ts`
Move `requireAuth`, `requireAdmin`, `requireEditor` from routes/auth.ts to here. Export them. Import everywhere they're used.

### 5b: `server/middleware/tenant.ts`
Create tenant resolution middleware:
```typescript
export function resolveTenant(req, res, next) {
  // For now, hardcode tenant 1 (Pelycon)
  // Later: resolve from subdomain, auth token, or header
  (req as any).tenantId = 1;
  next();
}
```

Apply globally in `server/index.ts`.

### 5c: `server/middleware/portalAuth.ts`
Placeholder for client portal auth (M365 SSO). Just create the file with a TODO comment — Phase 2 fills it in.

**Verification:** App runs. Middleware is applied. No behavior change.

---

## Task 6: Create adapter directory structure (stubs only)

Create the directory structure and stub files. **Do NOT rewrite the service logic yet** — that's Phase 2. Just create the interfaces.

### 6a: `server/adapters/psa/types.ts`
Copy the PSAAdapter interface from the architecture plan (Section 4).

### 6b: `server/adapters/psa/factory.ts`
Stub that returns null for now:
```typescript
export function createPSAAdapter(psaType: string, config: any): PSAAdapter | null {
  // Phase 2: instantiate ConnectWiseAdapter or HaloPSAAdapter
  return null;
}
```

### 6c: Create empty stub files:
- `server/adapters/psa/connectwise.ts` — `// Phase 2: ConnectWiseAdapter`
- `server/adapters/psa/halopsa.ts` — `// Phase 2: HaloPSAAdapter`
- `server/adapters/rmm/types.ts` — stub RMMAdapter interface
- `server/adapters/security/types.ts` — stub SecurityAdapter interface
- `server/adapters/m365/types.ts` — stub M365Adapter interface

**Verification:** TypeScript compiles. Stubs exist. Nothing references them yet.

---

## Task 7: Create announcements table

```typescript
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  clientId: integer("client_id"),  // NULL = all clients
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("announcement"),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Run `npx drizzle-kit push`.

**Verification:** Table exists. No routes reference it yet — that's Phase 2.

---

## Task 8: Clean up and verify

### 8a: Remove Replit-specific dev dependencies
Remove from `package.json` devDependencies (only if moving off Replit):
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`
- `@replit/vite-plugin-runtime-error-modal`

Update `vite.config.ts` to remove those plugin references.

### 8b: Remove `server/replit_integrations/` directory
This was Replit-specific chat integration — won't be needed on new hosting.

### 8c: Create `.env.example`
Document all required environment variables:
```
DATABASE_URL=
REDIS_URL=
NINJAONE_CLIENT_ID=
NINJAONE_CLIENT_SECRET=
HUNTRESS_API_KEY=
HUNTRESS_API_SECRET=
HUNTRESS_SAT_API_KEY=
HUNTRESS_SAT_API_SECRET=
CW_COMPANY_ID=
CW_PUBLIC_KEY=
CW_PRIVATE_KEY=
CW_CLIENT_ID=
CW_SITE_URL=
CIPP_BASE_URL=
CIPP_CLIENT_ID=
CIPP_CLIENT_SECRET=
CIPP_TENANT=
DROPSUITE_AUTH_TOKEN=
DROPSUITE_SECRET_TOKEN=
DROPSUITE_RESELLER_TOKEN=
QUOTER_CLIENT_ID=
QUOTER_API_KEY=
SMTP2GO_API_KEY=
SMTP_FROM=
AI_INTEGRATIONS_ANTHROPIC_API_KEY=
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=
```

### 8d: Final verification
1. `npx tsc --noEmit` — no type errors
2. `npm run build` — builds successfully
3. `npm run dev` — starts and serves
4. Test every page in the UI manually — all data loads, all actions work
5. Commit everything to GitHub

---

## Done — Phase 1 complete

At this point you have:
- ✅ Clean modular file structure (10+ route files instead of 1 monolith)
- ✅ Shared utilities extracted
- ✅ Multi-tenant schema foundation (tenants, clients tables; tenantId on all tables)
- ✅ Tenant-scoped storage queries
- ✅ Middleware structure for auth and tenant resolution
- ✅ PSA adapter interface defined (stubs ready for Phase 2)
- ✅ Announcements table ready for client portal
- ✅ Clean environment configuration
- ✅ Zero behavior changes — app works identically to before

**Next:** Phase 2 starts with building the ConnectWiseAdapter, M365 SSO auth flow, and the client portal pages.
