// ── Normalized ticket types ─────────────────────────────────────────────────

export type PSATicketStatus = 'received' | 'working' | 'waiting' | 'waiting_client' | 'resolved';

export interface PSATicket {
  id: string;
  summary: string;
  description: string;
  status: PSATicketStatus;
  statusRaw: string;
  priority: string;
  clientId: string;
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  assignedTo: string | null;
  boardName: string | null;
  dateCreated: string;
  dateUpdated: string;
  dateClosed: string | null;
  lastActionDate: string | null;
  scheduledDate: string | null;
  requiresOnsite: boolean;
  slaInfo: {
    responseTarget: string | null;
    resolutionTarget: string | null;
    isBreached: boolean;
  } | null;
}

export interface PSATicketCreate {
  summary: string;
  description: string;
  clientId: string;
  contactEmail?: string;
  priority?: string;
  boardId?: string;
}

export interface PSATicketNote {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
  isInternal: boolean;
}

// ── Invoice types ────────────────────────────────────────────────────────────

export interface PSAInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  type: string;
  date: string;
  dueDate: string;
  total: number;
  balance: number;
  status: 'open' | 'paid' | 'partial' | 'void';
}

// ── Agreement types ──────────────────────────────────────────────────────────

export interface PSAAgreement {
  id: string;
  name: string;
  type: string;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  monthlyRevenue: number;
  status: 'active' | 'cancelled' | 'expired';
  additions: { name: string; quantity: number; unitPrice: number }[];
}

// ── Shared data types (used by sync engine) ─────────────────────────────────

export interface ManagedClient {
  psaCompanyId: number;
  companyName: string;
  agreementTypes: string[];
  agreementMonthlyRevenue: number;
}

export interface CompanyFinancials {
  agreementRevenue: number;
  projectRevenue: number;
  totalRevenue: number;
  grossMarginPercent: number | null;
  serviceMarginPercent: number | null;
  projectMarginPercent: number | null;
  laborCost: number;
  serviceLaborCost: number;
  projectLaborCost: number;
  additionCost: number;
  projectProductCost: number;
  expenseCost: number;
  msLicensingRevenue: number;
  msLicensingCost: number;
  totalCost: number;
  serviceHours: number;
  projectHours: number;
  totalHours: number;
  engineers: any[];
  agreementAdditions: any[];
}

export interface ARSummary {
  currentBalance: number;
  over30: number;
  over60: number;
  over90: number;
}

export interface TicketSummaryData {
  totalTickets: number;
  topCategories: any[];
  recurringIssues: any[];
  oldOpenTickets: any[];
  monthlyVolume: any[];
}

// ── Adapter interface ────────────────────────────────────────────────────────

export interface PSAAdapter {
  isConfigured(): boolean;

  // Client list (sync engine)
  getManagedServicesClients(): Promise<ManagedClient[]>;
  getAllAgreementClients(): Promise<ManagedClient[]>;

  // Financials (sync engine)
  getCompanyFinancials(companyId: number): Promise<CompanyFinancials>;
  getCompanyARSummary(companyId: number): Promise<ARSummary | null>;

  // Tickets (client portal)
  getTicketsForClient(clientId: string, options?: { status?: 'open' | 'resolved' | 'all'; limit?: number }): Promise<PSATicket[]>;
  getTicketById(ticketId: string): Promise<PSATicket | null>;
  getTicketNotes(ticketId: string, includeInternal?: boolean): Promise<PSATicketNote[]>;
  createTicket(data: PSATicketCreate): Promise<PSATicket>;
  addTicketNote(ticketId: string, text: string, isInternal?: boolean): Promise<PSATicketNote>;

  // Invoices (client portal)
  getInvoicesForClient(clientId: string, options?: { status?: 'open' | 'paid' | 'all'; limit?: number }): Promise<PSAInvoice[]>;

  // Agreements (client portal)
  getAgreementsForClient(clientId: string): Promise<PSAAgreement[]>;

  // Internal tools
  getTicketSummary(companyName: string): Promise<TicketSummaryData>;
  getProjectItems(companyName: string): Promise<{ completed: any[]; inProgress: any[] }>;
  createFollowUpTicket(data: { orgId: number; orgName: string; snapshotId: number; tbrData: any }): Promise<{ id: number }>;
}
