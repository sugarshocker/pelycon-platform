import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import dns from "dns/promises";

async function checkEmailPosture(domain: string) {
  const results = {
    spf: false,
    dmarc: false,
    dkim: false,
    dnssec: false,
    spfRecord: null as string | null,
    dmarcRecord: null as string | null,
    dkimRecord: null as string | null,
  };

  await Promise.allSettled([
    dns.resolveTxt(domain).then(records => {
      const flat = records.map(r => r.join(""));
      const spfRecord = flat.find(r => r.startsWith("v=spf1"));
      results.spf = !!spfRecord;
      results.spfRecord = spfRecord || null;
    }),
    dns.resolveTxt(`_dmarc.${domain}`).then(records => {
      const flat = records.map(r => r.join(""));
      const dmarcRecord = flat.find(r => r.startsWith("v=DMARC1"));
      results.dmarc = !!dmarcRecord;
      results.dmarcRecord = dmarcRecord || null;
    }),
    // Check common DKIM selectors
    Promise.any([
      dns.resolveTxt(`selector1._domainkey.${domain}`),
      dns.resolveTxt(`selector2._domainkey.${domain}`),
      dns.resolveTxt(`google._domainkey.${domain}`),
    ]).then(records => {
      if (records?.length) {
        results.dkim = true;
        results.dkimRecord = records[0]?.join("") || null;
      }
    }),
    dns.resolve(domain, "DS").then((records: any) => {
      results.dnssec = Array.isArray(records) && records.length > 0;
    }).catch(() => {}),
  ]);

  return results;
}

export function registerPortalSecurityRoutes(app: Express) {
  app.get("/api/portal/security", async (req: Request, res: Response) => {
    try {
      const clientDbId = (req as any).clientId as number;
      const client = await storage.getClientById(clientDbId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const domain = client.m365TenantDomain;
      const emailPosture = domain ? await checkEmailPosture(domain) : null;

      // Pull security data from most recent TBR snapshot if available
      const allSnapshots = await storage.getAllFinalizedSnapshots();
      const clientName = client.companyName;
      const snapshots = allSnapshots
        .filter(s => s.orgName.toLowerCase().trim() === clientName.toLowerCase().trim())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestSnapshot = snapshots[0] || null;

      let secureScore: number | null = null;
      let mfaCoverage: { covered: number; total: number } | null = null;

      if (latestSnapshot?.fullData) {
        const data = latestSnapshot.fullData as any;
        secureScore = data.secureScore ?? data.security?.secureScore ?? null;
        if (data.security?.satCoveragePercent != null && data.security?.satLearnerCount != null) {
          mfaCoverage = {
            covered: data.security.satLearnerCount,
            total: data.security.satTotalUsers ?? data.security.satLearnerCount,
          };
        }
      }

      // Try live CIPP call for secure score if we have tenant domain
      if (secureScore === null && domain) {
        try {
          const cipp = await import("../../services/cipp.js") as any;
          if (cipp.isConfigured() && typeof cipp.getSecureScore === "function") {
            secureScore = await cipp.getSecureScore(domain);
          }
        } catch {}
      }

      res.json({
        secureScore,
        mfaCoverage,
        emailPosture,
        dataAsOf: latestSnapshot ? new Date(latestSnapshot.createdAt).toISOString() : null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
