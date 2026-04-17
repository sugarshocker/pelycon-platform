import type { MarginInsight, AgreementAdditionInfo } from "@shared/schema";

export function fmtD(val: number): string {
  return "$" + Math.round(val).toLocaleString();
}

export function generateMarginAnalysis(financials: any, engineers: any[]): MarginInsight[] {
  const insights: MarginInsight[] = [];
  const totalRev = financials.totalRevenue || 0;
  const laborCost = financials.laborCost || 0;
  const serviceLaborCost = financials.serviceLaborCost || 0;
  const projectLaborCost = financials.projectLaborCost || 0;
  const additionCost = financials.additionCost || 0;
  const projectProductCost = financials.projectProductCost || 0;
  const expenseCost = financials.expenseCost || 0;
  const msRev = financials.msLicensingRevenue || 0;
  const agreementRev = financials.agreementRevenue || 0;
  const projectRev = financials.projectRevenue || 0;
  const serviceHours = financials.serviceHours || 0;
  const projectHours = financials.projectHours || 0;
  const additions: AgreementAdditionInfo[] = financials.agreementAdditions || [];

  if (totalRev <= 0) return insights;

  const actionableAgrRev = agreementRev - msRev;
  const serviceMargin = actionableAgrRev > 0 ? ((actionableAgrRev - serviceLaborCost - additionCost) / actionableAgrRev) * 100 : 0;
  const projectMargin = projectRev > 0 ? ((projectRev - projectLaborCost - projectProductCost - expenseCost) / projectRev) * 100 : null;
  const actionableTotalRev = totalRev - msRev;
  const actionableTotalCost = laborCost + additionCost + projectProductCost + expenseCost;
  const overallMargin = actionableTotalRev > 0 ? ((actionableTotalRev - actionableTotalCost) / actionableTotalRev) * 100 : 0;

  if (actionableAgrRev > 0) {
    insights.push({
      type: serviceMargin < 50 ? "warning" : serviceMargin < 60 ? "suggestion" : "info",
      category: "labor",
      title: "Agreement Margin",
      detail: `Agreement revenue (excl. Microsoft): ${fmtD(actionableAgrRev)}/yr. Agreement labor: ${fmtD(serviceLaborCost)} (${serviceHours.toFixed(0)} hrs). Product costs: ${fmtD(additionCost)}. Agreement margin: ${serviceMargin.toFixed(1)}%.`,
      impact: serviceMargin < 50 ? `Agreement margin is below 50%. Review whether too many hours are being spent or if the agreement price needs adjusting.` : undefined,
    });
  }

  if (projectRev > 0 || projectLaborCost > 0) {
    if (projectRev > 0 && projectLaborCost > 0) {
      insights.push({
        type: projectMargin! < 50 ? "warning" : projectMargin! < 60 ? "suggestion" : "info",
        category: "project",
        title: "Project Margin",
        detail: `Project revenue: ${fmtD(projectRev)}. Project labor: ${fmtD(projectLaborCost)} (${projectHours.toFixed(0)} hrs)${projectProductCost > 0 ? `. Product costs: ${fmtD(projectProductCost)}` : ""}${expenseCost > 0 ? `. Expenses: ${fmtD(expenseCost)}` : ""}. Project margin: ${projectMargin!.toFixed(1)}%.`,
        impact: projectMargin! < 50 ? `Project work is below 50% margin. Check scoping, billing rates, and whether projects are being invoiced promptly.` : undefined,
      });
    } else if (projectLaborCost > 0 && projectRev === 0) {
      insights.push({
        type: "warning",
        category: "project",
        title: "Unbilled Project Work",
        detail: `${projectHours.toFixed(1)} project hours (${fmtD(projectLaborCost)} labor) with $0 project revenue. This eats directly into your overall margin.`,
      });
    }
  }

  if (msRev > 0) {
    insights.push({
      type: "info",
      category: "additions",
      title: "Microsoft Licensing (excluded from margin)",
      detail: `${fmtD(msRev)}/yr in Microsoft licensing at a fixed ~16% margin. Pass-through, excluded from actionable margin.`,
    });
  }

  const otherAdditions = additions.filter((a: any) => a.category === "other");
  const lowMarginOther = otherAdditions.filter((a: any) => a.margin < 20 && a.annualCost > 0);
  if (lowMarginOther.length > 0) {
    const names = lowMarginOther.slice(0, 3).map((a: any) => `${a.additionName} (${a.margin.toFixed(0)}%)`).join(", ");
    insights.push({
      type: "warning",
      category: "additions",
      title: "Low-Margin Third-Party Products",
      detail: `${names} — thin margins. Negotiate a better vendor rate or increase what you charge.`,
    });
  }

  if (engineers.length > 0 && laborCost > 0) {
    const topEng = engineers[0];
    const topPct = (topEng.totalCost / laborCost) * 100;
    if (topPct > 40 && topEng.hourlyCost >= 80) {
      const savingsEstimate = Math.round(topEng.totalHours * 0.3 * (topEng.hourlyCost - 40));
      insights.push({
        type: "suggestion",
        category: "labor",
        title: "Heavy Use of Expensive Engineer",
        detail: `${topEng.memberName} ($${topEng.hourlyCost}/hr) makes up ${topPct.toFixed(0)}% of total labor cost. Moving routine work to a cheaper engineer could save ~${fmtD(savingsEstimate)}/yr.`,
      });
    }
  }

  if (overallMargin < 43) {
    const gap = Math.round(actionableTotalRev * 0.52 - (actionableTotalRev - actionableTotalCost));
    insights.push({
      type: "warning",
      category: "overall",
      title: "Overall Margin Below 43%",
      detail: `Combined margin is ${overallMargin.toFixed(1)}% (excl. Microsoft). Close a ${fmtD(gap)}/yr gap to reach 52% — price increases, fewer hours, or cheaper staffing.`,
    });
  } else if (overallMargin < 52) {
    const gap = Math.round(actionableTotalRev * 0.52 - (actionableTotalRev - actionableTotalCost));
    insights.push({
      type: "suggestion",
      category: "overall",
      title: "Overall Margin Below 52% Target",
      detail: `Combined margin is ${overallMargin.toFixed(1)}%. Closing a ${fmtD(gap)}/yr gap would get you to 52%.`,
    });
  }

  return insights;
}
