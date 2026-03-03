import type { TicketSummary, ProjectItem, InsertClientAccount } from "@shared/schema";
import { log } from "../index";

function cleanEnv(key: string, fallback?: string): string {
  return (process.env[key] || fallback || "").replace(/\\n/g, "").trim();
}

const COMPANY_ID = cleanEnv("CW_COMPANY_ID");
const PUBLIC_KEY = cleanEnv("CW_PUBLIC_KEY");
const PRIVATE_KEY = cleanEnv("CW_PRIVATE_KEY");
const CLIENT_ID = cleanEnv("CW_CLIENT_ID");
const SITE_URL = cleanEnv("CW_SITE_URL", "na.myconnectwise.net");
const BASE_URL = `https://${SITE_URL}/v4_6_release/apis/3.0`;

export function isConfigured(): boolean {
  return !!(COMPANY_ID && PUBLIC_KEY && PRIVATE_KEY && CLIENT_ID);
}

function getAuthHeader(): string {
  const credentials = `${COMPANY_ID}+${PUBLIC_KEY}:${PRIVATE_KEY}`;
  return "Basic " + Buffer.from(credentials).toString("base64");
}

async function apiPost(path: string, body: any): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      clientId: CLIENT_ID!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConnectWise API error: ${res.status} ${text}`);
  }

  return res.json();
}

async function apiGet(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: getAuthHeader(),
      clientId: CLIENT_ID!,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConnectWise API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function findCompanyByName(name: string): Promise<number | null> {
  try {
    const companies = await apiGet("/company/companies", {
      conditions: `name like "%${name}%"`,
      pageSize: "5",
    });
    if (companies.length > 0) return companies[0].id;
    return null;
  } catch (e) {
    log(`ConnectWise findCompany error: ${e}`);
    return null;
  }
}

export async function getTicketSummary(
  companyName: string
): Promise<TicketSummary> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateStr = sixMonthsAgo.toISOString().split("T")[0];

  const cwCompanyId = await findCompanyByName(companyName);

  let conditions = `dateEntered > [${dateStr}]`;
  if (cwCompanyId) {
    conditions = `company/id = ${cwCompanyId} AND dateEntered > [${dateStr}]`;
  }

  let tickets: any[] = [];
  try {
    tickets = await apiGet("/service/tickets", {
      conditions,
      pageSize: "1000",
      orderBy: "dateEntered desc",
    });
  } catch (e) {
    log(`ConnectWise tickets error: ${e}`);
    throw e;
  }

  const categoryMap = new Map<string, number>();
  const subjectMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldOpenTickets: TicketSummary["oldOpenTickets"] = [];

  for (const t of tickets) {
    const category = t.type?.name || t.board?.name || "Uncategorized";
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);

    const subject = t.summary || "No subject";
    subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);

    const dateEntered = new Date(t.dateEntered || t._info?.dateEntered);
    const monthKey = dateEntered.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);

    const isOpen =
      t.status?.name?.toLowerCase()?.includes("open") ||
      t.closedFlag === false ||
      !t.closedDate;
    if (isOpen && dateEntered < thirtyDaysAgo) {
      const ageDays = Math.floor(
        (now.getTime() - dateEntered.getTime()) / (1000 * 60 * 60 * 24)
      );
      oldOpenTickets.push({
        id: t.id,
        summary: t.summary || "No subject",
        ageDays,
        dateEntered: dateEntered.toISOString(),
      });
    }
  }

  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const recurringIssues = Array.from(subjectMap.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([subject, count]) => ({ subject, count }));

  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => {
    const dateA = new Date(`01 ${a[0]}`);
    const dateB = new Date(`01 ${b[0]}`);
    return dateA.getTime() - dateB.getTime();
  });

  return {
    totalTickets: tickets.length,
    topCategories,
    recurringIssues,
    oldOpenTickets: oldOpenTickets.slice(0, 10),
    monthlyVolume: sortedMonths.map(([month, count]) => ({ month, count })),
  };
}

const ROUTINE_PATTERNS = [
  /\b(pc|desktop|laptop|workstation|computer)\b.*\b(setup|replacement|install|deploy|swap|refresh)\b/i,
  /\b(setup|replacement|install|deploy|swap|refresh)\b.*\b(pc|desktop|laptop|workstation|computer)\b/i,
  /\b(docking station|dock|monitor|keyboard|mouse|peripheral)\b/i,
  /\bnew (hire|employee|user|staff)\b.*\b(setup|onboard)/i,
  /\b(onboard|offboard)ing?\b/i,
  /\bquote\s*\d+\b/i,
  /\blaptop\b.*\b(order|quote|procure|purchase)\b/i,
  /\b(order|quote|procure|purchase)\b.*\blaptop\b/i,
  /\bpc\b.*\b(no assurance|proposal|quote)\b/i,
];

function isNotableProject(name: string): boolean {
  return !ROUTINE_PATTERNS.some((pattern) => pattern.test(name));
}

export async function getProjectItems(
  companyName: string
): Promise<{ completed: ProjectItem[]; inProgress: ProjectItem[] }> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateStr = sixMonthsAgo.toISOString().split("T")[0];

  const cwCompanyId = await findCompanyByName(companyName);
  const completed: ProjectItem[] = [];
  const inProgress: ProjectItem[] = [];

  try {
    let projectConditions = `dateEntered > [${dateStr}]`;
    if (cwCompanyId) {
      projectConditions = `company/id = ${cwCompanyId} AND dateEntered > [${dateStr}]`;
    }
    const projects = await apiGet("/project/projects", {
      conditions: projectConditions,
      pageSize: "100",
      orderBy: "dateEntered desc",
    });
    for (const p of projects) {
      const name = p.name || "Unnamed Project";
      if (!isNotableProject(name)) continue;
      const item: ProjectItem = {
        id: p.id,
        name,
        status: p.status?.name || "Unknown",
        source: "project",
        dateEntered: p.dateEntered || p._info?.dateEntered || "",
        closedDate: p.closedDate || undefined,
        boardName: p.board?.name || undefined,
      };
      const statusLower = item.status.toLowerCase();
      if (statusLower.includes("clos") || statusLower.includes("complet") || statusLower.includes("done") || statusLower.includes("finish")) {
        completed.push(item);
      } else {
        inProgress.push(item);
      }
    }
  } catch (e: any) {
    log(`ConnectWise projects error: ${e.message}`);
  }

  try {
    let ticketConditions = `dateEntered > [${dateStr}] AND (summary contains "project" OR summary contains "Project")`;
    if (cwCompanyId) {
      ticketConditions = `company/id = ${cwCompanyId} AND dateEntered > [${dateStr}] AND (summary contains "project" OR summary contains "Project")`;
    }
    const projectTickets = await apiGet("/service/tickets", {
      conditions: ticketConditions,
      pageSize: "100",
      orderBy: "dateEntered desc",
    });
    const existingKeys = new Set([
      ...completed.map(p => `${p.source}-${p.id}`),
      ...inProgress.map(p => `${p.source}-${p.id}`),
    ]);
    for (const t of projectTickets) {
      if (existingKeys.has(`ticket-${t.id}`)) continue;
      const ticketName = t.summary || "Unnamed Ticket";
      if (!isNotableProject(ticketName)) continue;

      const isClosed =
        t.closedFlag === true ||
        !!t.closedDate ||
        t.status?.name?.toLowerCase()?.includes("closed") ||
        t.status?.name?.toLowerCase()?.includes("completed");

      const item: ProjectItem = {
        id: t.id,
        name: ticketName,
        status: t.status?.name || "Unknown",
        source: "ticket",
        dateEntered: t.dateEntered || "",
        closedDate: t.closedDate || undefined,
        boardName: t.board?.name || undefined,
      };
      if (isClosed) {
        completed.push(item);
      } else {
        inProgress.push(item);
      }
    }
  } catch (e: any) {
    log(`ConnectWise project tickets error: ${e.message}`);
  }

  return { completed, inProgress };
}

export async function getServiceBoardForCompany(companyName: string): Promise<{ boardId: number; boardName: string } | null> {
  const cwCompanyId = await findCompanyByName(companyName);

  if (cwCompanyId) {
    try {
      const tickets = await apiGet("/service/tickets", {
        conditions: `company/id = ${cwCompanyId}`,
        pageSize: "10",
        orderBy: "dateEntered desc",
      });
      if (tickets.length > 0 && tickets[0].board) {
        log(`ConnectWise: found board "${tickets[0].board.name}" from recent tickets`);
        return { boardId: tickets[0].board.id, boardName: tickets[0].board.name };
      }
    } catch (e) {
      log(`ConnectWise: could not fetch tickets for board lookup: ${e}`);
    }
  }

  const boardSearchNames = ["Help Desk", "Service Desk", "Support"];
  for (const boardName of boardSearchNames) {
    try {
      const boards = await apiGet("/service/boards", {
        conditions: `name = "${boardName}"`,
        pageSize: "1",
      });
      if (boards.length > 0) {
        log(`ConnectWise: found board "${boards[0].name}" by name search`);
        return { boardId: boards[0].id, boardName: boards[0].name };
      }
    } catch (e) {
      log(`ConnectWise: could not find "${boardName}" board: ${e}`);
    }
  }

  try {
    const allBoards = await apiGet("/service/boards", { pageSize: "25" });
    log(`ConnectWise: fallback board search returned ${allBoards.length} boards`);
    if (allBoards.length > 0) {
      log(`ConnectWise: using first available board "${allBoards[0].name}"`);
      return { boardId: allBoards[0].id, boardName: allBoards[0].name };
    }
  } catch (e) {
    log(`ConnectWise: could not list any boards: ${e}`);
  }

  return null;
}

async function findPriority(): Promise<{ id: number; name: string } | null> {
  try {
    const priorities = await apiGet("/service/priorities", { pageSize: "50", orderBy: "sortOrder asc" });
    if (!priorities || priorities.length === 0) return null;

    const preferred = ["Medium", "Priority 3 - Normal", "Normal", "Standard", "Low"];
    for (const name of preferred) {
      const match = priorities.find((p: any) => p.name?.toLowerCase() === name.toLowerCase());
      if (match) {
        log(`ConnectWise: using priority "${match.name}" (id: ${match.id})`);
        return { id: match.id, name: match.name };
      }
    }

    const mid = Math.floor(priorities.length / 2);
    log(`ConnectWise: no preferred priority found, using "${priorities[mid].name}" (middle of ${priorities.length})`);
    return { id: priorities[mid].id, name: priorities[mid].name };
  } catch (e) {
    log(`ConnectWise: could not fetch priorities: ${e}`);
    return null;
  }
}

export async function createFollowUpTicket(
  companyName: string,
  followUpTasks: string[],
  tbrDate: string
): Promise<{ ticketId: number; ticketUrl: string }> {
  const cwCompanyId = await findCompanyByName(companyName);
  if (!cwCompanyId) {
    throw new Error(`Could not find company "${companyName}" in ConnectWise`);
  }

  const bulletList = followUpTasks.map(t => `• ${t}`).join("\n");
  const description = `Technology Business Review — Follow-Up Tasks (${tbrDate})\n\n${bulletList}`;

  const board = await getServiceBoardForCompany(companyName);
  const priority = await findPriority();

  const buildTicketBody = (boardRef?: any) => {
    const body: any = {
      summary: `TBR Follow-Up Tasks — ${companyName} (${tbrDate})`,
      company: { id: cwCompanyId },
      initialDescription: description,
    };
    if (boardRef) body.board = boardRef;
    if (priority) body.priority = { id: priority.id };
    return body;
  };

  if (board) {
    try {
      const ticket = await apiPost("/service/tickets", buildTicketBody({ id: board.boardId }));
      log(`ConnectWise ticket created: #${ticket.id} on board "${board.boardName}" for ${companyName}`);
      const ticketUrl = `https://${SITE_URL}/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=${ticket.id}`;
      return { ticketId: ticket.id, ticketUrl };
    } catch (e: any) {
      log(`ConnectWise: ticket creation with board id ${board.boardId} failed: ${e.message}`);
    }
  }

  log(`ConnectWise: trying direct ticket creation with board names`);
  const boardNamesToTry = ["Help Desk", "Service Desk", "Support", "Service Board"];
  for (const boardName of boardNamesToTry) {
    try {
      const ticket = await apiPost("/service/tickets", buildTicketBody({ name: boardName }));
      log(`ConnectWise ticket created: #${ticket.id} on board "${boardName}" for ${companyName}`);
      const ticketUrl = `https://${SITE_URL}/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=${ticket.id}`;
      return { ticketId: ticket.id, ticketUrl };
    } catch (e: any) {
      log(`ConnectWise: ticket creation with board "${boardName}" failed: ${e.message}`);
    }
  }

  try {
    const ticket = await apiPost("/service/tickets", buildTicketBody());
    log(`ConnectWise ticket created: #${ticket.id} (no board specified) for ${companyName}`);
    const ticketUrl = `https://${SITE_URL}/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=${ticket.id}`;
    return { ticketId: ticket.id, ticketUrl };
  } catch (e: any) {
    log(`ConnectWise: ticket creation without board failed: ${e.message}`);
  }

  throw new Error(
    `Could not create a ConnectWise ticket. The API member may need "Add" permission for Service Tickets and read access to Service Boards. ` +
    `Check Security Roles in ConnectWise under the "Service Desk" tab.`
  );
}

export interface CwAgreementCompany {
  cwCompanyId: number;
  companyName: string;
  agreementTypes: string[];
  agreementMonthlyRevenue: number;
}

export async function getManagedServicesClients(): Promise<CwAgreementCompany[]> {
  const companyMap = new Map<number, CwAgreementCompany>();
  let page = 1;
  const pageSize = 250;

  while (true) {
    try {
      const agreements = await apiGet("/finance/agreements", {
        conditions: `type/name contains "Top Shelf" OR type/name contains "Managed Services"`,
        pageSize: String(pageSize),
        page: String(page),
        orderBy: "company/name asc",
      });

      if (!agreements || agreements.length === 0) break;

      for (const agr of agreements) {
        const companyId = agr.company?.id;
        const companyName = agr.company?.name;
        if (!companyId || !companyName) continue;

        const existing = companyMap.get(companyId);
        const typeName = agr.type?.name || "Unknown";
        const monthlyAmount = agr.billAmount || 0;

        if (existing) {
          if (!existing.agreementTypes.includes(typeName)) {
            existing.agreementTypes.push(typeName);
          }
          existing.agreementMonthlyRevenue += monthlyAmount;
        } else {
          companyMap.set(companyId, {
            cwCompanyId: companyId,
            companyName,
            agreementTypes: [typeName],
            agreementMonthlyRevenue: monthlyAmount,
          });
        }
      }

      if (agreements.length < pageSize) break;
      page++;
    } catch (e: any) {
      log(`ConnectWise agreements error (page ${page}): ${e.message}`);
      break;
    }
  }

  return Array.from(companyMap.values());
}

export interface EngineerCostEntry {
  memberId: number;
  memberName: string;
  memberIdentifier: string;
  serviceHours: number;
  projectHours: number;
  totalHours: number;
  hourlyCost: number;
  totalCost: number;
}

export interface CwLaborCosts {
  laborCost: number;
  serviceHours: number;
  projectHours: number;
  totalHours: number;
  engineers: EngineerCostEntry[];
}

export interface AgreementAdditionEntry {
  additionName: string;
  agreementName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  annualCost: number;
  annualRevenue: number;
  margin: number;
}

export interface CwCompanyFinancials {
  agreementRevenue: number;
  projectRevenue: number;
  totalRevenue: number;
  laborCost: number;
  additionCost: number;
  totalCost: number;
  grossMarginPercent: number | null;
  serviceHours: number;
  projectHours: number;
  totalHours: number;
  engineers: EngineerCostEntry[];
  agreementAdditions: AgreementAdditionEntry[];
}

const memberCostCache = new Map<number, { name: string; identifier: string; hourlyCost: number }>();

async function getMemberCost(memberId: number): Promise<{ name: string; identifier: string; hourlyCost: number }> {
  if (memberCostCache.has(memberId)) {
    return memberCostCache.get(memberId)!;
  }

  try {
    const member = await apiGet(`/system/members/${memberId}`);
    const result = {
      name: member.firstName && member.lastName
        ? `${member.firstName} ${member.lastName}`
        : member.identifier || `Member ${memberId}`,
      identifier: member.identifier || `member-${memberId}`,
      hourlyCost: member.hourlyCost ?? (member.dailyCost ? (member.dailyCost / 8) : 0),
    };
    memberCostCache.set(memberId, result);
    return result;
  } catch (e: any) {
    log(`ConnectWise member lookup error for member ${memberId}: ${e.message}`);
    const fallback = { name: `Member ${memberId}`, identifier: `member-${memberId}`, hourlyCost: 0 };
    memberCostCache.set(memberId, fallback);
    return fallback;
  }
}

export async function getCompanyLaborCosts(cwCompanyId: number): Promise<CwLaborCosts> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const dateStr = twelveMonthsAgo.toISOString().split("T")[0];

  const memberMap = new Map<number, { serviceHours: number; projectHours: number }>();

  let page = 1;
  const pageSize = 250;
  while (true) {
    try {
      const entries = await apiGet("/time/entries", {
        conditions: `company/id = ${cwCompanyId} AND dateEntered > [${dateStr}]`,
        pageSize: String(pageSize),
        page: String(page),
        orderBy: "dateEntered desc",
      });

      if (!entries || entries.length === 0) break;

      for (const entry of entries) {
        const memberId = entry.member?.id;
        if (!memberId) continue;
        const hours = entry.actualHours || 0;
        if (hours === 0) continue;

        const existing = memberMap.get(memberId) || { serviceHours: 0, projectHours: 0 };
        if (entry.chargeToType === "ProjectTicket") {
          existing.projectHours += hours;
        } else {
          existing.serviceHours += hours;
        }
        memberMap.set(memberId, existing);
      }

      if (entries.length < pageSize) break;
      page++;
    } catch (e: any) {
      log(`ConnectWise time entries error for company ${cwCompanyId} (page ${page}): ${e.message}`);
      break;
    }
  }

  const engineers: EngineerCostEntry[] = [];
  let totalLaborCost = 0;
  let totalServiceHours = 0;
  let totalProjectHours = 0;

  for (const [memberId, hours] of memberMap.entries()) {
    const memberInfo = await getMemberCost(memberId);
    const totalHrs = hours.serviceHours + hours.projectHours;
    const cost = totalHrs * memberInfo.hourlyCost;

    totalLaborCost += cost;
    totalServiceHours += hours.serviceHours;
    totalProjectHours += hours.projectHours;

    engineers.push({
      memberId,
      memberName: memberInfo.name,
      memberIdentifier: memberInfo.identifier,
      serviceHours: Math.round(hours.serviceHours * 100) / 100,
      projectHours: Math.round(hours.projectHours * 100) / 100,
      totalHours: Math.round(totalHrs * 100) / 100,
      hourlyCost: memberInfo.hourlyCost,
      totalCost: Math.round(cost * 100) / 100,
    });
  }

  engineers.sort((a, b) => b.totalCost - a.totalCost);

  return {
    laborCost: Math.round(totalLaborCost * 100) / 100,
    serviceHours: Math.round(totalServiceHours * 100) / 100,
    projectHours: Math.round(totalProjectHours * 100) / 100,
    totalHours: Math.round((totalServiceHours + totalProjectHours) * 100) / 100,
    engineers,
  };
}

export async function getCompanyFinancials(cwCompanyId: number): Promise<CwCompanyFinancials> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const dateStr = twelveMonthsAgo.toISOString().split("T")[0];

  let agreementRevenue = 0;
  const agreementIds: { id: number; name: string }[] = [];
  try {
    const agreements = await apiGet("/finance/agreements", {
      conditions: `company/id = ${cwCompanyId} AND cancelledFlag = false`,
      pageSize: "250",
    });
    for (const agr of agreements) {
      const amount = agr.billAmount ?? agr.amount ?? 0;
      if (amount) {
        agreementRevenue += amount * 12;
      }
      agreementIds.push({ id: agr.id, name: agr.name || `Agreement ${agr.id}` });
    }
  } catch (e: any) {
    log(`ConnectWise agreement revenue error for company ${cwCompanyId}: ${e.message}`);
  }

  let additionCost = 0;
  const agreementAdditions: AgreementAdditionEntry[] = [];
  for (const agr of agreementIds) {
    try {
      const additions = await apiGet(`/finance/agreements/${agr.id}/additions`, {
        pageSize: "250",
      });
      for (const add of additions) {
        if (add.cancelledDate) continue;
        const qty = add.quantity ?? 1;
        const unitCost = add.unitCost ?? 0;
        const unitPrice = add.unitPrice ?? add.billCustomer === "DoNotBill" ? 0 : (add.extendedPrice ?? 0) / (qty || 1);
        const billingCycle = add.billCycleId ?? 1;
        const cycleMultiplier = billingCycle === 1 ? 12 : billingCycle === 2 ? 4 : billingCycle === 3 ? 2 : 1;

        const annualCost = Math.round(qty * unitCost * cycleMultiplier * 100) / 100;
        const annualRevenue = Math.round(qty * unitPrice * cycleMultiplier * 100) / 100;
        const margin = annualRevenue > 0 ? Math.round(((annualRevenue - annualCost) / annualRevenue) * 1000) / 10 : 0;

        if (annualCost > 0 || annualRevenue > 0) {
          additionCost += annualCost;
          agreementAdditions.push({
            additionName: add.product?.description || add.description || `Addition ${add.id}`,
            agreementName: agr.name,
            quantity: qty,
            unitCost,
            unitPrice,
            annualCost,
            annualRevenue,
            margin,
          });
        }
      }
    } catch (e: any) {
      log(`ConnectWise additions error for agreement ${agr.id}: ${e.message}`);
    }
  }
  additionCost = Math.round(additionCost * 100) / 100;
  agreementAdditions.sort((a, b) => b.annualCost - a.annualCost);

  let projectRevenue = 0;
  let invoicedAgreementRevenue = 0;
  let totalInvoiced = 0;
  try {
    const invoices = await apiGet("/finance/invoices", {
      conditions: `company/id = ${cwCompanyId} AND date > [${dateStr}]`,
      pageSize: "1000",
      orderBy: "date desc",
    });
    for (const inv of invoices) {
      const amount = inv.total || 0;
      totalInvoiced += amount;
      if (inv.type === "Standard" || inv.type === "Progress" || inv.type === "Miscellaneous") {
        projectRevenue += amount;
      } else if (inv.type === "Agreement") {
        invoicedAgreementRevenue += amount;
      }
    }
  } catch (e: any) {
    log(`ConnectWise invoices error for company ${cwCompanyId}: ${e.message}`);
  }

  if (agreementRevenue === 0 && invoicedAgreementRevenue > 0) {
    agreementRevenue = invoicedAgreementRevenue;
  }

  const labor = await getCompanyLaborCosts(cwCompanyId);
  const totalRev = agreementRevenue + projectRevenue;
  const totalCostVal = Math.round((labor.laborCost + additionCost) * 100) / 100;
  let grossMarginPercent: number | null = null;

  if (totalRev > 0) {
    grossMarginPercent = Math.round(((totalRev - totalCostVal) / totalRev) * 1000) / 10;
  }

  return {
    agreementRevenue,
    projectRevenue,
    totalRevenue: totalRev,
    laborCost: labor.laborCost,
    additionCost,
    totalCost: totalCostVal,
    grossMarginPercent,
    serviceHours: labor.serviceHours,
    projectHours: labor.projectHours,
    totalHours: labor.totalHours,
    engineers: labor.engineers,
    agreementAdditions,
  };
}
