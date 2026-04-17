import * as connectwise from "./connectwise";
import { storage } from "../storage";
import { log } from "../index";
import { generateMarginAnalysis } from "./marginAnalysis";

export async function syncAccountsFromConnectWise(): Promise<{ results: any[]; removed: string[] }> {
  const cwClients = await connectwise.getManagedServicesClients();
  log(`[accounts-sync] Found ${cwClients.length} managed services clients from ConnectWise agreements`);

  const results = [];
  for (const client of cwClients) {
    const knownAgreementRevenue = client.agreementMonthlyRevenue * 12;
    let financials: any = { agreementRevenue: knownAgreementRevenue, projectRevenue: 0, totalRevenue: knownAgreementRevenue, grossMarginPercent: null, serviceMarginPercent: null, projectMarginPercent: null, laborCost: 0, serviceLaborCost: 0, projectLaborCost: 0, additionCost: 0, projectProductCost: 0, expenseCost: 0, msLicensingRevenue: 0, msLicensingCost: 0, totalCost: 0, serviceHours: 0, projectHours: 0, totalHours: 0, engineers: [], agreementAdditions: [] };
    try {
      financials = await connectwise.getCompanyFinancials(client.cwCompanyId);
    } catch (e: any) {
      log(`[accounts-sync] Skipping financials for ${client.companyName}: ${e.message}`);
    }

    const autoTier = financials.totalRevenue >= 60000 ? "A" : financials.totalRevenue >= 24000 ? "B" : "C";
    const marginInsights = generateMarginAnalysis(financials, financials.engineers || []);

    let arSummary = null;
    try {
      arSummary = await connectwise.getCompanyARSummary(client.cwCompanyId);
    } catch (e: any) {
      log(`[accounts-sync] Skipping AR for ${client.companyName}: ${e.message}`);
    }

    const account = await storage.upsertClientAccount({
      cwCompanyId: client.cwCompanyId,
      companyName: client.companyName,
      tier: autoTier,
      agreementRevenue: financials.agreementRevenue,
      projectRevenue: financials.projectRevenue,
      totalRevenue: financials.totalRevenue,
      laborCost: financials.laborCost,
      serviceLaborCost: financials.serviceLaborCost,
      projectLaborCost: financials.projectLaborCost,
      additionCost: financials.additionCost || 0,
      projectProductCost: financials.projectProductCost || 0,
      expenseCost: financials.expenseCost || 0,
      msLicensingRevenue: financials.msLicensingRevenue || 0,
      msLicensingCost: financials.msLicensingCost || 0,
      totalCost: financials.totalCost,
      serviceMarginPercent: financials.serviceMarginPercent,
      projectMarginPercent: financials.projectMarginPercent,
      grossMarginPercent: financials.grossMarginPercent,
      serviceHours: financials.serviceHours,
      projectHours: financials.projectHours,
      totalHours: financials.totalHours,
      engineerBreakdown: financials.engineers,
      agreementAdditions: financials.agreementAdditions || [],
      marginAnalysis: marginInsights,
      arSummary: arSummary,
      agreementTypes: client.agreementTypes.join(", "),
      lastSyncedAt: new Date(),
    });
    results.push(account);
  }

  const freshCwIds = new Set(cwClients.map(c => c.cwCompanyId));
  const allExisting = await storage.getAllClientAccounts();
  const removed: string[] = [];
  for (const acct of allExisting) {
    if (!freshCwIds.has(acct.cwCompanyId)) {
      await storage.deleteClientAccount(acct.id);
      log(`[accounts-sync] Pruned "${acct.companyName}" (cwId ${acct.cwCompanyId}) — no longer an active CW Client`);
      removed.push(acct.companyName);
    }
  }
  if (removed.length) log(`[accounts-sync] Removed ${removed.length} account(s): ${removed.join(", ")}`);

  return { results, removed };
}

export async function syncArOnlyClients(): Promise<number> {
  const allAgreementClients = await connectwise.getAllAgreementClients();
  const managedAccounts = await storage.getAllClientAccounts();
  const managedCwIds = new Set(managedAccounts.map(a => a.cwCompanyId));

  const arOnlyCompanies = allAgreementClients.filter(c => !managedCwIds.has(c.cwCompanyId));
  log(`[ar-sync] Found ${arOnlyCompanies.length} additional agreement clients (non-managed-services)`);

  let synced = 0;
  for (const client of arOnlyCompanies) {
    let arSummary = null;
    try {
      arSummary = await connectwise.getCompanyARSummary(client.cwCompanyId);
    } catch (e: any) {
      log(`[ar-sync] Skipping AR for ${client.companyName}: ${e.message}`);
    }

    await storage.upsertArOnlyClient({
      cwCompanyId: client.cwCompanyId,
      companyName: client.companyName,
      agreementTypes: client.agreementTypes.join(", "),
      agreementMonthlyRevenue: client.agreementMonthlyRevenue,
      arSummary: arSummary,
      lastSyncedAt: new Date(),
    });
    synced++;
  }
  return synced;
}

const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
let autoSyncRunning = false;

export async function runAutoSync() {
  if (autoSyncRunning) return;
  if (!connectwise.isConfigured()) return;
  autoSyncRunning = true;
  try {
    log("[accounts-sync] Starting automatic sync...");
    const { results, removed } = await syncAccountsFromConnectWise();
    log(`[accounts-sync] Auto-sync complete: ${results.length} accounts updated, ${removed.length} removed`);
    const arOnlyCount = await syncArOnlyClients();
    log(`[ar-sync] AR-only sync complete: ${arOnlyCount} additional clients updated`);
  } catch (err: any) {
    log(`[accounts-sync] Auto-sync error: ${err.message}`);
  } finally {
    autoSyncRunning = false;
  }
}

export const AUTO_SYNC_HOURS = AUTO_SYNC_INTERVAL_MS / 3600000;

export function startAutoSync() {
  setTimeout(() => runAutoSync(), 30000);
  setInterval(() => runAutoSync(), AUTO_SYNC_INTERVAL_MS);
  log(`[accounts-sync] Scheduled automatic sync every ${AUTO_SYNC_HOURS} hours`);
}
