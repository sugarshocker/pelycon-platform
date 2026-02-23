import type { TicketSummary, ProjectItem } from "@shared/schema";
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
  try {
    const cwCompanyId = await findCompanyByName(companyName);

    if (cwCompanyId) {
      try {
        const tickets = await apiGet("/service/tickets", {
          conditions: `company/id = ${cwCompanyId}`,
          pageSize: "10",
          orderBy: "dateEntered desc",
        });
        if (tickets.length > 0 && tickets[0].board) {
          return { boardId: tickets[0].board.id, boardName: tickets[0].board.name };
        }
      } catch (e) {
        log(`ConnectWise: could not fetch tickets for board lookup: ${e}`);
      }
    }

    try {
      const boards = await apiGet("/service/boards", {
        conditions: `name = "Help Desk"`,
        pageSize: "1",
      });
      if (boards.length > 0) {
        return { boardId: boards[0].id, boardName: boards[0].name };
      }
    } catch (e) {
      log(`ConnectWise: could not find Help Desk board by name: ${e}`);
    }

    const allBoards = await apiGet("/service/boards", { pageSize: "25" });
    if (allBoards.length > 0) {
      return { boardId: allBoards[0].id, boardName: allBoards[0].name };
    }

    return null;
  } catch (e) {
    log(`ConnectWise getServiceBoard error: ${e}`);
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

  const board = await getServiceBoardForCompany(companyName);
  if (!board) {
    throw new Error(`Could not find a service board for "${companyName}"`);
  }

  const bulletList = followUpTasks.map(t => `• ${t}`).join("\n");
  const description = `Technology Business Review — Follow-Up Tasks (${tbrDate})\n\n${bulletList}`;

  const ticketBody: any = {
    summary: `TBR Follow-Up Tasks — ${companyName} (${tbrDate})`,
    company: { id: cwCompanyId },
    board: { id: board.boardId },
    priority: { name: "Medium" },
    initialDescription: description,
  };

  const ticket = await apiPost("/service/tickets", ticketBody);
  log(`ConnectWise ticket created: #${ticket.id} for ${companyName}`);

  const ticketUrl = `https://${SITE_URL}/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=${ticket.id}`;

  return { ticketId: ticket.id, ticketUrl };
}
