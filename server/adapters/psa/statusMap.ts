import type { PSATicketStatus } from "./types";

const CW_STATUS_MAP: Record<string, PSATicketStatus> = {
  // Received
  'New': 'received',
  'New (email)*': 'received',
  'New (Portal)*': 'received',
  'New (N-Able)': 'received',
  'New (CW Chat)': 'received',
  'Customer Updated': 'received',
  'Re-Opened': 'received',

  // Working on it
  'Assigned': 'working',
  'In Progress': 'working',
  'Need to Escalate': 'working',
  'Needs Follow Up': 'working',
  'Requires Onsite': 'working',
  'Need Sales': 'working',
  'Update Needed': 'working',
  'Recurring': 'working',

  // Waiting (general)
  'On Hold': 'waiting',
  'Waiting on Parts': 'waiting',
  'Waiting on Vendor': 'waiting',
  'Scheduled': 'waiting',

  // Waiting on client
  'Waiting Client Response*': 'waiting_client',

  // Resolved
  'Completed': 'resolved',
  'Completed*': 'resolved',
  'Enter Time': 'resolved',
  'Closed-(Auto)': 'resolved',
  '>Closed by Nable': 'resolved',
};

export function normalizeCWStatus(cwStatus: string): PSATicketStatus {
  return CW_STATUS_MAP[cwStatus] || 'working';
}

export const STAGE_LABELS: Record<PSATicketStatus, string> = {
  received: 'We received your request',
  working: 'A technician is working on this',
  waiting: "We're waiting on something",
  waiting_client: 'We need something from you',
  resolved: 'This has been resolved',
};

export function getStatusDetail(cwStatus: string): string | null {
  switch (cwStatus) {
    case 'Requires Onsite': return 'Onsite visit planned';
    case 'Waiting on Parts': return 'Waiting on parts to arrive';
    case 'Waiting on Vendor': return 'Waiting on a vendor response';
    case 'Scheduled': return null;
    case 'On Hold': return 'Temporarily on hold';
    case 'Need to Escalate': return 'Being escalated to a senior engineer';
    default: return null;
  }
}
