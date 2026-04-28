export type PSATicketStatus = 'received' | 'working' | 'waiting' | 'waiting_client' | 'resolved';

export interface PSATicket {
  id: string;
  summary: string;
  description: string;
  status: PSATicketStatus;
  statusRaw: string;
  stageLabel: string;
  statusDetail: string | null;
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
  notes?: PSATicketNote[];
}

export interface PSATicketNote {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
  isInternal: boolean;
}

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
  paymentUrl: string | null;
}

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
  additions: { name: string; quantity: number; unitPrice: number; extPrice: number }[];
}
