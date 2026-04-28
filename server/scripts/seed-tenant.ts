/**
 * Seed script: insert Pelycon as tenant 1 and populate / refresh the
 * clients table from existing client_mapping + client_accounts data.
 *
 * Idempotent — running again after a NinjaOne / Huntress / CIPP sync
 * will update rmmOrgId, securityOrgId, and m365TenantDomain on
 * existing rows. portalEnabled is preserved (never reset).
 *
 * Run with: npx tsx server/scripts/seed-tenant.ts
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { tenants, clients, clientAccounts, clientMapping } from "../../shared/schema";

async function seed() {
  console.log("Seeding tenant 1 (Pelycon)...");

  await db
    .insert(tenants)
    .values({
      id: 1,
      name: "Pelycon",
      slug: "pelycon",
      psaType: "connectwise",
      rmmType: "ninjaone",
      securityType: "huntress",
      m365Type: "cipp",
    })
    .onConflictDoNothing();

  console.log("Tenant 1 ensured.");

  const accounts = await db.select().from(clientAccounts);
  const mappings = await db.select().from(clientMapping);
  const mappingByCwId = new Map(mappings.map(m => [m.cwCompanyId, m]));
  const existing = await db.select().from(clients).where(eq(clients.tenantId, 1));
  const existingByPsa = new Map(existing.map(c => [c.psaCompanyId, c]));

  let inserted = 0;
  let updated = 0;
  for (const acct of accounts) {
    const mapping = mappingByCwId.get(acct.cwCompanyId);
    const existingRow = existingByPsa.get(acct.cwCompanyId);
    const fields = {
      companyName: acct.companyName,
      rmmOrgId: mapping?.ninjaOrgId ?? null,
      securityOrgId: mapping?.huntressOrgId ?? null,
      m365TenantDomain: mapping?.cippTenantId ?? null,
    };

    if (existingRow) {
      // Refresh integration mappings + name; preserve portalEnabled / portalSettings.
      await db.update(clients)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(clients.tenantId, 1), eq(clients.psaCompanyId, acct.cwCompanyId)));
      updated++;
    } else {
      await db.insert(clients).values({
        tenantId: 1,
        psaCompanyId: acct.cwCompanyId,
        portalEnabled: "false",
        ...fields,
      });
      inserted++;
    }
  }

  console.log(`Inserted ${inserted}, refreshed ${updated} client rows.`);
  console.log("Done.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
