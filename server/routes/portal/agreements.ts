import type { Express, Request, Response } from "express";
import type { PSAAdapter } from "../../adapters/psa/types";

export function registerPortalAgreementRoutes(app: Express) {
  app.get("/api/portal/agreements", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const clientId = (req as any).psaCompanyId as string;

      const agreements = await psa.getAgreementsForClient(clientId);
      res.json(agreements);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
