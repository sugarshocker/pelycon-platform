import type { Express, Request, Response } from "express";
import { log } from "../index";
import { requireAuth } from "../middleware/auth";

export function registerSalesRoutes(app: Express) {
  app.get("/api/sales/quotes", requireAuth, async (_req: Request, res: Response) => {
    try {
      const { getQuotesSummary, isConfigured: quoterConfigured } = await import("../services/quoter.js");
      if (!quoterConfigured()) {
        return res.status(503).json({ message: "Quoter not configured" });
      }
      const summary = await getQuotesSummary();
      res.json(summary);
    } catch (err: any) {
      log(`Quoter quotes error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
