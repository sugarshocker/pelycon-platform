import Anthropic from "@anthropic-ai/sdk";
import type {
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  RoadmapAnalysis,
  RoadmapItem,
  ProjectItem,
} from "@shared/schema";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

interface InternalNotes {
  serviceManagerNotes: string;
  leadEngineerNotes: string;
}

function buildPrompt(
  clientName: string,
  data: {
    deviceHealth?: DeviceHealthSummary | null;
    security?: SecuritySummary | null;
    tickets?: TicketSummary | null;
    mfaReport?: MfaReport | null;
    licenseReport?: LicenseReport | null;
    internalNotes?: InternalNotes | null;
  }
): string {
  const sections: string[] = [];

  sections.push(`Client: ${clientName}`);

  if (data.deviceHealth) {
    const dh = data.deviceHealth;
    const tc = dh.deviceTypeCounts;
    const typeBreakdown = tc ? [
      tc.windowsLaptops > 0 ? `${tc.windowsLaptops} Windows Laptops` : "",
      tc.windowsDesktops > 0 ? `${tc.windowsDesktops} Windows Desktops` : "",
      tc.macLaptops > 0 ? `${tc.macLaptops} Mac Laptops` : "",
      tc.macDesktops > 0 ? `${tc.macDesktops} Mac Desktops` : "",
      tc.windowsServers > 0 ? `${tc.windowsServers} Windows Servers` : "",
    ].filter(Boolean).join(", ") : `${dh.workstations} workstations, ${dh.servers} servers`;
    sections.push(`
DEVICE HEALTH:
- Total managed devices: ${dh.totalDevices} (${typeBreakdown})
- Devices over 5 years old: ${dh.oldDevices.length} (${dh.oldDevices.map((d) => `${d.systemName}: ${d.deviceType}, ${d.age} years`).join(", ") || "none"})
- Devices with unsupported OS: ${dh.eolOsDevices.length} (${dh.eolOsDevices.map((d) => `${d.systemName}: ${d.osName}`).join(", ") || "none"})
- Devices needing replacement (old or unsupported OS): ${dh.needsReplacementCount}
- Inactive devices (30+ days no contact, possibly decommissioned): ${dh.staleDevices ? dh.staleDevices.length : 0}${dh.staleDevices && dh.staleDevices.length > 0 ? ` (${dh.staleDevices.map((d) => `${d.systemName}: ${d.daysSinceContact} days`).join(", ")})` : ""}
- Pending software patches: ${dh.pendingPatchCount}
- Critical alerts: ${dh.criticalAlerts.length} unresolved`);
  }

  if (data.security) {
    const sec = data.security;
    sections.push(`
SECURITY:
- Total incidents (6 months): ${sec.totalIncidents}
- Resolved: ${sec.resolvedIncidents}, Pending: ${sec.pendingIncidents}
- Protected devices (EDR agents): ${sec.activeAgents}
- Security training completion: ${sec.satCompletionPercent !== null ? sec.satCompletionPercent + "%" : "N/A"}
- Phishing test pass rate: ${sec.phishingClickRate !== null ? sec.phishingClickRate + "%" : "N/A"}
- Security Awareness Training enrolled: ${sec.satLearnerCount !== null ? sec.satLearnerCount : "N/A"}${sec.satTotalUsers ? ` of ${sec.satTotalUsers} users (${sec.satCoveragePercent}% coverage)` : ""}${sec.satTotalUsers && sec.satLearnerCount !== null && sec.satLearnerCount < sec.satTotalUsers ? ` — ${sec.satTotalUsers - sec.satLearnerCount} users NOT enrolled in security awareness training` : ""}`);
  }

  if (data.tickets) {
    const tk = data.tickets;
    sections.push(`
SUPPORT REQUESTS:
- Total tickets (6 months): ${tk.totalTickets}
- Top categories: ${tk.topCategories.map((c) => `${c.name} (${c.count})`).join(", ") || "none"}
- Recurring issues: ${tk.recurringIssues.map((i) => `"${i.subject}" (${i.count}x)`).join(", ") || "none"}
- Open tickets over 30 days: ${tk.oldOpenTickets.length}`);
  }

  if (data.mfaReport) {
    const mfa = data.mfaReport;
    const coveragePct = mfa.totalUsers > 0 ? Math.round((mfa.coveredCount / mfa.totalUsers) * 100) : 100;
    sections.push(`
MFA STATUS (CRITICAL - this is one of the most important security measures):
- Active licensed users: ${mfa.totalUsers}
- Users with MFA coverage: ${mfa.coveredCount} (${coveragePct}%)
- Users WITHOUT any MFA coverage: ${mfa.uncoveredCount}${mfa.uncoveredCount > 0 ? ` — THIS IS A CRITICAL SECURITY GAP. These users can be compromised with just a stolen password.` : ""}
- Coverage methods: ${mfa.coveredByCA} via Conditional Access, ${mfa.coveredBySD} via Security Defaults, ${mfa.coveredByPerUser} via Per-User MFA
${mfa.uncoveredUsers.length > 0 ? `- Unprotected users: ${mfa.uncoveredUsers.map((u) => u.displayName).join(", ")}` : "- All users are protected"}`);
  }

  if (data.licenseReport) {
    const lic = data.licenseReport;
    sections.push(`
LICENSE USAGE:
- Total unused licenses: ${lic.totalWasted} (wasting $${lic.totalMonthlyWaste.toFixed(2)}/mo, $${lic.totalAnnualWaste.toFixed(2)}/yr)
${lic.licenses
  .filter((l) => l.wasted > 0)
  .map((l) => `- ${l.licenseName}: ${l.wasted} unused at $${l.monthlyPricePerLicense.toFixed(2)}/user/mo = $${l.monthlyWastedCost.toFixed(2)}/mo wasted (${l.quantityUsed}/${l.totalLicenses} in use)`)
  .join("\n")}`);
  }

  if (data.internalNotes) {
    const notes = data.internalNotes;
    const hasSm = notes.serviceManagerNotes?.trim();
    const hasEng = notes.leadEngineerNotes?.trim();
    if (hasSm || hasEng) {
      let notesSection = `\nINTERNAL TEAM OBSERVATIONS (CONFIDENTIAL — must be diplomatically rephrased):`;
      if (hasSm) {
        notesSection += `\nService Manager notes: ${notes.serviceManagerNotes}`;
      }
      if (hasEng) {
        notesSection += `\nLead Engineer notes: ${notes.leadEngineerNotes}`;
      }
      sections.push(notesSection);
    }
  }

  return sections.join("\n");
}

export function isConfigured(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY &&
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  );
}

export async function generateRoadmap(
  clientName: string,
  data: {
    deviceHealth?: DeviceHealthSummary | null;
    security?: SecuritySummary | null;
    tickets?: TicketSummary | null;
    mfaReport?: MfaReport | null;
    licenseReport?: LicenseReport | null;
    internalNotes?: InternalNotes | null;
  }
): Promise<RoadmapAnalysis> {
  if (!isConfigured()) {
    throw new Error("AI integration is not configured. Please check your setup.");
  }

  const dataPrompt = buildPrompt(clientName, data);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an IT advisor creating a Technology Business Review priority roadmap for a business owner (NOT an IT person). Based on the following data, create a prioritized list of 3-5 recommended actions for the next 6 months.

${dataPrompt}

RULES:
- Write in plain language. No jargon. The client is a business owner reading this on screen.
- Each item should explain: what the issue is, why it matters to the BUSINESS (not IT), and how urgent it is.
- Frame everything around "avoiding surprises" — preventing unexpected costs, downtime, or security incidents.
- Priorities must be one of: "urgent" (address within 30 days), "plan_for" (address within 3-6 months), or "nice_to_have" (consider when budget allows).
- IMPORTANT: If internal team observations are provided, incorporate their insights into your recommendations but NEVER quote them directly or reveal they came from internal notes. Diplomatically rephrase any observations about user behavior, training needs, or infrastructure concerns into professional, forward-looking recommendations. Never blame users or mention specific employee complaints. Frame issues as opportunities for improvement.

MSP PRIORITY BIASES (apply these when ranking and shaping recommendations):
1. MFA COVERAGE IS THE #1 PRIORITY. If any users lack MFA, this MUST be the first "urgent" item. The goal is 100% MFA coverage — no exceptions. Frame this as the single most impactful security measure they can take.
2. BACKUP FAILURES: Only flag backup issues if they are CHRONIC or RECURRING patterns. Occasional one-off backup failures are normal and within acceptable standards — do NOT elevate these. Only mention backups if the data shows a persistent, repeated problem.
3. REPEAT PROBLEM DEVICES/USERS: If the ticket data shows the same computer or user appearing repeatedly across multiple support requests, this deserves a dedicated mention. Recurring issues signal something that needs a permanent fix rather than repeated break-fix.
4. LEAD ENGINEER NOTES GET PRIORITY: When internal engineer observations are provided, give them significant weight in shaping recommendations — they reflect hands-on knowledge of the environment. Where possible, corroborate engineer observations with supporting data from the other sections (device health, tickets, security). Engineer recommendations backed by data should be elevated in priority.

Respond with ONLY valid JSON in this exact format:
{
  "items": [
    {
      "title": "Short action title",
      "issue": "Plain language description of the issue",
      "businessImpact": "Why this matters to the business owner — in terms of money, risk, or productivity",
      "priority": "urgent | plan_for | nice_to_have"
    }
  ]
}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI");
    }

    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("Invalid response format from AI");
    }

    return {
      items: parsed.items as RoadmapItem[],
      generatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    if (err.message?.includes("model")) {
      throw new Error("AI model unavailable. Please try again in a moment.");
    }
    throw err;
  }
}

export async function generateProjectSummary(
  clientName: string,
  completed: ProjectItem[],
  inProgress: ProjectItem[]
): Promise<string> {
  if (!isConfigured()) {
    throw new Error("AI integration is not configured.");
  }

  if (completed.length === 0 && inProgress.length === 0) {
    return "No projects or project-related work found in the last 6 months.";
  }

  const completedList = completed
    .map((p) => `- ${p.name} (${p.source === "project" ? "Project" : "Service Ticket"}, completed ${p.closedDate ? new Date(p.closedDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "recently"})`)
    .join("\n");

  const inProgressList = inProgress
    .map((p) => `- ${p.name} (${p.source === "project" ? "Project" : "Service Ticket"}, status: ${p.status}, started ${new Date(p.dateEntered).toLocaleDateString("en-US", { month: "short", year: "numeric" })})`)
    .join("\n");

  const prompt = `You are summarizing IT projects for a business owner during a semi-annual Technology Business Review meeting for their company "${clientName}". Write a brief, plain-language summary (3-5 sentences) of what was accomplished and what's currently underway. Do NOT use bullet points. Write in a conversational, professional tone as if you're speaking to the business owner. Focus on the business value delivered, not technical details.

COMPLETED PROJECTS (last 6 months):
${completedList || "None"}

IN-PROGRESS PROJECTS:
${inProgressList || "None"}

Write only the summary paragraph — no headers, no intro, no bullet points. Keep it to 3-5 sentences.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  return textBlock.text.trim();
}
