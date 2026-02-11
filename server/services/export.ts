import type {
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  RoadmapAnalysis,
  TbrSnapshot,
} from "@shared/schema";

const PELYCON_LOGO_B64 = "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";

function trendArrow(current: number, previous: number | null | undefined, higherIsBetter: boolean): string {
  if (previous === null || previous === undefined) return "";
  const diff = current - previous;
  if (diff === 0) return "";
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  const arrow = improved ? "&#9650;" : "&#9660;";
  const color = improved ? "#16a34a" : "#dc2626";
  const sign = diff > 0 ? "+" : "";
  return ` <span style="font-size:11px;color:${color}">${arrow} ${sign}${typeof current === "number" && current % 1 !== 0 ? diff.toFixed(1) : diff}</span>`;
}

function trendPctArrow(current: number | null | undefined, previous: number | null | undefined, higherIsBetter: boolean): string {
  if (current === null || current === undefined || previous === null || previous === undefined) return "";
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return "";
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  const arrow = improved ? "&#9650;" : "&#9660;";
  const color = improved ? "#16a34a" : "#dc2626";
  const sign = diff > 0 ? "+" : "";
  return ` <span style="font-size:11px;color:${color}">${arrow} ${sign}${Math.round(diff)}%</span>`;
}

function statusIndicator(isGood: boolean, goodText: string, badText: string): string {
  const color = isGood ? "#16a34a" : "#dc2626";
  const icon = isGood ? "&#10003;" : "&#9888;";
  const text = isGood ? goodText : badText;
  return `<span style="color:${color};font-weight:600">${icon} ${text}</span>`;
}

export function generateSummaryHtml(data: {
  clientName: string;
  deviceHealth?: DeviceHealthSummary | null;
  security?: SecuritySummary | null;
  tickets?: TicketSummary | null;
  mfaReport?: MfaReport | null;
  licenseReport?: LicenseReport | null;
  roadmap?: RoadmapAnalysis | null;
  previousSnapshot?: TbrSnapshot | null;
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

  const prev = data.previousSnapshot;
  const prevDate = prev ? new Date(prev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  let sections = "";

  // === OPERATIONAL SURPRISES ===
  const opItems: string[] = [];

  if (data.security) {
    const sec = data.security;
    const noIncidents = sec.pendingIncidents === 0;
    opItems.push(`<div class="check-item">${statusIndicator(noIncidents, "No unresolved security incidents", `${sec.pendingIncidents} security incident(s) still pending`)}</div>`);
    opItems.push(`<p class="detail">${sec.totalIncidents} total incident(s) detected in the last 6 months, ${sec.resolvedIncidents} resolved${trendArrow(sec.totalIncidents, prev?.totalIncidents, false)}</p>`);
    opItems.push(`<p class="detail">${sec.activeAgents} devices protected by endpoint detection${trendArrow(sec.activeAgents, prev?.activeAgents, true)}</p>`);

    if (sec.managedAntivirusCount > 0 || sec.antivirusNotProtectedCount > 0) {
      const avGood = sec.antivirusNotProtectedCount === 0;
      opItems.push(`<div class="check-item">${statusIndicator(avGood, "All devices have managed antivirus", `${sec.antivirusNotProtectedCount} device(s) without managed antivirus`)}</div>`);
    }

    if (sec.satLearnerCount !== null) {
      const satGap = sec.satTotalUsers ? sec.satTotalUsers - sec.satLearnerCount : 0;
      const satGood = satGap === 0;
      opItems.push(`<div class="check-item">${statusIndicator(satGood, `All users enrolled in security awareness training (${sec.satLearnerCount})`, `${satGap} user(s) not enrolled in security awareness training (${sec.satLearnerCount}${sec.satTotalUsers ? ` of ${sec.satTotalUsers}` : ""} enrolled)`)}</div>`);
    }

    if (sec.satCompletionPercent !== null) {
      const completionGood = sec.satCompletionPercent >= 80;
      opItems.push(`<div class="check-item">${statusIndicator(completionGood, `Training completion at ${sec.satCompletionPercent}%`, `Training completion at ${sec.satCompletionPercent}% \u2014 needs improvement`)}</div>`);
      if (sec.satModulesCompleted !== null && sec.satModulesAssigned !== null) {
        opItems.push(`<p class="detail">${sec.satModulesCompleted} of ${sec.satModulesAssigned} training modules completed</p>`);
      }
    }

    if (sec.phishingClickRate !== null) {
      const phishGood = sec.phishingClickRate <= 5;
      opItems.push(`<div class="check-item">${statusIndicator(phishGood, `Phishing click rate at ${sec.phishingClickRate}% \u2014 well below industry average`, `Phishing click rate at ${sec.phishingClickRate}% \u2014 ${sec.phishingClickRate > 15 ? "significantly above" : "above"} target of 5%`)}</div>`);
      if (sec.phishingCampaignCount !== null) {
        opItems.push(`<p class="detail">${sec.phishingCampaignCount} phishing simulation campaign${sec.phishingCampaignCount !== 1 ? "s" : ""} conducted</p>`);
      }
      if (sec.phishingReportRate !== null) {
        opItems.push(`<p class="detail">Phishing report rate: ${sec.phishingReportRate}% (employees correctly flagging simulations)</p>`);
      }
      if (sec.phishingCompromiseRate !== null) {
        opItems.push(`<p class="detail ${sec.phishingCompromiseRate > 3 ? "flag-amber" : ""}">Compromise rate: ${sec.phishingCompromiseRate}% (employees entering credentials)</p>`);
      }
    }
  }

  if (data.mfaReport) {
    const mfa = data.mfaReport;
    const coveragePct = mfa.totalUsers > 0 ? Math.round((mfa.coveredCount / mfa.totalUsers) * 100) : 100;
    const mfaGood = mfa.uncoveredCount === 0;
    opItems.push(`<div class="check-item">${statusIndicator(mfaGood, `100% MFA coverage across all ${mfa.totalUsers} users`, `${mfa.uncoveredCount} user(s) without multi-factor authentication (${coveragePct}% covered)`)}</div>`);
    if (mfa.uncoveredCount > 0) {
      opItems.push(`<p class="detail flag-red">Unprotected accounts: ${mfa.uncoveredUsers.map(u => u.displayName).join(", ")}</p>`);
    }
    opItems.push(`<p class="detail">Coverage method: ${mfa.coveredByCA} Conditional Access, ${mfa.coveredBySD} Security Defaults, ${mfa.coveredByPerUser} Per-User MFA${trendPctArrow(coveragePct, prev?.mfaCoveragePercent, true)}</p>`);
  }

  if (data.tickets) {
    const tk = data.tickets;
    const noOldTickets = tk.oldOpenTickets.length === 0;
    opItems.push(`<div class="check-item">${statusIndicator(noOldTickets, "No lingering support requests (30+ days old)", `${tk.oldOpenTickets.length} support request(s) open for 30+ days`)}</div>`);
    opItems.push(`<p class="detail">${tk.totalTickets} total support requests in the last 6 months${trendArrow(tk.totalTickets, prev?.totalTickets, false)}</p>`);
    if (tk.recurringIssues.length > 0) {
      opItems.push(`<p class="detail flag-amber">Recurring issues: ${tk.recurringIssues.map(i => `${i.subject} (${i.count}x)`).join(", ")}</p>`);
    }
  }

  if (opItems.length > 0) {
    const opAllGood = opItems.every(i => i.includes("#16a34a") || i.includes("detail"));
    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Operational Readiness</h2>
        <span class="section-subtitle">Are day-to-day operations running smoothly?</span>
      </div>
      ${opItems.join("\n      ")}
    </div>`;
  }

  // === CAPACITY SURPRISES ===
  const capItems: string[] = [];

  if (data.deviceHealth) {
    const dh = data.deviceHealth;
    const tc = dh.deviceTypeCounts;
    const typeBreakdown = tc ? [
      tc.windowsLaptops > 0 ? `${tc.windowsLaptops} Win Laptops` : "",
      tc.windowsDesktops > 0 ? `${tc.windowsDesktops} Win Desktops` : "",
      tc.macLaptops > 0 ? `${tc.macLaptops} Mac Laptops` : "",
      tc.macDesktops > 0 ? `${tc.macDesktops} Mac Desktops` : "",
      tc.windowsServers > 0 ? `${tc.windowsServers} Servers` : "",
    ].filter(Boolean).join(" | ") : "";

    capItems.push(`<p class="detail"><strong>${dh.totalDevices} devices</strong> under management (${dh.workstations} workstations, ${dh.servers} servers)${trendArrow(dh.totalDevices, prev?.totalDevices, true)}</p>`);
    if (typeBreakdown) {
      capItems.push(`<p class="detail" style="font-size:12px;color:#6b7280">${typeBreakdown}</p>`);
    }

    const noReplacements = dh.needsReplacementCount === 0;
    capItems.push(`<div class="check-item">${statusIndicator(noReplacements, "No devices flagged for replacement", `${dh.needsReplacementCount} device(s) approaching or past end of life`)}</div>`);
    if (dh.oldDevices.length > 0) {
      capItems.push(`<p class="detail flag-red">Aging hardware: ${dh.oldDevices.map(d => `${d.systemName} (${d.deviceType}, ${d.age}yr)`).join(", ")}</p>`);
    }

    const noEol = dh.eolOsDevices.length === 0;
    capItems.push(`<div class="check-item">${statusIndicator(noEol, "All devices on supported operating systems", `${dh.eolOsDevices.length} device(s) running unsupported OS`)}</div>`);
    if (dh.eolOsDevices.length > 0) {
      capItems.push(`<p class="detail flag-amber">Unsupported OS: ${dh.eolOsDevices.map(d => `${d.systemName} (${d.osName})`).join(", ")}</p>`);
    }

    const patchGood = dh.patchCompliancePercent >= 90;
    capItems.push(`<div class="check-item">${statusIndicator(patchGood, `Patch compliance at ${dh.patchCompliancePercent}%`, `Patch compliance at ${dh.patchCompliancePercent}% \u2014 ${dh.pendingPatchCount} patches pending 30+ days`)}</div>`);

    if (dh.staleDevices && dh.staleDevices.length > 0) {
      capItems.push(`<div class="check-item">${statusIndicator(false, "", `${dh.staleDevices.length} device(s) inactive for 30+ days (possibly decommissioned)`)}</div>`);
      capItems.push(`<p class="detail flag-amber">${dh.staleDevices.map(d => `${d.systemName} (${d.daysSinceContact} days)`).join(", ")}</p>`);
    }
  }

  if (capItems.length > 0) {
    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Capacity Planning</h2>
        <span class="section-subtitle">Is the infrastructure prepared for what's ahead?</span>
      </div>
      ${capItems.join("\n      ")}
    </div>`;
  }

  // === FINANCIAL SURPRISES ===
  const finItems: string[] = [];

  if (data.licenseReport) {
    const lic = data.licenseReport;
    const noWaste = lic.totalWasted === 0;
    if (lic.totalMonthlyWaste > 0) {
      finItems.push(`<div class="check-item">${statusIndicator(false, "", `${lic.totalWasted} unused license(s) detected \u2014 $${lic.totalMonthlyWaste.toFixed(2)}/mo ($${lic.totalAnnualWaste.toFixed(2)}/yr) in potential savings`)}</div>`);
    } else if (lic.totalWasted > 0) {
      finItems.push(`<div class="check-item">${statusIndicator(false, "", `${lic.totalWasted} unused license(s) detected (pricing not available for all SKUs)`)}</div>`);
    } else {
      finItems.push(`<div class="check-item">${statusIndicator(true, "All licenses fully utilized \u2014 no waste detected", "")}</div>`);
    }

    if (prev?.licenseMonthlyWaste !== null && prev?.licenseMonthlyWaste !== undefined && lic.totalMonthlyWaste > 0) {
      const wasteDiff = lic.totalMonthlyWaste - prev.licenseMonthlyWaste;
      if (Math.abs(wasteDiff) > 1) {
        const improved = wasteDiff < 0;
        finItems.push(`<p class="detail" style="color:${improved ? "#16a34a" : "#d97706"}">License waste ${improved ? "decreased" : "increased"} by $${Math.abs(wasteDiff).toFixed(2)}/mo since last review</p>`);
      }
    }

    finItems.push(`
      <table>
        <tr><th>License</th><th>MSRP/mo</th><th>In Use</th><th>Total</th><th>Unused</th><th>Waste/mo</th></tr>
        ${lic.licenses.map(l => `<tr><td>${l.licenseName}</td><td>${l.monthlyPricePerLicense > 0 ? "$" + l.monthlyPricePerLicense.toFixed(2) : "\u2014"}</td><td>${l.quantityUsed}</td><td>${l.totalLicenses}</td><td${l.wasted > 0 ? ' style="color:#dc2626;font-weight:600"' : ""}>${l.wasted}</td><td${l.monthlyWastedCost > 0 ? ' style="color:#dc2626;font-weight:600"' : ""}>${l.monthlyWastedCost > 0 ? "$" + l.monthlyWastedCost.toFixed(2) : "\u2014"}</td></tr>`).join("")}
      </table>`);
  }

  if (finItems.length > 0) {
    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Financial Efficiency</h2>
        <span class="section-subtitle">Are technology investments being used wisely?</span>
      </div>
      ${finItems.join("\n      ")}
    </div>`;
  }

  // === PRIORITY ROADMAP ===
  if (data.roadmap && data.roadmap.items.length > 0) {
    const priorityLabels: Record<string, string> = { urgent: "Urgent", plan_for: "Plan For", nice_to_have: "Nice to Have" };
    const priorityColors: Record<string, string> = { urgent: "#dc2626", plan_for: "#2563eb", nice_to_have: "#6b7280" };

    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Recommended Actions</h2>
        <span class="section-subtitle">Prioritized next steps to keep your environment healthy</span>
      </div>
      ${data.roadmap.items.map(item => `
        <div class="roadmap-item">
          <div class="roadmap-header">
            <strong>${item.title}</strong>
            <span class="priority-badge" style="background:${priorityColors[item.priority]};color:white;padding:2px 8px;border-radius:4px;font-size:11px">${priorityLabels[item.priority]}</span>
          </div>
          <p>${item.issue}</p>
          <p class="business-impact"><em>${item.businessImpact}</em></p>
        </div>`).join("")}
    </div>`;
  }

  // === TREND COMPARISON ===
  if (prev && prevDate) {
    const trendRows: string[] = [];

    const addRow = (label: string, current: number | null | undefined, previous: number | null | undefined, higherIsBetter: boolean, format?: (v: number) => string) => {
      if (current === null || current === undefined || previous === null || previous === undefined) return;
      const diff = current - previous;
      const fmt = format || ((v: number) => v.toString());
      const improved = higherIsBetter ? diff > 0 : diff < 0;
      const noChange = diff === 0;
      const color = noChange ? "#6b7280" : improved ? "#16a34a" : "#dc2626";
      const icon = noChange ? "\u2014" : improved ? "&#9650;" : "&#9660;";
      trendRows.push(`<tr><td>${label}</td><td>${fmt(previous)}</td><td>${fmt(current)}</td><td style="color:${color};font-weight:600">${icon} ${diff > 0 ? "+" : ""}${fmt(diff)}</td></tr>`);
    };

    addRow("Total Devices", data.deviceHealth?.totalDevices, prev.totalDevices, true);
    addRow("Needs Replacement", data.deviceHealth?.needsReplacementCount, prev.needsReplacementCount, false);
    addRow("Patch Compliance", data.deviceHealth?.patchCompliancePercent, prev.patchCompliancePercent, true, v => `${Math.round(v)}%`);
    addRow("Security Incidents (6mo)", data.security?.totalIncidents, prev.totalIncidents, false);
    addRow("Pending Incidents", data.security?.pendingIncidents, prev.pendingIncidents, false);
    addRow("Protected Devices", data.security?.activeAgents, prev.activeAgents, true);
    addRow("Support Requests (6mo)", data.tickets?.totalTickets, prev.totalTickets, false);
    if (data.mfaReport) {
      const currentPct = data.mfaReport.totalUsers > 0 ? Math.round((data.mfaReport.coveredCount / data.mfaReport.totalUsers) * 100) : null;
      addRow("MFA Coverage", currentPct, prev.mfaCoveragePercent, true, v => `${Math.round(v)}%`);
    }
    if (data.licenseReport) {
      addRow("Monthly License Waste", data.licenseReport.totalMonthlyWaste, prev.licenseMonthlyWaste, false, v => `$${Math.abs(v).toFixed(2)}`);
    }

    if (trendRows.length > 0) {
      sections += `
      <div class="section">
        <div class="section-header">
          <h2>Progress Since Last Review</h2>
          <span class="section-subtitle">Comparing to ${prevDate}</span>
        </div>
        <table>
          <tr><th>Metric</th><th>Previous</th><th>Current</th><th>Change</th></tr>
          ${trendRows.join("")}
        </table>
      </div>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <title>Technology Business Review \u2014 ${data.clientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #394442; max-width: 800px; margin: 0 auto; padding: 40px 24px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #E77125; }
    .header .logo { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .header .logo-mark { width: 36px; height: 36px; object-fit: contain; }
    .header .logo-text { font-size: 16px; font-weight: 600; color: #394442; }
    .header h1 { font-size: 22px; color: #E77125; margin-bottom: 4px; }
    .header .client { font-size: 20px; font-weight: 600; }
    .header .date { color: #6b7280; font-size: 14px; margin-top: 4px; }
    .header .tagline { color: #6b7280; font-size: 13px; margin-top: 8px; font-style: italic; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section-header { margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .section-header h2 { font-size: 16px; color: #E77125; margin-bottom: 2px; }
    .section-header .section-subtitle { font-size: 12px; color: #6b7280; }
    .check-item { margin: 8px 0; font-size: 14px; }
    .detail { font-size: 13px; margin: 4px 0 4px 20px; color: #4b5563; }
    .flag-red { color: #dc2626; }
    .flag-amber { color: #d97706; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { padding: 6px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .roadmap-item { padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; }
    .roadmap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px; flex-wrap: wrap; }
    .roadmap-item p { font-size: 13px; margin-top: 4px; }
    .business-impact { color: #6b7280; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; }
    @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <img class="logo-mark" src="data:image/png;base64,${PELYCON_LOGO_B64}" alt="Pelycon" />
      <span class="logo-text">Pelycon Technologies</span>
    </div>
    <h1>Technology Business Review</h1>
    <div class="client">${data.clientName}</div>
    <div class="date">${today}</div>
    <div class="tagline">Your technology. No surprises.</div>
  </div>
  ${sections}
  <div class="footer">
    <p>Next Technology Business Review: <strong>${nextTbrStr}</strong></p>
    <p style="margin-top:8px;font-size:11px">Prepared by Pelycon Technologies &middot; Confidential</p>
  </div>
</body>
</html>`;
}
