import type {
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  RoadmapAnalysis,
  TbrSnapshot,
} from "@shared/schema";

const PELYCON_LOGO_B64 = "iVBORw0KGgoAAAANSUhEUgAAAEgAAAA/CAMAAAB0FH4MAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAIcUExUReZxJQAAAAMBAAsFAuZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJeZxJf///7D6kXUAAACydFJOUwAAAADq/vnr0qt3PhHuxX4wA+meOAGMHc1J7W8F+IMI+4QGcErOHo4C7DqgBDKAxxLx/e9A8JdLMTZbpXlcRbbi5q2CCiAlJiQ839PaH1Dzn894C6Jx/In2vwx09FHLzLSkmmQzFeF94xllybAPuK4sDRhEitTDED3GZllVbIjW9X+TNL7oqSJG91LR5V2Zc15iqDnyIeDkwIEHuvq73GcJlCgTNd6sI9kcxLycphTbK3tCS2V9AAAAAWJLR0Sz2m3/fgAAAAd0SU1FB+oCCxADMikW5xYAAAMkelRYdFJhdyBwcm9maWxlIHR5cGUgeG1wAABIiZVVSRLbIBC844o8AWYDniNruaUqxzw/3eBddlKxLFsMzHTPqvT756/0A5+SiyZd9ait5iihcQmvJjkkPGr02HUT2Y/L5XKIQN7DKPGqbptm22o2xdkWPVmrS4Wia11sdwv8w6AqlET00F2yrrXpUltAMTaCRZHMdayxV+VeIgLYWBzkocvcuB8fTB5mILtQw+4akr3Z5jkJyR11iLTLrlk28Mm8IKmUQako7woohyshK/ZEeYscWrQk/HGxYQEm6thccFfJb5dcnRSYDV1czCweDqbh4dykk60aLhiDU0cdH9krDoEXedeB33nhKQ8+g0iaRmSrWpElxqU2OIdIcf+VBSggYUiHRB/x6ogTTnA/8QCCLcBDeMlqhvc5IwyzbUj4ifMA3JmsdI39jio6YoM7DZwyHRiBh4zSk3Gt5qy2e0DSJ+v/Ms56rHAOZw6ag7tHgkMCBZ/2GZdPjv3NqQmbvuO+m4SKfshsHlTW9EgrD+LXoeisbOYQqNNweRi+Bn4x6vXZk1FSrEZyWu/K1m1kD0g+2hRlCgnruKF+RA2/amKBkhRWNdYlqVnBAcci47hCzOpueGwnDt8gcSYhKuylgWxsE8cdhmEwKxjIxCxGVg1gDmgEy/glAd6YPQm0ywmZNa6s8mAq/Bl5APczcAJy/h/kV2AYY8M4gg1cRN/p/RHr+6wBtzVWhB02oFDm6TFC0MwouiyYRpyuKWarolqjSb+36WuIfbRpABkLPLPu8lObLBi1X6LxlHqgNwRAWcWKOTEKkxOLA9BZDJhmPWE2F4xU0M...";

function trendBadge(current: number, previous: number | null | undefined, higherIsBetter: boolean): string {
  if (previous === null || previous === undefined) return "";
  const diff = current - previous;
  if (diff === 0) return "";
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  const color = improved ? "#16a34a" : "#dc2626";
  const bg = improved ? "#f0fdf4" : "#fef2f2";
  const arrow = improved ? "&#9650;" : "&#9660;";
  const sign = diff > 0 ? "+" : "";
  const val = typeof current === "number" && current % 1 !== 0 ? diff.toFixed(1) : diff.toString();
  return ` <span style="display:inline-block;font-size:10px;color:${color};background:${bg};padding:1px 6px;border-radius:3px;margin-left:4px;vertical-align:middle">${arrow} ${sign}${val}</span>`;
}

function trendPctBadge(current: number | null | undefined, previous: number | null | undefined, higherIsBetter: boolean): string {
  if (current === null || current === undefined || previous === null || previous === undefined) return "";
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return "";
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  const color = improved ? "#16a34a" : "#dc2626";
  const bg = improved ? "#f0fdf4" : "#fef2f2";
  const arrow = improved ? "&#9650;" : "&#9660;";
  const sign = diff > 0 ? "+" : "";
  return ` <span style="display:inline-block;font-size:10px;color:${color};background:${bg};padding:1px 6px;border-radius:3px;margin-left:4px;vertical-align:middle">${arrow} ${sign}${Math.round(diff)}%</span>`;
}

function goodBad(isGood: boolean, goodText: string, badText: string): string {
  if (isGood) {
    return `<div class="item good"><span class="icon">&#10003;</span> ${goodText}</div>`;
  }
  return `<div class="item attention"><span class="icon">&#9888;</span> ${badText}</div>`;
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
    year: "numeric",
  });

  const prev = data.previousSnapshot;

  let sections = "";

  // === EXECUTIVE SNAPSHOT (quick status-at-a-glance) ===
  const snapItems: { label: string; value: string; status: "good" | "warn" | "neutral" }[] = [];

  if (data.security) {
    snapItems.push({
      label: "Security Incidents",
      value: data.security.pendingIncidents === 0 ? "None pending" : `${data.security.pendingIncidents} pending`,
      status: data.security.pendingIncidents === 0 ? "good" : "warn",
    });
  }
  if (data.mfaReport) {
    const pct = data.mfaReport.totalUsers > 0 ? Math.round((data.mfaReport.coveredCount / data.mfaReport.totalUsers) * 100) : 100;
    snapItems.push({
      label: "MFA Coverage",
      value: `${pct}%`,
      status: pct >= 100 ? "good" : "warn",
    });
  }
  if (data.deviceHealth) {
    snapItems.push({
      label: "Patch Compliance",
      value: `${data.deviceHealth.patchCompliancePercent}%`,
      status: data.deviceHealth.patchCompliancePercent >= 90 ? "good" : "warn",
    });
    snapItems.push({
      label: "Devices Needing Replacement",
      value: data.deviceHealth.needsReplacementCount === 0 ? "None" : `${data.deviceHealth.needsReplacementCount}`,
      status: data.deviceHealth.needsReplacementCount === 0 ? "good" : "warn",
    });
  }
  if (data.tickets) {
    snapItems.push({
      label: "Lingering Tickets (30+ days)",
      value: data.tickets.oldOpenTickets.length === 0 ? "None" : `${data.tickets.oldOpenTickets.length}`,
      status: data.tickets.oldOpenTickets.length === 0 ? "good" : "warn",
    });
  }

  if (snapItems.length > 0) {
    const statusColors = { good: "#16a34a", warn: "#dc2626", neutral: "#6b7280" };
    const statusBg = { good: "#f0fdf4", warn: "#fef2f2", neutral: "#f9fafb" };
    sections += `
    <div class="snapshot-grid">
      ${snapItems.map(s => `
        <div class="snap-card" style="border-left:3px solid ${statusColors[s.status]};background:${statusBg[s.status]}">
          <div class="snap-label">${s.label}</div>
          <div class="snap-value" style="color:${statusColors[s.status]}">${s.value}</div>
        </div>`).join("")}
    </div>`;
  }

  // === SECTION 1: OPERATIONAL READINESS ===
  const opItems: string[] = [];

  if (data.security) {
    const sec = data.security;
    opItems.push(goodBad(sec.pendingIncidents === 0,
      `No unresolved security incidents`,
      `${sec.pendingIncidents} security incident(s) need attention`));

    if (sec.totalIncidents > 0) {
      opItems.push(`<div class="sub">${sec.totalIncidents} incident(s) detected in 6 months, ${sec.resolvedIncidents} resolved${trendBadge(sec.totalIncidents, prev?.totalIncidents, false)}</div>`);
    }

    if (sec.managedAntivirusCount > 0 || sec.antivirusNotProtectedCount > 0) {
      opItems.push(goodBad(sec.antivirusNotProtectedCount === 0,
        `All devices have managed antivirus`,
        `${sec.antivirusNotProtectedCount} device(s) lack antivirus protection`));
    }

    if (sec.satLearnerCount !== null) {
      const satGap = sec.satTotalUsers ? sec.satTotalUsers - sec.satLearnerCount : 0;
      opItems.push(goodBad(satGap === 0,
        `All users enrolled in security awareness training`,
        `${satGap} user(s) not enrolled in security training`));
    }

    if (sec.phishingClickRate !== null) {
      opItems.push(goodBad(sec.phishingClickRate <= 5,
        `Phishing click rate: ${sec.phishingClickRate}% (below industry avg)`,
        `Phishing click rate: ${sec.phishingClickRate}% (target: under 5%)`));
    }
  }

  if (data.mfaReport) {
    const mfa = data.mfaReport;
    const coveragePct = mfa.totalUsers > 0 ? Math.round((mfa.coveredCount / mfa.totalUsers) * 100) : 100;
    opItems.push(goodBad(mfa.uncoveredCount === 0,
      `100% MFA coverage (${mfa.totalUsers} users)`,
      `${mfa.uncoveredCount} user(s) without MFA (${coveragePct}% covered)${trendPctBadge(coveragePct, prev?.mfaCoveragePercent, true)}`));
    if (mfa.uncoveredCount > 0 && mfa.uncoveredUsers.length > 0) {
      opItems.push(`<div class="sub callout-red">${mfa.uncoveredUsers.map(u => u.displayName).join(", ")}</div>`);
    }
  }

  if (data.tickets) {
    const tk = data.tickets;
    opItems.push(goodBad(tk.oldOpenTickets.length === 0,
      `No lingering support requests`,
      `${tk.oldOpenTickets.length} request(s) open 30+ days`));
    opItems.push(`<div class="sub">${tk.totalTickets} total requests in 6 months${trendBadge(tk.totalTickets, prev?.totalTickets, false)}</div>`);
  }

  if (opItems.length > 0) {
    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Operational Readiness</h2>
        <span class="subtitle">Are day-to-day operations running smoothly?</span>
      </div>
      ${opItems.join("\n")}
    </div>`;
  }

  // === SECTION 2: CAPACITY & INFRASTRUCTURE ===
  const capItems: string[] = [];

  if (data.deviceHealth) {
    const dh = data.deviceHealth;
    const tc = dh.deviceTypeCounts;
    const breakdown = tc ? [
      tc.windowsLaptops > 0 ? `${tc.windowsLaptops} Win Laptop` : "",
      tc.windowsDesktops > 0 ? `${tc.windowsDesktops} Win Desktop` : "",
      tc.macLaptops > 0 ? `${tc.macLaptops} Mac` : "",
      tc.windowsServers > 0 ? `${tc.windowsServers} Server` : "",
    ].filter(Boolean).join(", ") : "";

    capItems.push(`<div class="sub"><strong>${dh.totalDevices} devices</strong> managed${breakdown ? ` (${breakdown})` : ""}${trendBadge(dh.totalDevices, prev?.totalDevices, true)}</div>`);

    capItems.push(goodBad(dh.needsReplacementCount === 0,
      `No hardware flagged for replacement`,
      `${dh.needsReplacementCount} device(s) aging out or past end of life`));

    if (dh.oldDevices.length > 0) {
      capItems.push(`<div class="sub callout-red">${dh.oldDevices.map(d => `${d.systemName} (${d.ageSource === "model" ? "~" : ""}${d.age}yr)`).join(", ")}</div>`);
    }

    capItems.push(goodBad(dh.eolOsDevices.length === 0,
      `All devices on supported operating systems`,
      `${dh.eolOsDevices.length} device(s) running unsupported OS`));

    if (dh.eolOsDevices.length > 0) {
      capItems.push(`<div class="sub callout-amber">${dh.eolOsDevices.map(d => `${d.systemName} (${d.osName})`).join(", ")}</div>`);
    }

    capItems.push(goodBad(dh.patchCompliancePercent >= 90,
      `Patch compliance at ${dh.patchCompliancePercent}%`,
      `Patch compliance at ${dh.patchCompliancePercent}% \u2014 ${dh.pendingPatchCount} patches pending 30+ days`));

    if (dh.staleDevices && dh.staleDevices.length > 0) {
      capItems.push(goodBad(false, "", `${dh.staleDevices.length} device(s) inactive 30+ days`));
    }
  }

  if (capItems.length > 0) {
    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Infrastructure & Capacity</h2>
        <span class="subtitle">Is the hardware ready for what's ahead?</span>
      </div>
      ${capItems.join("\n")}
    </div>`;
  }

  // === SECTION 3: FINANCIAL EFFICIENCY ===
  const finItems: string[] = [];

  if (data.licenseReport) {
    const lic = data.licenseReport;
    if (lic.totalWasted === 0) {
      finItems.push(goodBad(true, `All licenses fully utilized`, ""));
    } else if (lic.totalMonthlyWaste > 0) {
      finItems.push(goodBad(false, "", `${lic.totalWasted} unused license(s) \u2014 $${lic.totalMonthlyWaste.toFixed(0)}/mo in potential savings`));
    } else {
      finItems.push(goodBad(false, "", `${lic.totalWasted} unused license(s) detected`));
    }

    const wastefulLicenses = lic.licenses.filter(l => l.wasted > 0);
    if (wastefulLicenses.length > 0) {
      finItems.push(`
      <table>
        <tr><th>License</th><th>In Use</th><th>Total</th><th>Unused</th><th>Savings/mo</th></tr>
        ${wastefulLicenses.map(l => `<tr><td>${l.licenseName}</td><td>${l.quantityUsed}</td><td>${l.totalLicenses}</td><td class="attention-text">${l.wasted}</td><td class="attention-text">${l.monthlyWastedCost > 0 ? "$" + l.monthlyWastedCost.toFixed(0) : "\u2014"}</td></tr>`).join("")}
      </table>`);
    }
  }

  if (finItems.length > 0) {
    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Financial Efficiency</h2>
        <span class="subtitle">Are technology investments being used wisely?</span>
      </div>
      ${finItems.join("\n")}
    </div>`;
  }

  // === SECTION 4: RECOMMENDED ACTIONS ===
  if (data.roadmap && data.roadmap.items.length > 0) {
    const priorityLabels: Record<string, string> = { urgent: "Act Now", plan_for: "Plan For", nice_to_have: "Consider" };
    const priorityColors: Record<string, string> = { urgent: "#dc2626", plan_for: "#2563eb", nice_to_have: "#6b7280" };
    const priorityBg: Record<string, string> = { urgent: "#fef2f2", plan_for: "#eff6ff", nice_to_have: "#f9fafb" };

    sections += `
    <div class="section">
      <div class="section-header">
        <h2>Recommended Next Steps</h2>
        <span class="subtitle">Prioritized actions to keep your environment healthy</span>
      </div>
      ${data.roadmap.items.map(item => `
        <div class="action-card" style="border-left:3px solid ${priorityColors[item.priority]};background:${priorityBg[item.priority]}">
          <div class="action-header">
            <strong>${item.title}</strong>
            <span class="priority-tag" style="color:${priorityColors[item.priority]}">${priorityLabels[item.priority]}</span>
          </div>
          <div class="action-why">${item.businessImpact}</div>
        </div>`).join("")}
    </div>`;
  }

  // === TREND COMPARISON ===
  if (prev) {
    const prevDate = new Date(prev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const trendRows: string[] = [];

    const addRow = (label: string, current: number | null | undefined, previous: number | null | undefined, higherIsBetter: boolean, format?: (v: number) => string) => {
      if (current === null || current === undefined || previous === null || previous === undefined) return;
      const diff = current - previous;
      const fmt = format || ((v: number) => v.toString());
      const improved = higherIsBetter ? diff > 0 : diff < 0;
      const noChange = diff === 0;
      const color = noChange ? "#6b7280" : improved ? "#16a34a" : "#dc2626";
      const icon = noChange ? "=" : improved ? "&#9650;" : "&#9660;";
      trendRows.push(`<tr><td>${label}</td><td style="text-align:center">${fmt(previous)}</td><td style="text-align:center">${fmt(current)}</td><td style="text-align:center;color:${color};font-weight:600">${icon}</td></tr>`);
    };

    addRow("Devices Managed", data.deviceHealth?.totalDevices, prev.totalDevices, true);
    addRow("Needs Replacement", data.deviceHealth?.needsReplacementCount, prev.needsReplacementCount, false);
    addRow("Patch Compliance", data.deviceHealth?.patchCompliancePercent, prev.patchCompliancePercent, true, v => `${Math.round(v)}%`);
    addRow("Security Incidents", data.security?.totalIncidents, prev.totalIncidents, false);
    addRow("Protected Devices", data.security?.activeAgents, prev.activeAgents, true);
    addRow("Support Requests", data.tickets?.totalTickets, prev.totalTickets, false);
    if (data.mfaReport) {
      const currentPct = data.mfaReport.totalUsers > 0 ? Math.round((data.mfaReport.coveredCount / data.mfaReport.totalUsers) * 100) : null;
      addRow("MFA Coverage", currentPct, prev.mfaCoveragePercent, true, v => `${Math.round(v)}%`);
    }

    if (trendRows.length > 0) {
      sections += `
      <div class="section">
        <div class="section-header">
          <h2>Progress Since Last Review</h2>
          <span class="subtitle">Comparing to ${prevDate}</span>
        </div>
        <table class="trend-table">
          <tr><th>Metric</th><th style="text-align:center">Then</th><th style="text-align:center">Now</th><th style="text-align:center">Trend</th></tr>
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
    body { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; color: #394442; max-width: 780px; margin: 0 auto; padding: 36px 24px; line-height: 1.5; font-size: 13px; }

    .header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #E77125; }
    .header .logo { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .header .logo-mark { width: 32px; height: 32px; object-fit: contain; }
    .header .logo-text { font-size: 14px; font-weight: 600; color: #394442; }
    .header h1 { font-size: 20px; color: #E77125; margin-bottom: 2px; letter-spacing: -0.3px; }
    .header .client { font-size: 18px; font-weight: 600; }
    .header .date { color: #6b7280; font-size: 12px; margin-top: 2px; }
    .header .tagline { color: #6b7280; font-size: 11px; margin-top: 6px; font-style: italic; }

    .snapshot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 24px; }
    .snap-card { padding: 10px 12px; border-radius: 6px; }
    .snap-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 2px; }
    .snap-value { font-size: 16px; font-weight: 700; }

    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section-header { margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    .section-header h2 { font-size: 14px; color: #E77125; margin-bottom: 1px; }
    .section-header .subtitle { font-size: 11px; color: #6b7280; }

    .item { padding: 5px 0; font-size: 13px; display: flex; align-items: flex-start; gap: 6px; }
    .item .icon { flex-shrink: 0; font-size: 13px; line-height: 1.5; }
    .item.good .icon { color: #16a34a; }
    .item.attention .icon { color: #dc2626; }

    .sub { font-size: 12px; margin: 2px 0 2px 22px; color: #6b7280; }
    .callout-red { color: #dc2626; }
    .callout-amber { color: #d97706; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th, td { padding: 5px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
    .attention-text { color: #dc2626; font-weight: 600; }

    .action-card { padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; }
    .action-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
    .action-header strong { font-size: 13px; }
    .priority-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .action-why { font-size: 12px; color: #6b7280; }

    .trend-table th, .trend-table td { padding: 4px 10px; }

    .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; }
    @media print { body { padding: 16px; } .section { page-break-inside: avoid; } }
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
    <p>Next review: <strong>${nextTbrStr}</strong></p>
    <p style="margin-top:4px">Prepared by Pelycon Technologies &middot; Confidential</p>
  </div>
</body>
</html>`;
}
