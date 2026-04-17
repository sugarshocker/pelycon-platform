/**
 * Seed script: insert Pelycon as tenant 1 and populate clients table
 * from existing client_mapping + client_accounts data.
 *
 * Run with: npx tsx server/scripts/seed-tenant.ts
 */
import { db } from "../db";
import { tenants, clients, clientAccounts, clientMapping } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding tenant 1 (Pelycon)...");

  // Upsert Pelycon as tenant 1
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

  console.log("Tenant 1 created.");

  // Populate clients from client_accounts (managed) joined with client_mapping
  const accounts = await db.select().from(clientAccounts);
  const mappings = await db.select().from(clientMapping);
  const mappingByCwId = new Map(mappings.map(m => [m.cwCompanyId, m]));

  let inserted = 0;
  for (const acct of accounts) {
    const mapping = mappingByCwId.get(acct.cwCompanyId);
    await db
      .insert(clients)
      .values({
        tenantId: 1,
        psaCompanyId: acct.cwCompanyId,
        rmmOrgId: mapping?.ninjaOrgId ?? null,
        securityOrgId: mapping?.huntressOrgId ?? null,
        m365TenantDomain: mapping?.cippTenantId ?? null,
        companyName: acct.companyName,
        portalEnabled: "false",
      })
      .onConflictDoNothing();
    inserted++;
  }

  console.log(`Inserted ${inserted} clients from client_accounts.`);
  console.log("Done.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
