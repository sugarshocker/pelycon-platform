import type {
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  RoadmapAnalysis,
} from "@shared/schema";

const priorityLabels: Record<string, string> = {
  urgent: "Urgent",
  plan_for: "Plan For",
  nice_to_have: "Nice to Have",
};

const priorityColors: Record<string, string> = {
  urgent: "#dc2626",
  plan_for: "#2563eb",
  nice_to_have: "#6b7280",
};

export function generateSummaryHtml(data: {
  clientName: string;
  deviceHealth?: DeviceHealthSummary | null;
  security?: SecuritySummary | null;
  tickets?: TicketSummary | null;
  mfaReport?: MfaReport | null;
  licenseReport?: LicenseReport | null;
  roadmap?: RoadmapAnalysis | null;
}): string {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const nextTbr = new Date();
  nextTbr.setMonth(nextTbr.getMonth() + 6);
  const nextTbrStr = nextTbr.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let sections = "";

  if (data.deviceHealth) {
    const dh = data.deviceHealth;
    const patchColor =
      dh.patchCompliancePercent >= 90
        ? "#16a34a"
        : dh.patchCompliancePercent >= 80
          ? "#d97706"
          : "#dc2626";

    sections += `
    <div class="section">
      <h2>Device Health</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${dh.totalDevices}</div>
          <div class="metric-label">Total Devices</div>
        </div>
        <div class="metric">
          <div class="metric-value">${dh.workstations}</div>
          <div class="metric-label">Workstations</div>
        </div>
        <div class="metric">
          <div class="metric-value">${dh.servers}</div>
          <div class="metric-label">Servers</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: ${patchColor}">${dh.patchCompliancePercent}%</div>
          <div class="metric-label">Systems Up to Date</div>
        </div>
      </div>
      ${dh.oldDevices.length > 0 ? `<p class="flag-red">Aging Hardware: ${dh.oldDevices.map((d) => `${d.systemName} (${d.age}yr)`).join(", ")}</p>` : ""}
      ${dh.eolOsDevices.length > 0 ? `<p class="flag-amber">Unsupported OS: ${dh.eolOsDevices.map((d) => `${d.systemName} (${d.osName})`).join(", ")}</p>` : ""}
      ${dh.criticalAlerts.length > 0 ? `<p class="flag-red">${dh.criticalAlerts.length} critical alert(s) require attention</p>` : ""}
    </div>`;
  }

  if (data.security) {
    const sec = data.security;
    sections += `
    <div class="section">
      <h2>Security Overview</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${sec.totalIncidents}</div>
          <div class="metric-label">Incidents (6mo)</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: #16a34a">${sec.resolvedIncidents}</div>
          <div class="metric-label">Resolved</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: ${sec.pendingIncidents > 0 ? "#dc2626" : "#16a34a"}">${sec.pendingIncidents}</div>
          <div class="metric-label">Pending</div>
        </div>
        <div class="metric">
          <div class="metric-value">${sec.activeAgents}</div>
          <div class="metric-label">Protected Devices</div>
        </div>
      </div>
    </div>`;
  }

  if (data.tickets) {
    const tk = data.tickets;
    sections += `
    <div class="section">
      <h2>Support Requests</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${tk.totalTickets}</div>
          <div class="metric-label">Total (6 Months)</div>
        </div>
      </div>
      ${tk.topCategories.length > 0 ? `<p><strong>Top Categories:</strong> ${tk.topCategories.map((c) => `${c.name} (${c.count})`).join(", ")}</p>` : ""}
      ${tk.recurringIssues.length > 0 ? `<p class="flag-amber"><strong>Recurring Issues:</strong> ${tk.recurringIssues.map((i) => `${i.subject} (${i.count}x)`).join(", ")}</p>` : ""}
      ${tk.oldOpenTickets.length > 0 ? `<p class="flag-red">${tk.oldOpenTickets.length} open request(s) over 30 days old</p>` : ""}
    </div>`;
  }

  if (data.mfaReport) {
    const mfa = data.mfaReport;
    const coveragePct = mfa.totalUsers > 0 ? Math.round((mfa.coveredCount / mfa.totalUsers) * 100) : 100;
    sections += `
    <div class="section">
      <h2>Account Security (MFA)</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${mfa.totalUsers}</div>
          <div class="metric-label">Active Licensed Users</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: #16a34a">${mfa.coveredCount}</div>
          <div class="metric-label">MFA Covered</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: ${mfa.uncoveredCount > 0 ? "#dc2626" : "#16a34a"}">${mfa.uncoveredCount}</div>
          <div class="metric-label">No MFA</div>
        </div>
        <div class="metric">
          <div class="metric-value">${coveragePct}%</div>
          <div class="metric-label">Coverage</div>
        </div>
      </div>
      <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Coverage: ${mfa.coveredByCA} Conditional Access, ${mfa.coveredBySD} Security Defaults, ${mfa.coveredByPerUser} Per-User MFA</p>
      ${mfa.uncoveredUsers.length > 0 ? `<p class="flag-red">Users without MFA protection: ${mfa.uncoveredUsers.map((u) => u.displayName).join(", ")}</p>` : ""}
    </div>`;
  }

  if (data.licenseReport) {
    const lic = data.licenseReport;
    sections += `
    <div class="section">
      <h2>License Usage</h2>
      ${lic.totalWasted > 0 ? `<p class="flag-amber">${lic.totalWasted} unused license(s) detected — potential cost savings</p>` : ""}
      <table>
        <tr><th>License</th><th>In Use</th><th>Assigned</th><th>Unused</th></tr>
        ${lic.licenses.map((l) => `<tr><td>${l.licenseName}</td><td>${l.quantityUsed}</td><td>${l.quantityAssigned}</td><td${l.wasted > 0 ? ' class="flag-amber"' : ""}>${l.wasted}</td></tr>`).join("")}
      </table>
    </div>`;
  }

  if (data.roadmap && data.roadmap.items.length > 0) {
    sections += `
    <div class="section">
      <h2>Priority Roadmap</h2>
      ${data.roadmap.items
        .map(
          (item) => `
        <div class="roadmap-item">
          <div class="roadmap-header">
            <strong>${item.title}</strong>
            <span class="priority-badge" style="background: ${priorityColors[item.priority]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${priorityLabels[item.priority]}</span>
          </div>
          <p>${item.issue}</p>
          <p class="business-impact"><em>${item.businessImpact}</em></p>
        </div>`
        )
        .join("")}
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Technology Business Review — ${data.clientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 24px; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #2563eb; }
    .header h1 { font-size: 24px; color: #2563eb; margin-bottom: 4px; }
    .header .client { font-size: 20px; font-weight: 600; }
    .header .date { color: #6b7280; font-size: 14px; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 16px; color: #2563eb; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    .metrics { display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
    .metric { text-align: center; padding: 12px 16px; background: #f9fafb; border-radius: 8px; min-width: 100px; flex: 1; }
    .metric-value { font-size: 24px; font-weight: 700; }
    .metric-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .flag-red { color: #dc2626; font-size: 13px; margin-top: 8px; }
    .flag-amber { color: #d97706; font-size: 13px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { padding: 6px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .roadmap-item { padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; }
    .roadmap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px; flex-wrap: wrap; }
    .roadmap-item p { font-size: 13px; margin-top: 4px; }
    .business-impact { color: #6b7280; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Technology Business Review</h1>
    <div class="client">${data.clientName}</div>
    <div class="date">${today}</div>
  </div>
  ${sections}
  <div class="footer">
    <p>Next Technology Business Review: <strong>${nextTbrStr}</strong></p>
  </div>
</body>
</html>`;
}
