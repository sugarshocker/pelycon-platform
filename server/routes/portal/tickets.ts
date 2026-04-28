import type { Express, Request, Response } from "express";
import type { PSAAdapter } from "../../adapters/psa/types";
import { getStatusDetail, STAGE_LABELS } from "../../adapters/psa/statusMap";

export function registerPortalTicketRoutes(app: Express) {
  app.get("/api/portal/tickets", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const clientId = (req as any).psaCompanyId as string;
      const status = (req.query.status as "open" | "resolved" | "all") || "open";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const tickets = await psa.getTicketsForClient(clientId, { status, limit });
      res.json(tickets.map(t => ({
        ...t,
        stageLabel: STAGE_LABELS[t.status],
        statusDetail: getStatusDetail(t.statusRaw),
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portal/tickets/:ticketId", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const clientId = (req as any).psaCompanyId as string;
      const ticket = await psa.getTicketById(req.params.ticketId as string);

      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.clientId !== clientId) return res.status(403).json({ message: "Access denied" });

      const notes = await psa.getTicketNotes(req.params.ticketId as string, false);
      res.json({
        ...ticket,
        stageLabel: STAGE_LABELS[ticket.status],
        statusDetail: getStatusDetail(ticket.statusRaw),
        notes,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/portal/tickets", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const user = (req as any).user;
      const clientId = (req as any).psaCompanyId as string;
      const { summary, description, priority } = req.body;

      if (!summary || !description) {
        return res.status(400).json({ message: "Summary and description are required" });
      }

      const ticket = await psa.createTicket({
        summary,
        description,
        clientId,
        contactEmail: user.email,
        priority: priority || "Normal",
      });

      res.status(201).json({
        ...ticket,
        stageLabel: STAGE_LABELS[ticket.status],
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/portal/tickets/:ticketId/notes", async (req: Request, res: Response) => {
    try {
      const psa = (req as any).psaAdapter as PSAAdapter;
      const clientId = (req as any).psaCompanyId as string;
      const ticket = await psa.getTicketById(req.params.ticketId as string);

      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.clientId !== clientId) return res.status(403).json({ message: "Access denied" });

      const { text } = req.body;
      if (!text?.trim()) return res.status(400).json({ message: "Note text is required" });

      const note = await psa.addTicketNote(req.params.ticketId as string, text.trim(), false);
      res.status(201).json(note);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
