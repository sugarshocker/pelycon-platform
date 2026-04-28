/**
 * Seed a test client_user for portal testing.
 *
 * Usage:
 *   npx tsx server/scripts/seed-portal-test-user.ts            # list available clients
 *   npx tsx server/scripts/seed-portal-test-user.ts <client-id> # enable portal + create test user
 *
 * Env overrides (optional):
 *   PORTAL_TEST_EMAIL    (default: portal-test@pelycon.local)
 *   PORTAL_TEST_PASSWORD (default: portal-test-pass)
 *
 * Idempotent — running twice with the same email reassigns the user to a different client.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { clients } from "../../shared/schema";
import { storage } from "../storage";

const EMAIL = process.env.PORTAL_TEST_EMAIL || "portal-test@pelycon.local";
const PASSWORD = process.env.PORTAL_TEST_PASSWORD || "portal-test-pass";
const TENANT_ID = 1;

async function listClients() {
  const rows = await db.select().from(clients);
  if (rows.length === 0) {
    console.log("No clients found in the `clients` table.");
    console.log("Run a CW sync from the internal app first, then `npx tsx server/scripts/seed-tenant.ts`.");
    return;
  }
  console.log(`Found ${rows.length} client(s):\n`);
  console.log(" ID  | Portal | Company");
  console.log("-----+--------+---------------------------------------");
  for (const c of rows) {
    const flag = c.portalEnabled === "true" ? "  ✓  " : "     ";
    console.log(` ${String(c.id).padStart(3)} |${flag} | ${c.companyName}`);
  }
  console.log("\nUsage: npx tsx server/scripts/seed-portal-test-user.ts <client-id>");
}

async function bootstrap(clientIdRaw: string) {
  const clientId = parseInt(clientIdRaw, 10);
  if (isNaN(clientId)) {
    console.error(`Invalid client ID: "${clientIdRaw}" — must be a number.`);
    process.exit(1);
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) {
    console.error(`No client with ID ${clientId}. Run with no args to list available clients.`);
    process.exit(1);
  }

  // 1. Enable portal for this client
  await db.update(clients).set({ portalEnabled: "true" }).where(eq(clients.id, clientId));
  console.log(`✓ Portal enabled for client ${clientId}: ${client.companyName}`);

  // 2. Upsert test user
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await storage.getUserByEmail(EMAIL);

  if (existing) {
    await storage.updateUser(existing.id, {
      passwordHash,
      role: "client_user",
      clientId,
      tenantId: TENANT_ID,
      authProvider: "local",
      displayName: "Portal Test User",
    });
    console.log(`✓ Updated existing user ${EMAIL} → client ${client.companyName}`);
  } else {
    await storage.createUser({
      email: EMAIL,
      displayName: "Portal Test User",
      passwordHash,
      role: "client_user",
      tenantId: TENANT_ID,
      clientId,
      authProvider: "local",
      externalId: null,
      pageAccess: null,
    });
    console.log(`✓ Created user ${EMAIL} → client ${client.companyName}`);
  }

  console.log("");
  console.log("──────────────────────────────────────────────────────");
  console.log(" Portal test login");
  console.log("──────────────────────────────────────────────────────");
  console.log(` URL:      http://localhost:3000`);
  console.log(` Email:    ${EMAIL}`);
  console.log(` Password: ${PASSWORD}`);
  console.log("──────────────────────────────────────────────────────");
  console.log(" Log out of admin first, then log in with these creds.");
  console.log(" App.tsx role-routes you to the client portal automatically.");
}

const arg = process.argv[2];
(arg ? bootstrap(arg) : listClients())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
