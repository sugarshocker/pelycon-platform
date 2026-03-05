import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { ClientAccountWithStatus, AgreementAdditionInfo, MarginInsight } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Loader2,
  Building2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  ArrowUpDown,
  Users,
  Lightbulb,
  Package,
  TriangleAlert,
  Info,
} from "lucide-react";

type SortField = "companyName" | "effectiveTier" | "totalRevenue" | "tbrStatus" | "agreementRevenue" | "projectRevenue" | "grossMarginPercent" | "laborCost" | "totalHours";
type SortDir = "asc" | "desc";
type BreakdownTab = "overview" | "engineers" | "additions" | "analysis";

interface EngineerEntry {
  memberId: number;
  memberName: string;
  memberIdentifier: string;
  serviceHours: number;
  projectHours: number;
  totalHours: number;
  hourlyCost: number;
  totalCost: number;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}h`;
}

function StatusBadge({ status, reason }: { status: string; reason: string }) {
  const config = {
    green: { icon: CheckCircle2, label: "On Track", className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" },
    yellow: { icon: Clock, label: "Attention", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
    red: { icon: XCircle, label: "Needs TBR", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
  }[status] || { icon: AlertCircle, label: "Unknown", className: "" };

  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`${config.className} cursor-help gap-1 text-xs`} data-testid={`badge-tbr-status-${status}`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <p className="text-xs">{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const className = {
    A: "bg-primary/15 text-primary border-primary/30",
    B: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    C: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
  }[tier] || "";

  return (
    <Badge variant="outline" className={`${className} text-xs font-semibold`} data-testid={`badge-tier-${tier}`}>
      Tier {tier}
    </Badge>
  );
}

function MarginBadge({ margin }: { margin: number | null | undefined }) {
  if (margin === null || margin === undefined) return <span className="text-muted-foreground">—</span>;
  const color = margin >= 70 ? "text-green-600 dark:text-green-400"
    : margin >= 55 ? "text-yellow-600 dark:text-yellow-400"
    : margin >= 0 ? "text-orange-600 dark:text-orange-400"
    : "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${color}`}>{margin.toFixed(1)}%</span>;
}

function InsightIcon({ type }: { type: string }) {
  if (type === "warning") return <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
  if (type === "suggestion") return <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
  return <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
}

function EngineerBreakdownDialog({
  open,
  onOpenChange,
  account,
  includeMs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ClientAccountWithStatus | null;
  includeMs: boolean;
}) {
  const [tab, setTab] = useState<BreakdownTab>("overview");

  if (!account) return null;

  const engineers: EngineerEntry[] = (account.engineerBreakdown as EngineerEntry[] | null) || [];
  const additions: AgreementAdditionInfo[] = (account.agreementAdditions as AgreementAdditionInfo[] | null) || [];
  const insights: MarginInsight[] = (account.marginAnalysis as MarginInsight[] | null) || [];
  const hasEngineers = engineers.length > 0;
  const rawTotalRev = account.totalRevenue || 0;
  const laborCost = account.laborCost || 0;
  const serviceLaborCost = (account as any).serviceLaborCost || 0;
  const projectLaborCost = (account as any).projectLaborCost || 0;
  const additionCost = account.additionCost || 0;
  const projectProductCost = (account as any).projectProductCost || 0;
  const expenseCost = (account as any).expenseCost || 0;
  const msLicensingRevenue = (account as any).msLicensingRevenue || 0;
  const msLicensingCost = (account as any).msLicensingCost || 0;
  const rawTotalCost = account.totalCost || 0;
  const agreementRev = account.agreementRevenue || 0;
  const projectRev = account.projectRevenue || 0;

  const totalRev = includeMs ? rawTotalRev : rawTotalRev - msLicensingRevenue;
  const totalCost = includeMs ? rawTotalCost : rawTotalCost - msLicensingCost;
  const effectiveAgrRev = includeMs ? agreementRev : agreementRev - msLicensingRevenue;
  const effectiveAdditionCost = includeMs ? additionCost + msLicensingCost : additionCost;

  const serviceMargin = effectiveAgrRev > 0 ? ((effectiveAgrRev - serviceLaborCost - effectiveAdditionCost) / effectiveAgrRev) * 100 : null;
  const projectMargin = projectRev > 0 ? ((projectRev - projectLaborCost - projectProductCost - expenseCost) / projectRev) * 100 : null;
  const overallMargin = totalRev > 0 ? ((totalRev - (laborCost + effectiveAdditionCost + projectProductCost + expenseCost)) / totalRev) * 100 : null;
  const warningCount = insights.filter(i => i.type === "warning").length;
  const suggestionCount = insights.filter(i => i.type === "suggestion").length;

  const tabs: { key: BreakdownTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "engineers", label: "Engineers", count: engineers.length },
    { key: "additions", label: "Additions", count: additions.length },
    { key: "analysis", label: "Analysis", count: warningCount + suggestionCount },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTab("overview"); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-breakdown-title">
            <Users className="h-5 w-5" />
            {account.companyName} — Cost & Margin Breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b mb-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${t.key === "analysis" && warningCount > 0 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Service Agreement (12 months)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Agreement Revenue</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-agr-rev">{formatCurrency(effectiveAgrRev)}</div>
                {!includeMs && msLicensingRevenue > 0 && <div className="text-[10px] text-muted-foreground">Excl. {formatCurrency(msLicensingRevenue)} MS</div>}
                {includeMs && msLicensingRevenue > 0 && <div className="text-[10px] text-muted-foreground">Incl. {formatCurrency(msLicensingRevenue)} MS</div>}
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Service Labor</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-svc-labor">{formatCurrency(serviceLaborCost)}</div>
                <div className="text-[10px] text-muted-foreground">{(account.serviceHours || 0).toFixed(0)} hrs</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Product Costs</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-additions">{formatCurrency(effectiveAdditionCost)}</div>
                {includeMs && msLicensingCost > 0 && <div className="text-[10px] text-muted-foreground">Incl. {formatCurrency(msLicensingCost)} MS</div>}
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Service Margin</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-svc-margin">
                  <MarginBadge margin={serviceMargin} />
                </div>
                {!includeMs && msLicensingRevenue > 0 && <div className="text-[10px] text-muted-foreground">Excl. Microsoft</div>}
              </div>
            </div>

            {(projectRev > 0 || projectLaborCost > 0) && (
              <>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Project Work (12 months)</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">Project Revenue</div>
                    <div className="text-sm font-semibold" data-testid="text-breakdown-proj-rev">{formatCurrency(projectRev)}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">Project Labor</div>
                    <div className="text-sm font-semibold" data-testid="text-breakdown-proj-labor">{formatCurrency(projectLaborCost)}</div>
                    <div className="text-[10px] text-muted-foreground">{(account.projectHours || 0).toFixed(0)} hrs</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">Project Margin</div>
                    <div className="text-sm font-semibold" data-testid="text-breakdown-proj-margin">
                      <MarginBadge margin={projectMargin} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Combined (12 months)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Total Revenue</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-revenue">{formatCurrency(totalRev)}</div>
                {!includeMs && msLicensingRevenue > 0 && <div className="text-[10px] text-muted-foreground">Excl. {formatCurrency(msLicensingRevenue)} MS</div>}
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Total Labor</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-labor">{formatCurrency(laborCost)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Total Cost</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-total-cost">{formatCurrency(totalCost)}</div>
                {!includeMs && msLicensingCost > 0 && <div className="text-[10px] text-muted-foreground">Excl. {formatCurrency(msLicensingCost)} MS</div>}
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Overall Margin</div>
                <div className="text-sm font-semibold" data-testid="text-breakdown-margin">
                  <MarginBadge margin={overallMargin} />
                </div>
                {!includeMs && msLicensingRevenue > 0 && <div className="text-[10px] text-muted-foreground">Excl. Microsoft</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Total Hours</div>
                <div className="text-sm font-medium" data-testid="text-breakdown-hours">{formatHours(account.totalHours)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Service Hours</div>
                <div className="text-sm font-medium">{formatHours(account.serviceHours)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Project Hours</div>
                <div className="text-sm font-medium">{formatHours(account.projectHours)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Rev/Hour</div>
                <div className="text-sm font-medium">
                  {account.totalHours && account.totalHours > 0 ? `$${(totalRev / account.totalHours).toFixed(0)}/hr` : "—"}
                </div>
              </div>
            </div>

            {totalCost > 0 && (
              <div className="border rounded-lg p-3 mb-4">
                <div className="text-xs text-muted-foreground mb-2">Cost Breakdown</div>
                <div className="flex gap-1 h-4 rounded overflow-hidden">
                  {laborCost > 0 && (
                    <div
                      className="bg-blue-500 rounded-sm"
                      style={{ width: `${(laborCost / totalCost) * 100}%` }}
                      title={`Labor: ${formatCurrency(laborCost)}`}
                    />
                  )}
                  {additionCost > 0 && (
                    <div
                      className="bg-orange-500 rounded-sm"
                      style={{ width: `${(additionCost / totalCost) * 100}%` }}
                      title={`Agr. Products: ${formatCurrency(additionCost)}`}
                    />
                  )}
                  {projectProductCost > 0 && (
                    <div
                      className="bg-amber-500 rounded-sm"
                      style={{ width: `${(projectProductCost / totalCost) * 100}%` }}
                      title={`Project Products: ${formatCurrency(projectProductCost)}`}
                    />
                  )}
                  {expenseCost > 0 && (
                    <div
                      className="bg-rose-400 rounded-sm"
                      style={{ width: `${(expenseCost / totalCost) * 100}%` }}
                      title={`Expenses: ${formatCurrency(expenseCost)}`}
                    />
                  )}
                  {msLicensingCost > 0 && (
                    <div
                      className="bg-purple-400 rounded-sm"
                      style={{ width: `${(msLicensingCost / totalCost) * 100}%` }}
                      title={`Microsoft: ${formatCurrency(msLicensingCost)}`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                    Labor: {formatCurrency(laborCost)} ({totalCost > 0 ? ((laborCost / totalCost) * 100).toFixed(0) : 0}%)
                  </span>
                  {additionCost > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                      Agr. Products: {formatCurrency(additionCost)} ({((additionCost / totalCost) * 100).toFixed(0)}%)
                    </span>
                  )}
                  {projectProductCost > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                      Project Products: {formatCurrency(projectProductCost)} ({((projectProductCost / totalCost) * 100).toFixed(0)}%)
                    </span>
                  )}
                  {expenseCost > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
                      Expenses: {formatCurrency(expenseCost)} ({((expenseCost / totalCost) * 100).toFixed(0)}%)
                    </span>
                  )}
                  {msLicensingCost > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
                      Microsoft: {formatCurrency(msLicensingCost)} ({((msLicensingCost / totalCost) * 100).toFixed(0)}%) <span className="italic text-muted-foreground">(pass-through)</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {insights.filter(i => i.type === "warning").length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  Key Concerns
                </div>
                {insights.filter(i => i.type === "warning").slice(0, 3).map((insight, idx) => (
                  <div key={idx} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <div className="text-sm font-medium text-amber-700 dark:text-amber-400">{insight.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insight.detail}</div>
                    {insight.impact && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">{insight.impact}</div>}
                  </div>
                ))}
                {insights.filter(i => i.type === "warning").length > 3 && (
                  <button onClick={() => setTab("analysis")} className="text-xs text-primary hover:underline" data-testid="link-see-all-analysis">
                    See all analysis...
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {tab === "engineers" && (
          <>
            {hasEngineers ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Engineer</TableHead>
                      <TableHead className="text-right">Service Hrs</TableHead>
                      <TableHead className="text-right">Project Hrs</TableHead>
                      <TableHead className="text-right">Total Hrs</TableHead>
                      <TableHead className="text-right">Hourly Cost</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="text-right">% of Labor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engineers.map((eng, idx) => (
                      <TableRow key={eng.memberId} data-testid={`row-engineer-${idx}`}>
                        <TableCell className="text-sm font-medium" data-testid={`text-engineer-name-${idx}`}>
                          {eng.memberName}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {eng.serviceHours > 0 ? eng.serviceHours.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {eng.projectHours > 0 ? eng.projectHours.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right font-medium">
                          {eng.totalHours.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {eng.hourlyCost > 0 ? `$${eng.hourlyCost.toFixed(0)}/hr` : (
                            <span className="text-muted-foreground italic">not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right font-medium">
                          {eng.totalCost > 0 ? formatCurrency(eng.totalCost) : "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {laborCost > 0 && eng.totalCost > 0
                            ? `${((eng.totalCost / laborCost) * 100).toFixed(0)}%`
                            : "—"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No time entries found for this client in the last 12 months.
                <br />
                <span className="text-xs">Sync from ConnectWise to pull the latest data.</span>
              </div>
            )}

            {hasEngineers && engineers.some(e => e.hourlyCost === 0) && (
              <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 rounded-lg p-3" data-testid="text-missing-cost-warning">
                Some engineers don't have hourly cost rates configured in ConnectWise. Set the "Hourly Cost" field on their member record to get accurate margin calculations.
              </div>
            )}
          </>
        )}

        {tab === "additions" && (
          <>
            {additions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product/Service</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Agreement</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Annual Cost</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {additions.map((add, idx) => (
                      <TableRow key={idx} data-testid={`row-addition-${idx}`} className={add.category === "microsoft" ? "opacity-60" : ""}>
                        <TableCell className="text-sm font-medium max-w-[200px] truncate" title={add.additionName}>
                          {add.additionName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            add.category === "labor" ? "text-blue-600 border-blue-300 text-xs" :
                            add.category === "microsoft" ? "text-purple-600 border-purple-300 text-xs" :
                            "text-gray-600 border-gray-300 text-xs"
                          }>
                            {add.category === "labor" ? "Labor" : add.category === "microsoft" ? "Microsoft" : "Product"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={add.agreementName}>
                          {add.agreementName}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">{add.quantity}</TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {add.unitCost > 0 ? `$${add.unitCost.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {add.unitPrice > 0 ? `$${add.unitPrice.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right font-medium">
                          {formatCurrency(add.annualCost)}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          <MarginBadge margin={add.margin} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground border-t pt-2">
                  <div className="flex justify-between">
                    <span>Third-Party Product Cost: <strong>{formatCurrency(additions.filter(a => a.category === "other").reduce((s, a) => s + a.annualCost, 0))}</strong></span>
                    <span>Labor Addition Revenue: <strong>{formatCurrency(additions.filter(a => a.category === "labor").reduce((s, a) => s + a.annualRevenue, 0))}</strong></span>
                  </div>
                  <div className="flex justify-between">
                    <span>Microsoft Licensing: <strong>{formatCurrency(additions.filter(a => a.category === "microsoft").reduce((s, a) => s + a.annualRevenue, 0))}</strong> <span className="italic">(excluded from margin)</span></span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No agreement additions found.
                <br />
                <span className="text-xs">This client's agreements may not have product or tool additions, or the data hasn't been synced yet.</span>
              </div>
            )}
          </>
        )}

        {tab === "analysis" && (
          <>
            {insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 border ${
                      insight.type === "warning" ? "bg-amber-500/10 border-amber-500/20" :
                      insight.type === "suggestion" ? "bg-blue-500/10 border-blue-500/20" :
                      "bg-muted/50 border-border"
                    }`}
                    data-testid={`insight-${idx}`}
                  >
                    <div className="flex items-start gap-2">
                      <InsightIcon type={insight.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{insight.title}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{insight.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{insight.detail}</p>
                        {insight.impact && (
                          <p className={`text-xs mt-1.5 font-medium ${
                            insight.type === "warning" ? "text-amber-600 dark:text-amber-400" :
                            insight.type === "suggestion" ? "text-blue-600 dark:text-blue-400" :
                            "text-foreground"
                          }`}>
                            {insight.impact}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-60" />
                No margin concerns detected.
                <br />
                <span className="text-xs">This client's profitability looks healthy.</span>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Accounts() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [sortField, setSortField] = useState<SortField>("companyName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<ClientAccountWithStatus | null>(null);
  const [includeMs, setIncludeMs] = useState(false);

  const { data: accounts, isLoading } = useQuery<ClientAccountWithStatus[]>({
    queryKey: ["/api/accounts"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/accounts/sync");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Sync Complete", description: `${data.synced} client accounts synced from ConnectWise.` });
    },
    onError: (err: any) => {
      toast({ title: "Sync Failed", description: err.message || "Could not sync accounts from ConnectWise.", variant: "destructive" });
    },
  });

  const tierMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: number; tier: string }) => {
      const res = await apiRequest("PATCH", `/api/accounts/${id}/tier`, { tier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "companyName" ? "asc" : "desc");
    }
  };

  const statusOrder = { red: 0, yellow: 1, green: 2 };

  const filtered = (accounts || [])
    .filter(a => filterTier === "all" || a.effectiveTier === filterTier)
    .filter(a => filterStatus === "all" || a.tbrStatus === filterStatus)
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "companyName": cmp = a.companyName.localeCompare(b.companyName); break;
        case "effectiveTier": cmp = a.effectiveTier.localeCompare(b.effectiveTier); break;
        case "totalRevenue": cmp = (a.totalRevenue || 0) - (b.totalRevenue || 0); break;
        case "agreementRevenue": cmp = (a.agreementRevenue || 0) - (b.agreementRevenue || 0); break;
        case "projectRevenue": cmp = (a.projectRevenue || 0) - (b.projectRevenue || 0); break;
        case "grossMarginPercent": cmp = (a.grossMarginPercent || 0) - (b.grossMarginPercent || 0); break;
        case "laborCost": cmp = (a.laborCost || 0) - (b.laborCost || 0); break;
        case "totalHours": cmp = (a.totalHours || 0) - (b.totalHours || 0); break;
        case "tbrStatus": cmp = (statusOrder[a.tbrStatus] ?? 1) - (statusOrder[b.tbrStatus] ?? 1); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalMsRev = (accounts || []).reduce((sum, a) => sum + ((a as any).msLicensingRevenue || 0), 0);
  const totalMsCost = (accounts || []).reduce((sum, a) => sum + ((a as any).msLicensingCost || 0), 0);

  const summary = {
    total: (accounts || []).length,
    green: (accounts || []).filter(a => a.tbrStatus === "green").length,
    yellow: (accounts || []).filter(a => a.tbrStatus === "yellow").length,
    red: (accounts || []).filter(a => a.tbrStatus === "red").length,
    tierA: (accounts || []).filter(a => a.effectiveTier === "A").length,
    tierB: (accounts || []).filter(a => a.effectiveTier === "B").length,
    tierC: (accounts || []).filter(a => a.effectiveTier === "C").length,
    totalAgreementRev: (accounts || []).reduce((sum, a) => sum + (a.agreementRevenue || 0), 0),
    totalProjectRev: (accounts || []).reduce((sum, a) => sum + (a.projectRevenue || 0), 0),
    totalLaborCost: (accounts || []).reduce((sum, a) => sum + (a.laborCost || 0), 0),
    totalAdditionCost: (accounts || []).reduce((sum, a) => sum + (a.additionCost || 0), 0),
    totalProjectProductCost: (accounts || []).reduce((sum, a) => sum + ((a as any).projectProductCost || 0), 0),
    totalExpenseCost: (accounts || []).reduce((sum, a) => sum + ((a as any).expenseCost || 0), 0),
    totalHours: (accounts || []).reduce((sum, a) => sum + (a.totalHours || 0), 0),
  };

  const effectiveAgrRev = includeMs ? summary.totalAgreementRev : summary.totalAgreementRev - totalMsRev;
  const effectiveAddCost = includeMs ? summary.totalAdditionCost + totalMsCost : summary.totalAdditionCost;
  const overallRev = effectiveAgrRev + summary.totalProjectRev;
  const overallTotalCost = summary.totalLaborCost + effectiveAddCost + summary.totalProjectProductCost + summary.totalExpenseCost;
  const overallMargin = overallRev > 0 && overallTotalCost > 0
    ? ((overallRev - overallTotalCost) / overallRev) * 100
    : null;

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "opacity-100" : "opacity-30"}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-lg font-semibold" data-testid="text-accounts-title">Client Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Managed services clients from ConnectWise — TBR compliance, revenue, and tier management
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-accounts"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {syncMutation.isPending ? "Syncing..." : "Sync from ConnectWise"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-medium mb-1">No Client Accounts Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click "Sync from ConnectWise" to pull in clients with Top Shelf or Managed Services agreements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">TBR Compliance</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold" data-testid="text-compliance-percent">
                  {summary.total > 0 ? Math.round((summary.green / summary.total) * 100) : 0}%
                </span>
                <div className="flex gap-1 text-xs">
                  <span className="text-green-600">{summary.green}&#10003;</span>
                  <span className="text-yellow-600">{summary.yellow}!</span>
                  <span className="text-red-600">{summary.red}&#10007;</span>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Client Tiers</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-primary">{summary.tierA}A</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-blue-600">{summary.tierB}B</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-gray-500">{summary.tierC}C</span>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Agreement Revenue</div>
              <div className="text-lg font-semibold" data-testid="text-total-agreement-rev">
                {formatCurrency(effectiveAgrRev)}
                <span className="text-xs font-normal text-muted-foreground">/yr</span>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Project Revenue</div>
              <div className="text-lg font-semibold" data-testid="text-total-project-rev">
                {formatCurrency(summary.totalProjectRev)}
                <span className="text-xs font-normal text-muted-foreground">/yr</span>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Labor Cost</div>
              <div className="text-lg font-semibold" data-testid="text-total-labor-cost">
                {formatCurrency(summary.totalLaborCost)}
                <span className="text-xs font-normal text-muted-foreground"> ({summary.totalHours.toFixed(0)}h)</span>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Overall Margin</div>
              <div className="text-lg font-semibold" data-testid="text-overall-margin">
                <MarginBadge margin={overallMargin} />
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-filter-tier">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="A">Tier A</SelectItem>
                <SelectItem value="B">Tier B</SelectItem>
                <SelectItem value="C">Tier C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="green">On Track</SelectItem>
                <SelectItem value="yellow">Attention</SelectItem>
                <SelectItem value="red">Needs TBR</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="include-ms"
                checked={includeMs}
                onCheckedChange={setIncludeMs}
                data-testid="switch-include-ms"
              />
              <Label htmlFor="include-ms" className="text-xs cursor-pointer">
                Include MS Licensing
              </Label>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} of {summary.total} clients
            </span>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader field="companyName">Client</SortHeader>
                    <SortHeader field="effectiveTier">Tier</SortHeader>
                    <SortHeader field="tbrStatus">TBR Status</SortHeader>
                    <TableHead>Last TBR</TableHead>
                    <TableHead>Next TBR</TableHead>
                    <SortHeader field="agreementRevenue">Agree Rev</SortHeader>
                    <SortHeader field="projectRevenue">Proj Rev</SortHeader>
                    <SortHeader field="totalRevenue">Total Rev</SortHeader>
                    <SortHeader field="laborCost">Labor Cost</SortHeader>
                    <SortHeader field="totalHours">Hours</SortHeader>
                    <SortHeader field="grossMarginPercent">Margin</SortHeader>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((acct) => (
                    <TableRow key={acct.id} data-testid={`row-account-${acct.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm" data-testid={`text-company-${acct.id}`}>{acct.companyName}</span>
                          {acct.agreementTypes && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{acct.agreementTypes}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={acct.effectiveTier}
                          onValueChange={(val) => tierMutation.mutate({ id: acct.id, tier: val })}
                        >
                          <SelectTrigger className="h-7 w-[80px] text-xs p-1 border-0 bg-transparent" data-testid={`select-tier-${acct.id}`}>
                            <TierBadge tier={acct.effectiveTier} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Tier A</SelectItem>
                            <SelectItem value="B">Tier B</SelectItem>
                            <SelectItem value="C">Tier C</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={acct.tbrStatus} reason={acct.tbrStatusReason} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" data-testid={`text-last-tbr-${acct.id}`}>
                        {formatDate(acct.lastTbrDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" data-testid={`text-next-tbr-${acct.id}`}>
                        {acct.nextTbrDate ? (
                          <span>{formatDate(acct.nextTbrDate)}</span>
                        ) : (
                          <span className="text-yellow-600 dark:text-yellow-400">Not scheduled</span>
                        )}
                        {acct.scheduleFrequency && (
                          <span className="ml-1 text-muted-foreground/60">({acct.scheduleFrequency}mo)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-agreement-rev-${acct.id}`}>
                        {formatCurrency(acct.agreementRevenue)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-project-rev-${acct.id}`}>
                        {formatCurrency(acct.projectRevenue)}
                      </TableCell>
                      <TableCell className="text-xs font-medium tabular-nums" data-testid={`text-total-rev-${acct.id}`}>
                        {formatCurrency(acct.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-labor-cost-${acct.id}`}>
                        {formatCurrency(acct.laborCost)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-hours-${acct.id}`}>
                        {formatHours(acct.totalHours)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-margin-${acct.id}`}>
                        <div className="flex items-center gap-1">
                          {(() => {
                            if (includeMs) {
                              const rev = acct.totalRevenue || 0;
                              const cost = (acct.laborCost || 0) + (acct.additionCost || 0) + ((acct as any).msLicensingCost || 0);
                              const m = rev > 0 ? ((rev - cost) / rev) * 100 : null;
                              return <MarginBadge margin={m} />;
                            }
                            return <MarginBadge margin={acct.grossMarginPercent} />;
                          })()}
                          {(() => {
                            const acctInsights = (acct.marginAnalysis as MarginInsight[] | null) || [];
                            const warnings = acctInsights.filter(i => i.type === "warning").length;
                            if (warnings > 0) return <TriangleAlert className="h-3 w-3 text-amber-500" />;
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setSelectedAccount(acct)}
                                data-testid={`button-engineer-breakdown-${acct.id}`}
                              >
                                <Users className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cost & Margin Breakdown</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setLocation(`/reviews?orgId=${acct.cwCompanyId}&orgName=${encodeURIComponent(acct.companyName)}`)}
                                data-testid={`button-open-review-${acct.id}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open TBR Reviews</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <EngineerBreakdownDialog
        open={!!selectedAccount}
        onOpenChange={(open) => { if (!open) setSelectedAccount(null); }}
        account={selectedAccount}
        includeMs={includeMs}
      />
    </div>
  );
}