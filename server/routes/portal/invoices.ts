import type { Express, Request, Response } from "express";
import type { PSAAdapter } from "../../adapters/psa/types";

const PAYMENT_URL = "https://pay.pelycon.com";

export function registerPortalInvoiceRoutes(app: Express) {
  app.get("/api/portal/invoices", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const clientId = String((req as any).clientId);
      const status = (req.query.status as "open" | "paid" | "all") || "all";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const invoices = await psa.getInvoicesForClient(clientId, { status, limit });
      res.json(invoices.map(inv => ({
        ...inv,
        paymentUrl: inv.status !== "paid" ? PAYMENT_URL : null,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portal/invoices/summary", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const clientId = String((req as any).clientId);

      const [openInvoices, allInvoices] = await Promise.all([
        psa.getInvoicesForClient(clientId, { status: "open", limit: 100 }),
        psa.getInvoicesForClient(clientId, { status: "all", limit: 100 }),
      ]);

      const outstanding = openInvoices.reduce((sum, inv) => sum + inv.balance, 0);
      const overdue = openInvoices
        .filter(inv => inv.dueDate && new Date(inv.dueDate) < new Date())
        .reduce((sum, inv) => sum + inv.balance, 0);

      // Build monthly paid history (last 6 months)
      const now = new Date();
      const monthlyHistory: { month: string; paid: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString("default", { month: "short", year: "numeric" });
        const paid = allInvoices
          .filter(inv => {
            if (inv.status !== "paid") return false;
            const invDate = new Date(inv.date);
            return invDate.getFullYear() === d.getFullYear() && invDate.getMonth() === d.getMonth();
          })
          .reduce((sum, inv) => sum + inv.total, 0);
        monthlyHistory.push({ month: label, paid });
      }

      res.json({
        outstanding,
        overdue,
        openCount: openInvoices.length,
        paymentUrl: outstanding > 0 ? PAYMENT_URL : null,
        monthlyHistory,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
