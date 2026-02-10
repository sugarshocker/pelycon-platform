import type { TicketSummary } from "@shared/schema";
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
