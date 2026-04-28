import type { PSAAdapter, PSATicket, PSATicketCreate, PSATicketNote, PSAInvoice, PSAAgreement, ManagedClient, CompanyFinancials, ARSummary, TicketSummaryData } from "./types";
import { normalizeCWStatus } from "./statusMap";
import * as cw from "../../services/connectwise";

export class ConnectWiseAdapter implements PSAAdapter {
  // Config is read from env vars by the underlying service module
  isConfigured(): boolean {
    return cw.isConfigured();
  }

  // ── Sync engine delegation ──────────────────────────────────────────────

  async getManagedServicesClients(): Promise<ManagedClient[]> {
    const clients = await cw.getManagedServicesClients();
    return clients.map(c => ({
      psaCompanyId: c.cwCompanyId,
      companyName: c.companyName,
      agreementTypes: c.agreementTypes,
      agreementMonthlyRevenue: c.agreementMonthlyRevenue,
    }));
  }

  async getAllAgreementClients(): Promise<ManagedClient[]> {
    const clients = await cw.getAllAgreementClients();
    return clients.map(c => ({
      psaCompanyId: c.cwCompanyId,
      companyName: c.companyName,
      agreementTypes: c.agreementTypes,
      agreementMonthlyRevenue: c.agreementMonthlyRevenue,
    }));
  }

  async getCompanyFinancials(companyId: number): Promise<CompanyFinancials> {
    return cw.getCompanyFinancials(companyId) as unknown as CompanyFinancials;
  }

  async getCompanyARSummary(companyId: number): Promise<ARSummary | null> {
    const result = await cw.getCompanyARSummary(companyId);
    if (!result) return null;
    return {
      currentBalance: result.outstandingBalance ?? 0,
      over30: result.aging?.days1to30 ?? 0,
      over60: result.aging?.days31to60 ?? 0,
      over90: (result.aging?.days61to90 ?? 0) + (result.aging?.days91plus ?? 0),
    };
  }

  async getTicketSummary(companyName: string): Promise<TicketSummaryData> {
    return cw.getTicketSummary(companyName) as unknown as TicketSummaryData;
  }

  async getProjectItems(companyName: string): Promise<{ completed: any[]; inProgress: any[] }> {
    return cw.getProjectItems(companyName);
  }

  async createFollowUpTicket(data: { orgId: number; orgName: string; snapshotId: number; tbrData: any }): Promise<{ id: number }> {
    const tasks: string[] = (data.tbrData?.roadmapItems || [])
      .filter((item: any) => item.priority === 'urgent' || item.priority === 'high')
      .map((item: any) => item.title || item.description || '(untitled)');
    const result = await cw.createFollowUpTicket(data.orgName, tasks, new Date().toISOString().split('T')[0]);
    return { id: result.ticketId };
  }

  // ── Portal ticket methods ───────────────────────────────────────────────

  async getTicketsForClient(clientId: string, options: { status?: 'open' | 'resolved' | 'all'; limit?: number } = {}): Promise<PSATicket[]> {
    const { status = 'open', limit = 50 } = options;
    let conditions = `company/id = ${clientId}`;
    if (status === 'open') conditions += ' AND closedFlag = false';
    else if (status === 'resolved') conditions += ' AND closedFlag = true';

    const tickets = await cw.apiGet("/service/tickets", {
      conditions,
      pageSize: String(limit),
      orderBy: "lastUpdated desc",
    });

    return (tickets || []).map((t: any) => this._normalizeTicket(t));
  }

  async getTicketById(ticketId: string): Promise<PSATicket | null> {
    try {
      const t = await cw.apiGet(`/service/tickets/${ticketId}`);
      return this._normalizeTicket(t);
    } catch {
      return null;
    }
  }

  async getTicketNotes(ticketId: string, includeInternal = false): Promise<PSATicketNote[]> {
    const notes = await cw.apiGet(`/service/tickets/${ticketId}/notes`, {
      pageSize: "200",
      orderBy: "dateCreated asc",
    });
    return (notes || [])
      .filter((n: any) => includeInternal || !n.internalAnalysisFlag)
      .map((n: any): PSATicketNote => ({
        id: String(n.id),
        text: n.text || n.detailDescriptionFlag || "",
        createdBy: n.member?.name || n.contact?.name || "Unknown",
        createdAt: n.dateCreated || "",
        isInternal: !!n.internalAnalysisFlag,
      }));
  }

  async createTicket(data: PSATicketCreate): Promise<PSATicket> {
    const body: any = {
      summary: data.summary,
      initialDescription: data.description,
      company: { id: parseInt(data.clientId) },
    };
    if (data.contactEmail) body.contactEmailAddress = data.contactEmail;
    if (data.boardId) body.board = { id: parseInt(data.boardId) };
    if (data.priority) body.priority = { name: data.priority };

    const ticket = await cw.apiGet(`/service/tickets`); // placeholder read to ensure apiGet accessible
    // Use the underlying post directly — we need apiPost which isn't exported,
    // so POST via the public createFollowUpTicket path isn't feasible.
    // Instead call POST by reusing the fetch pattern via a direct fetch:
    const created = await this._apiPost("/service/tickets", body);
    return this._normalizeTicket(created);
  }

  async addTicketNote(ticketId: string, text: string, isInternal = false): Promise<PSATicketNote> {
    const note = await this._apiPost(`/service/tickets/${ticketId}/notes`, {
      text,
      internalAnalysisFlag: isInternal,
      detailDescriptionFlag: !isInternal,
    });
    return {
      id: String(note.id),
      text: note.text || text,
      createdBy: note.member?.name || note.contact?.name || "Portal",
      createdAt: note.dateCreated || new Date().toISOString(),
      isInternal,
    };
  }

  // ── Portal invoice methods ─────────────────────────────────────────────

  async getInvoicesForClient(clientId: string, options: { status?: 'open' | 'paid' | 'all'; limit?: number } = {}): Promise<PSAInvoice[]> {
    const { status = 'all', limit = 50 } = options;
    let conditions = `company/id = ${clientId}`;
    if (status === 'open') conditions += ' AND balance > 0';
    else if (status === 'paid') conditions += ' AND balance = 0';

    const invoices = await cw.apiGet("/finance/invoices", {
      conditions,
      pageSize: String(limit),
      orderBy: "date desc",
    });

    return (invoices || []).map((inv: any): PSAInvoice => ({
      id: String(inv.id),
      invoiceNumber: inv.invoiceNumber || String(inv.id),
      clientId,
      clientName: inv.company?.name || "",
      type: inv.type || "Standard",
      date: inv.date || "",
      dueDate: inv.dueDate || inv.date || "",
      total: inv.total || 0,
      balance: inv.balance || 0,
      status: this._normalizeInvoiceStatus(inv),
    }));
  }

  // ── Portal agreement methods ───────────────────────────────────────────

  async getAgreementsForClient(clientId: string): Promise<PSAAgreement[]> {
    const agreements = await cw.apiGet("/finance/agreements", {
      conditions: `company/id = ${clientId} AND cancelledFlag = false`,
      pageSize: "100",
    });

    const results: PSAAgreement[] = [];
    for (const agr of (agreements || [])) {
      let additions: any[] = [];
      try {
        const additionData = await cw.apiGet(`/finance/agreements/${agr.id}/additions`, {
          pageSize: "100",
        });
        additions = (additionData || []).map((a: any) => ({
          name: a.product?.description || a.product?.identifier || "Unknown",
          quantity: a.quantity || 1,
          unitPrice: a.unitPrice || 0,
        }));
      } catch {}

      results.push({
        id: String(agr.id),
        name: agr.name || "",
        type: agr.agreementType?.name || agr.type?.name || (typeof agr.type === "string" ? agr.type : "Unknown"),
        clientId,
        clientName: agr.company?.name || "",
        startDate: agr.startDate || "",
        endDate: agr.endDate || null,
        monthlyRevenue: agr.monthlyRevenue || 0,
        status: agr.cancelledFlag ? 'cancelled' : this._normalizeAgreementStatus(agr),
        additions,
      });
    }
    return results;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private _normalizeTicket(t: any): PSATicket {
    const cwStatus = t.status?.name || "";
    return {
      id: String(t.id),
      summary: t.summary || "",
      description: t.initialDescription || t.initialInternalAnalysis || "",
      status: normalizeCWStatus(cwStatus),
      statusRaw: cwStatus,
      priority: t.priority?.name || "Normal",
      clientId: String(t.company?.id || ""),
      clientName: t.company?.name || "",
      contactName: t.contact?.name || null,
      contactEmail: t.contactEmailAddress || null,
      assignedTo: t.resources?.[0]?.member?.name || t.owner?.name || null,
      boardName: t.board?.name || null,
      dateCreated: t.dateEntered || "",
      dateUpdated: t.lastUpdated || "",
      dateClosed: t.closedDate || null,
      lastActionDate: t.lastUpdated || null,
      scheduledDate: t.scheduleDate || null,
      requiresOnsite: cwStatus === 'Requires Onsite',
      slaInfo: t.sla ? {
        responseTarget: t.sla.respondBy || null,
        resolutionTarget: t.sla.resolveBy || null,
        isBreached: !!(t.sla.respondByBreached || t.sla.resolveByBreached),
      } : null,
    };
  }

  private _normalizeInvoiceStatus(inv: any): PSAInvoice['status'] {
    if (inv.closedFlag) return 'void';
    const balance = inv.balance || 0;
    const total = inv.total || 0;
    if (balance <= 0) return 'paid';
    if (balance < total) return 'partial';
    return 'open';
  }

  private _normalizeAgreementStatus(agr: any): PSAAgreement['status'] {
    if (agr.cancelledFlag) return 'cancelled';
    const end = agr.endDate ? new Date(agr.endDate) : null;
    if (end && end < new Date()) return 'expired';
    return 'active';
  }

  private async _apiPost(path: string, body: any): Promise<any> {
    // Reuse auth pattern from connectwise.ts — pull env vars directly
    const companyId = (process.env.CW_COMPANY_ID || "").replace(/\\n/g, "").trim();
    const publicKey = (process.env.CW_PUBLIC_KEY || "").replace(/\\n/g, "").trim();
    const privateKey = (process.env.CW_PRIVATE_KEY || "").replace(/\\n/g, "").trim();
    const clientId = (process.env.CW_CLIENT_ID || "").replace(/\\n/g, "").trim();
    const siteUrl = (process.env.CW_SITE_URL || "na.myconnectwise.net").replace(/\\n/g, "").trim();
    const baseUrl = `https://${siteUrl}/v4_6_release/apis/3.0`;
    const auth = Buffer.from(`${companyId}+${publicKey}:${privateKey}`).toString("base64");

    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "clientId": clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CW POST ${path} failed ${res.status}: ${text}`);
    }
    return res.json();
  }
}
