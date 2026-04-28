// Cross-platform client name matching: pulls org/tenant lists from
// NinjaOne, Huntress, and CIPP and proposes mappings to ConnectWise companies.
//
// Confidence buckets used by the UI:
//   ≥ 0.95  high     — safe to auto-apply
//   ≥ 0.75  medium   — likely match, ask for confirmation
//   ≥ 0.60  low      — possible, surface but don't pre-select
//   <  0.60          — no suggestion
import * as ninjaone from "./ninjaone";
import * as huntress from "./huntress";
import * as cipp from "./cipp";
import { storage } from "../storage";
import { findBestMatch } from "../utils/matching";

export interface MappingSuggestion {
  cwCompanyId: number;
  cwCompanyName: string;
  current: {
    ninjaOrgId: number | null;
    huntressOrgId: number | null;
    cippTenantId: string | null;
  };
  suggested: {
    ninja: { id: number; name: string; score: number } | null;
    huntress: { id: number; name: string; score: number } | null;
    cipp: { id: string; name: string; score: number } | null;
  };
}

export interface MappingSuggestionResponse {
  suggestions: MappingSuggestion[];
  platformCounts: { ninja: number; huntress: number; cipp: number };
  platformErrors: { ninja?: string; huntress?: string; cipp?: string };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildMappingSuggestions(): Promise<MappingSuggestionResponse> {
  const accounts = await storage.getAllClientAccounts();
  const mappings = await storage.getAllClientMappings();
  const mappingByCwId = new Map(mappings.map(m => [m.cwCompanyId, m]));

  const platformErrors: MappingSuggestionResponse["platformErrors"] = {};

  const [ninjaOrgs, huntressOrgs, cippTenants] = await Promise.all([
    ninjaone.getOrganizations().catch((e: any) => { platformErrors.ninja = e.message; return [] as { id: number; name: string }[]; }),
    huntress.getOrganizations().catch((e: any) => { platformErrors.huntress = e.message; return [] as { id: number; name: string }[]; }),
    (async () => {
      try {
        const { isConfigured, getTenants } = await import("./cipp");
        if (!isConfigured()) return [] as { id: string; defaultDomainName: string; displayName: string }[];
        return await getTenants();
      } catch (e: any) { platformErrors.cipp = e.message; return []; }
    })(),
  ]);

  const suggestions: MappingSuggestion[] = accounts.map(acct => {
    const existing = mappingByCwId.get(acct.cwCompanyId);

    // Only suggest matches for fields that aren't already mapped
    const ninjaMatch = !existing?.ninjaOrgId
      ? findBestMatch(acct.companyName, ninjaOrgs, o => o.name, 0.6)
      : null;
    const huntressMatch = !existing?.huntressOrgId
      ? findBestMatch(acct.companyName, huntressOrgs, o => o.name, 0.6)
      : null;
    const cippMatch = !existing?.cippTenantId
      ? findBestMatch(acct.companyName, cippTenants, t => t.displayName, 0.6)
      : null;

    return {
      cwCompanyId: acct.cwCompanyId,
      cwCompanyName: acct.companyName,
      current: {
        ninjaOrgId: existing?.ninjaOrgId ?? null,
        huntressOrgId: existing?.huntressOrgId ?? null,
        cippTenantId: existing?.cippTenantId ?? null,
      },
      suggested: {
        ninja: ninjaMatch ? { id: ninjaMatch.item.id, name: ninjaMatch.item.name, score: round2(ninjaMatch.score) } : null,
        huntress: huntressMatch ? { id: huntressMatch.item.id, name: huntressMatch.item.name, score: round2(huntressMatch.score) } : null,
        cipp: cippMatch ? { id: cippMatch.item.id, name: cippMatch.item.displayName, score: round2(cippMatch.score) } : null,
      },
    };
  });

  return {
    suggestions,
    platformCounts: { ninja: ninjaOrgs.length, huntress: huntressOrgs.length, cipp: cippTenants.length },
    platformErrors,
  };
}
