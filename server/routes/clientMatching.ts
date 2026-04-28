import type { Express, Request, Response } from "express";
import { requireAuth, requireEditor } from "../middleware/auth";
import { storage } from "../storage";
import { buildMappingSuggestions } from "../services/clientMatchEngine";

export function registerClientMatchingRoutes(app: Express) {
  // Returns auto-suggested mappings for unmapped fields, plus existing mappings.
  // Read-only — UI presents suggestions; user confirms before applying.
  app.get("/api/client-mappings/auto-suggest", requireAuth, async (_req: Request, res: Response) => {
    try {
      const result = await buildMappingSuggestions();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Bulk-apply suggestions at or above a confidence threshold.
  // Body: { minScore?: number }  (default 0.95 — only auto-apply very confident matches)
  // Returns: { applied: number, results: [{cwCompanyId, name, updates}] }
  app.post("/api/client-mappings/auto-apply", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const minScore = typeof req.body?.minScore === "number" ? req.body.minScore : 0.95;
      const { suggestions } = await buildMappingSuggestions();
      let applied = 0;
      const results: Array<{ cwCompanyId: number; name: string; updates: Record<string, any> }> = [];

      for (const s of suggestions) {
        const updates: Record<string, any> = {};
        if (s.suggested.ninja && s.suggested.ninja.score >= minScore) updates.ninjaOrgId = s.suggested.ninja.id;
        if (s.suggested.huntress && s.suggested.huntress.score >= minScore) updates.huntressOrgId = s.suggested.huntress.id;
        if (s.suggested.cipp && s.suggested.cipp.score >= minScore) updates.cippTenantId = s.suggested.cipp.id;

        if (Object.keys(updates).length > 0) {
          await storage.upsertClientMapping({
            cwCompanyId: s.cwCompanyId,
            companyName: s.cwCompanyName,
            ...updates,
          } as any);
          applied++;
          results.push({ cwCompanyId: s.cwCompanyId, name: s.cwCompanyName, updates });
        }
      }

      res.json({ applied, total: suggestions.length, minScore, results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
