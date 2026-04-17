import type { Express, Request, Response } from "express";
import type { PSAAdapter } from "../../adapters/psa/types";
import { storage } from "../../storage";

export function registerPortalTrendRoutes(app: Express) {
  app.get("/api/portal/trends", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const clientDbId = (req as any).clientId as number;
      const client = await storage.getClientById(clientDbId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const clientId = String(client.psaCompanyId);

      // Ticket volume: last 12 months
      const allTickets = await psa.getTicketsForClient(clientId, { status: "all", limit: 500 });
      const now = new Date();
      const monthlyVolume: { month: string; count: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString("default", { month: "short", year: "numeric" });
        const count = allTickets.filter(t => {
          const td = new Date(t.dateCreated);
          return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
        }).length;
        monthlyVolume.push({ month: label, count });
      }

      // Top categories from board names
      const categoryCounts: Record<string, number> = {};
      for (const t of allTickets) {
        const cat = t.boardName || "General";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
      const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

      // AI recommendations from latest TBR snapshot
      const allSnapshots = await storage.getAllFinalizedSnapshots();
      const snapshots = allSnapshots
        .filter(s => s.orgName.toLowerCase().trim() === client.companyName.toLowerCase().trim())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestSnapshot = snapshots[0] ?? null;

      let recommendations: any[] = [];
      if (latestSnapshot?.fullData) {
        const data = latestSnapshot.fullData as any;
        recommendations = (data.roadmapItems || data.roadmap || [])
          .filter((item: any) => item.priority === "urgent" || item.priority === "high")
          .slice(0, 5)
          .map((item: any) => ({
            title: item.title || item.description || "",
            businessImpact: item.businessImpact || item.impact || "",
            priority: item.priority || "medium",
          }));
      }

      res.json({
        monthlyVolume,
        topCategories,
        recommendations,
        dataAsOf: latestSnapshot ? new Date(latestSnapshot.createdAt).toISOString() : null,
        totalTickets: allTickets.length,
        openTickets: allTickets.filter(t => t.status !== "resolved").length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
