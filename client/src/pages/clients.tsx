import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  Search,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Shield,
  DollarSign,
  TrendingUp,
  ClipboardList,
  Receipt,
  LayoutList,
  Table2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Building2,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ArrowRight,
  Link2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { ClientAccount, StackComplianceData } from "@shared/schema";

type SortKey = "companyName" | "tier" | "totalRevenue" | "agrMargin" | "arScore" | "tbrStatus";
type SortDir = "asc" | "desc";

const AR_SCORE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
const TBR_STATUS_ORDER: Record<string, number> = { red: 0, yellow: 1, scheduled: 2, green: 3 };

const STACK_TOOLS: { key: keyof StackComplianceData; label: string; abbr: string }[] = [
  { key: "ninjaRmm", label: "Ninja RMM", abbr: "Ninja" },
  { key: "huntressEdr", label: "Huntress EDR", abbr: "EDR" },
  { key: "huntressItdr", label: "Huntress ITDR", abbr: "ITDR" },
  { key: "huntressSat", label: "Huntress SAT", abbr: "SAT" },
  { key: "dropSuite", label: "DropSuite Backup", abbr: "DropSuite" },
  { key: "zorusDns", label: "Zorus DNS", abbr: "Zorus" },
  { key: "connectSecure", label: "ConnectSecure", abbr: "ConnSec" },
  { key: "huntressSiem", label: "Huntress SIEM", abbr: "SIEM" },
  { key: "msBizPremium", label: "MS Business Premium", abbr: "MS BP" },
];

function StackDot({ value, needsMapping }: { value: boolean | null | undefined; needsMapping?: boolean }) {
  if (needsMapping) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-1 py-0.5 leading-none whitespace-nowrap mx-auto">
      Map
    </span>
  );
  if (value === true) return <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />;
  if (value === false) return <XCircle className="h-4 w-4 text-red-500 mx-auto" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />;
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    A: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border-purple-300 dark:border-purple-800",
    B: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-300 dark:border-blue-800",
    C: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-300 dark:border-slate-700",
  };
  return (
    <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded border", colors[tier] ?? colors.C)}>
      Tier {tier}
    </span>
  );
}

function ARBadge({ score }: { score: string | null | undefined }) {
  if (!score) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    A: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
    B: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
    C: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    D: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  };
  return <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", colors[score])}>{score}</span>;
}

function TBRStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  if (status === "red") return <Badge variant="destructive" className="text-xs">No TBR</Badge>;
  if (status === "yellow") return <Badge className="text-xs bg-amber-500 hover:bg-amber-600 text-white">Overdue</Badge>;
  if (status === "scheduled") return <Badge className="text-xs bg-blue-500 hover:bg-blue-600 text-white">Scheduled</Badge>;
  if (status === "green") return <Badge variant="secondary" className="text-xs text-green-700 dark:text-green-400">On Track</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function fmtRevenue(v: number | null | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${Math.round(v)}%`;
}

function MarginPct({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = pct >= 50 ? "text-green-600 dark:text-green-400" : pct >= 30 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return <span className={cn("text-sm font-semibold tabular-nums", color)}>{fmtPct(pct)}</span>;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="h-3 w-3 opacity-20" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
}

function ComplianceScore({ stack }: { stack: StackComplianceData | null | undefined }) {
  if (!stack) return <span className="text-muted-foreground text-xs">—</span>;
  const total = STACK_TOOLS.length;
  const have = STACK_TOOLS.filter(t => stack[t.key] === true).length;
  const pct = Math.round((have / total) * 100);
  const color = pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return <span className={cn("text-xs font-semibold", color)}>{have}/{total}</span>;
}

type Account = ClientAccount & {
  tbrStatus?: string;
  tbrInvitedAt?: string | null;
  lastTbrDate?: string | null;
  nextTbrDate?: string | null;
  scheduledFrequencyMonths?: number | null;
  stackCompliance?: StackComplianceData | null;
  marginAnalysis?: {
    agrMarginPercent?: number | null;
    projMarginPercent?: number | null;
    totalMarginPercent?: number | null;
    laborCostTotal?: number | null;
    additionCostTotal?: number | null;
    totalRevenue?: number | null;
    totalCost?: number | null;
    insights?: any[];
  } | null;
  arSummary?: {
    paymentScore?: string | null;
    paymentScoreLabel?: string | null;
    avgDaysToPay?: number | null;
    outstandingBalance?: number | null;
    onTimePercent?: number | null;
    aging?: {
      current?: number;
      days1to30?: number;
      days31to60?: number;
      days61to90?: number;
      days91plus?: number;
    } | null;
  } | null;
  engineerBreakdown?: Record<string, { hours: number; cost: number }> | null;
  agreementAdditions?: any[] | null;
};

function OverviewTab({ account }: { account: Account }) {
  const ma = account.marginAnalysis as any;
  const ar = account.arSummary as any;
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-lg font-bold mt-0.5">{fmtRevenue(account.totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Agr: {fmtRevenue(account.agreementRevenue)} · Proj: {fmtRevenue(account.projectRevenue)}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Agr Margin</p>
          <p className="text-lg font-bold mt-0.5"><MarginPct pct={ma?.agrMarginPercent} /></p>
          <p className="text-xs text-muted-foreground mt-1">Overall: {fmtPct(ma?.totalMarginPercent)}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">AR Score</p>
          <div className="flex items-center gap-2 mt-0.5">
            <ARBadge score={ar?.paymentScore} />
            <span className="text-xs text-muted-foreground">{ar?.paymentScoreLabel || ""}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Avg {ar?.avgDaysToPay ?? "—"} days · ${(ar?.outstandingBalance ?? 0).toLocaleString()} outstanding</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">TBR Status</p>
          <div className="mt-0.5"><TBRStatusBadge status={account.tbrStatus} /></div>
          <p className="text-xs text-muted-foreground mt-1">
            {account.lastTbrDate ? `Last: ${new Date(account.lastTbrDate).toLocaleDateString()}` : "No review yet"}
          </p>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground mb-2">Stack Compliance</p>
        <div className="grid grid-cols-3 gap-y-2 gap-x-1">
          {STACK_TOOLS.map(tool => (
            <div key={tool.key} className="flex items-center gap-1.5">
              <StackDot value={account.stackCompliance?.[tool.key] as boolean | null} />
              <span className="text-xs text-muted-foreground truncate">{tool.abbr}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-4 text-center">
              <span className="text-xs font-bold text-primary">{account.stackCompliance?.secureScore ?? "—"}</span>
            </div>
            <span className="text-xs text-muted-foreground">Secure Score</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinancialsTab({ account }: { account: Account }) {
  const ma = account.marginAnalysis as any;
  const eb = account.engineerBreakdown as Record<string, { hours: number; cost: number }> | null;
  const addns = (account.agreementAdditions as any[]) || [];
  const insights = ma?.insights || [];

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Agr Revenue", value: fmtRevenue(account.agreementRevenue) },
          { label: "Proj Revenue", value: fmtRevenue(account.projectRevenue) },
          { label: "Total Revenue", value: fmtRevenue(account.totalRevenue) },
          { label: "Labor Cost", value: fmtRevenue(ma?.laborCostTotal) },
          { label: "Additions Cost", value: fmtRevenue(ma?.additionCostTotal) },
          { label: "Total Cost", value: fmtRevenue(ma?.totalCost) },
          { label: "Agr Margin", value: fmtPct(ma?.agrMarginPercent) },
          { label: "Proj Margin", value: fmtPct(ma?.projMarginPercent) },
          { label: "Overall Margin", value: fmtPct(ma?.totalMarginPercent) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded border bg-muted/20 p-2">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {eb && Object.keys(eb).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Engineer Breakdown</p>
          <div className="rounded border overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground">
              <span>Engineer</span><span className="text-right">Hours</span><span className="text-right">Cost</span>
            </div>
            {Object.entries(eb).map(([name, data]) => (
              <div key={name} className="grid grid-cols-3 px-3 py-1.5 border-t">
                <span className="truncate">{name}</span>
                <span className="text-right tabular-nums">{(data as any)?.hours?.toFixed(1) ?? "—"}</span>
                <span className="text-right tabular-nums">{fmtRevenue((data as any)?.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Margin Insights</p>
          <div className="space-y-2">
            {insights.map((ins: any, i: number) => (
              <div key={i} className={cn("text-xs rounded border p-2.5", ins.type === "warning" ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" : "border-border bg-muted/20")}>
                <p className="font-medium">{ins.title}</p>
                <p className="text-muted-foreground mt-0.5">{ins.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {addns.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Agreement Additions ({addns.length})</p>
          <div className="rounded border overflow-hidden text-xs max-h-40 overflow-y-auto">
            <div className="grid grid-cols-3 bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground">
              <span className="col-span-2">Description</span><span className="text-right">Margin</span>
            </div>
            {addns.slice(0, 20).map((a: any, i: number) => (
              <div key={i} className="grid grid-cols-3 px-3 py-1 border-t">
                <span className="col-span-2 truncate">{a.description || a.name || "—"}</span>
                <span className="text-right tabular-nums">{a.margin != null ? fmtPct(a.margin) : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TBRTab({ account, onNavigate }: { account: Account; onNavigate: (path: string) => void }) {
  const { toast } = useToast();
  const isInvited = !!account.tbrInvitedAt;

  const inviteMutation = useMutation({
    mutationFn: (invited: boolean) =>
      apiRequest("PATCH", `/api/clients/${account.id}/tbr-invite`, { invited }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: isInvited ? "Invite cleared" : "Marked as invited" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Last Review</p>
          <p className="text-sm font-semibold mt-1">
            {account.lastTbrDate ? new Date(account.lastTbrDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "None on record"}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Next Scheduled</p>
          <p className="text-sm font-semibold mt-1">
            {account.nextTbrDate ? new Date(account.nextTbrDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled"}
          </p>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Review Frequency</p>
          <p className="text-sm font-semibold mt-0.5">
            {account.scheduledFrequencyMonths ? `Every ${account.scheduledFrequencyMonths} month${account.scheduledFrequencyMonths > 1 ? "s" : ""}` : "Not configured"}
          </p>
        </div>
        <TBRStatusBadge status={account.tbrStatus} />
      </div>

      <div className={cn(
        "rounded-lg border p-3 flex items-center justify-between transition-colors",
        isInvited ? "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800" : "bg-muted/30"
      )}>
        <div>
          <p className="text-xs text-muted-foreground">TBR Invite</p>
          <p className="text-sm font-semibold mt-0.5">
            {isInvited
              ? `Invited ${new Date(account.tbrInvitedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Not yet invited"}
          </p>
        </div>
        <Button
          size="sm"
          variant={isInvited ? "outline" : "default"}
          className={isInvited ? "text-xs border-purple-300 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50" : "text-xs bg-purple-600 hover:bg-purple-700 text-white"}
          onClick={() => inviteMutation.mutate(!isInvited)}
          disabled={inviteMutation.isPending}
          data-testid="button-tbr-invite-toggle"
        >
          {inviteMutation.isPending ? "..." : isInvited ? "Clear Invite" : "Mark as Invited"}
        </Button>
      </div>

      <div className="space-y-2 pt-1">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-between"
          onClick={() => onNavigate("/reviews")}
          data-testid="button-open-tbr"
        >
          Open TBR Reviews
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
          onClick={() => onNavigate("/staging")}
          data-testid="button-open-staging"
        >
          TBR Staging Notes
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ReceivablesTab({ account }: { account: Account }) {
  const ar = account.arSummary as any;
  if (!ar) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm py-12">
        No receivables data available for this client.
      </div>
    );
  }
  const aging = ar.aging || {};
  const agingEntries = [
    { label: "Current", val: aging.current ?? 0 },
    { label: "1–30 days", val: aging.days1to30 ?? 0 },
    { label: "31–60 days", val: aging.days31to60 ?? 0 },
    { label: "61–90 days", val: aging.days61to90 ?? 0 },
    { label: "90+ days", val: aging.days91plus ?? 0 },
  ];
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Payment Score</p>
          <div className="flex items-center gap-2 mt-1">
            <ARBadge score={ar.paymentScore} />
            <span className="text-xs">{ar.paymentScoreLabel}</span>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Avg Days to Pay</p>
          <p className="text-lg font-bold mt-0.5">{ar.avgDaysToPay ?? "—"}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Outstanding Balance</p>
          <p className="text-base font-bold mt-0.5">{fmtRevenue(ar.outstandingBalance ?? ar.totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">On-Time %</p>
          <p className="text-lg font-bold mt-0.5">{ar.onTimePercent != null ? `${Math.round(ar.onTimePercent)}%` : "—"}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Aging Breakdown</p>
        <div className="space-y-1.5">
          {agingEntries.map(({ label, val }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground w-24">{label}</span>
              <div className="flex-1 mx-3 bg-muted rounded-full h-1.5 overflow-hidden">
                {(ar.outstandingBalance ?? 1) > 0 && (
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${Math.min(100, (val / (ar.outstandingBalance || 1)) * 100)}%` }}
                  />
                )}
              </div>
              <span className="font-semibold tabular-nums w-16 text-right">{fmtRevenue(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackManualOverridePanel({ account, onClose }: { account: Account; onClose: () => void }) {
  const { toast } = useToast();
  const stack = (account.stackCompliance || {}) as any;

  const mutation = useMutation({
    mutationFn: async (updates: Partial<StackComplianceData>) => {
      return apiRequest("PATCH", `/api/clients/${account.id}/stack`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Stack compliance updated" });
    },
  });

  const toggleTool = (key: string, current: boolean | null) => {
    const next = current === true ? false : current === false ? null : true;
    const overrides = { ...(stack.manualOverrides || {}), [key]: next };
    mutation.mutate({ manualOverrides: overrides, [key]: next } as any);
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Auto-detected values are read-only. Toggle manual overrides below to correct any data.
      </p>
      {STACK_TOOLS.map(tool => {
        const val = stack[tool.key];
        const isManual = stack.manualOverrides?.[tool.key] !== undefined;
        const dsNeedsMapping = tool.key === "dropSuite" && stack.dropsuiteNeedsMapping === true;
        return (
          <div key={tool.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StackDot value={val} needsMapping={dsNeedsMapping} />
              <span className="text-sm">{tool.label}</span>
              {dsNeedsMapping && <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-300">needs mapping</Badge>}
              {isManual && !dsNeedsMapping && <Badge variant="outline" className="text-[10px] h-4 px-1">manual</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleTool(tool.key, val)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
                data-testid={`toggle-stack-${tool.key}`}
              >
                {val === true ? "mark ✗" : val === false ? "clear" : "mark ✓"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ClientMappingData {
  id?: number;
  cwCompanyId: number;
  companyName: string;
  ninjaOrgId: number | null;
  huntressOrgId: number | null;
  cippTenantId: string | null;
  dropsuiteUserId: number | null;
  notes: string | null;
}

function PlatformMappingsPanel({ account, onClose }: { account: Account; onClose: () => void }) {
  const { toast } = useToast();
  const { data: allMappings = [] } = useQuery<ClientMappingData[]>({ queryKey: ["/api/client-mappings"] });
  const existing = allMappings.find(m => m.cwCompanyId === account.cwCompanyId);

  const [ninjaOrgId, setNinjaOrgId] = useState(existing?.ninjaOrgId != null ? String(existing.ninjaOrgId) : "");
  const [huntressOrgId, setHuntressOrgId] = useState(existing?.huntressOrgId != null ? String(existing.huntressOrgId) : "");
  const [cippTenantId, setCippTenantId] = useState(existing?.cippTenantId ?? "");
  const [dropsuiteUserId, setDropsuiteUserId] = useState(existing?.dropsuiteUserId != null ? String(existing.dropsuiteUserId) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/client-mappings/${account.cwCompanyId}`, {
        cwCompanyId: account.cwCompanyId,
        companyName: account.companyName,
        ninjaOrgId: ninjaOrgId.trim() !== "" ? parseInt(ninjaOrgId, 10) : null,
        huntressOrgId: huntressOrgId.trim() !== "" ? parseInt(huntressOrgId, 10) : null,
        cippTenantId: cippTenantId.trim() !== "" ? cippTenantId.trim() : null,
        dropsuiteUserId: dropsuiteUserId.trim() !== "" ? dropsuiteUserId.trim() : null,
        notes: notes.trim() !== "" ? notes.trim() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Platform mappings saved", description: "Run a stack refresh to apply changes." });
      onClose();
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  const needsDs = account.stackCompliance?.dropsuiteNeedsMapping === true && !dropsuiteUserId;

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Override the platform IDs used when matching this client across integrations. Leave blank to let the system auto-detect by name.
      </p>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">NinjaOne Org ID</label>
          <Input
            value={ninjaOrgId}
            onChange={e => setNinjaOrgId(e.target.value)}
            placeholder="Auto-detect by name"
            className="h-8 text-sm"
            data-testid="input-ninja-org-id"
          />
          <p className="text-[11px] text-muted-foreground">Numeric ID from NinjaOne</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Huntress Org ID</label>
          <Input
            value={huntressOrgId}
            onChange={e => setHuntressOrgId(e.target.value)}
            placeholder="Auto-detect by name"
            className="h-8 text-sm"
            data-testid="input-huntress-org-id"
          />
          <p className="text-[11px] text-muted-foreground">Numeric ID from Huntress</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">CIPP Tenant Domain</label>
          <Input
            value={cippTenantId}
            onChange={e => setCippTenantId(e.target.value)}
            placeholder="e.g. contoso.onmicrosoft.com"
            className="h-8 text-sm"
            data-testid="input-cipp-tenant-id"
          />
          <p className="text-[11px] text-muted-foreground">Default domain name from Entra / CIPP</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium flex items-center gap-1.5">
            DropSuite User ID
            {needsDs && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5">
                needs mapping
              </span>
            )}
          </label>
          <Input
            value={dropsuiteUserId}
            onChange={e => setDropsuiteUserId(e.target.value)}
            placeholder="Numeric user ID from DropSuite portal"
            className={`h-8 text-sm ${needsDs ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
            data-testid="input-dropsuite-user-id"
          />
          <p className="text-[11px] text-muted-foreground">Found in DropSuite portal → Customers list (export CSV to get IDs)</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Notes</label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes"
            className="h-8 text-sm"
            data-testid="input-mapping-notes"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="button-save-mapping"
        >
          {mutation.isPending ? "Saving…" : "Save Mapping"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} data-testid="button-cancel-mapping">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DropSuiteCsvImport({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [csvText, setCsvText] = useState("");
  const [results, setResults] = useState<Array<{ companyName: string; status: string }> | null>(null);

  const mutation = useMutation({
    mutationFn: async (rows: Array<{ companyName: string; dropsuiteUserId: number }>) => {
      const res = await apiRequest("POST", "/api/dropsuite/import-csv", { rows });
      return res as any;
    },
    onSuccess: (data: any) => {
      setResults(data.results || []);
      queryClient.invalidateQueries({ queryKey: ["/api/client-mappings"] });
      toast({ title: `DropSuite import complete`, description: `${data.mapped} of ${data.total} clients mapped.` });
    },
    onError: () => {
      toast({ title: "Import failed", variant: "destructive" });
    },
  });

  function parseAndImport() {
    const lines = csvText.trim().split("\n").filter(l => l.trim());
    const rows: Array<{ companyName: string; dropsuiteUserId: string }> = [];
    for (const line of lines) {
      const isTab = line.includes("\t");
      const parts = isTab
        ? line.split("\t").map(p => p.trim().replace(/^"|"$/g, ""))
        : line.split(",").map(p => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 2) continue;
      const [col1, col2] = parts;
      const col1IsId = /^\d[\d-]*$/.test(col1);
      const userId = col1IsId ? col1 : col2;
      const name = col1IsId ? col2 : col1;
      if (userId && name) rows.push({ companyName: name, dropsuiteUserId: userId });
    }
    if (rows.length === 0) {
      toast({ title: "No valid rows found", description: "Expected: ID<tab>CompanyName or CompanyName,ID per line", variant: "destructive" });
      return;
    }
    mutation.mutate(rows);
  }

  return (
    <div className="p-4 space-y-3">
      <div>
        <p className="text-xs font-medium mb-1">Paste CSV (CompanyName, DropSuiteUserID)</p>
        <p className="text-[11px] text-muted-foreground mb-2">
          Paste rows directly from the DropSuite portal Customers export (tab-separated). Each row: <code className="bg-muted px-1 rounded">2296065-14{"        "}Company Name</code>
        </p>
        <textarea
          className="w-full h-36 text-xs font-mono border rounded-md p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={"2296065-14\tRevive Longevity Center\n2129946-14\tCathey & Cathey CPA PSC\n2006888-14\tBluegrass Home Care Services"}
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          data-testid="textarea-dropsuite-csv"
        />
      </div>
      {results && (
        <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="truncate font-medium">{r.companyName}</span>
              <span className={r.status === "mapped" ? "text-green-600" : "text-muted-foreground"}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={parseAndImport} disabled={mutation.isPending || !csvText.trim()} data-testid="button-import-dropsuite-csv">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {mutation.isPending ? "Importing…" : "Import"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} data-testid="button-cancel-dropsuite-import">
          Close
        </Button>
      </div>
    </div>
  );
}

function ClientSidePanel({ account, onClose }: { account: Account; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [showStackEdit, setShowStackEdit] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  return (
    <div className="flex flex-col h-full border-l bg-background" style={{ width: 420 }} data-testid="client-side-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm leading-tight truncate" data-testid="panel-company-name">{account.companyName}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <TierBadge tier={account.tierOverride || account.tier} />
            <ARBadge score={(account.arSummary as any)?.paymentScore} />
            <ComplianceScore stack={account.stackCompliance} />
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="flex-shrink-0" data-testid="button-close-panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {showStackEdit ? (
          <div>
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <p className="text-xs font-medium">Edit Stack — {account.companyName}</p>
              <Button size="sm" variant="ghost" onClick={() => setShowStackEdit(false)}>← Back</Button>
            </div>
            <StackManualOverridePanel account={account} onClose={() => setShowStackEdit(false)} />
          </div>
        ) : showMapping ? (
          <div>
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <p className="text-xs font-medium">Platform Mappings — {account.companyName}</p>
              <Button size="sm" variant="ghost" onClick={() => setShowMapping(false)}>← Back</Button>
            </div>
            <PlatformMappingsPanel account={account} onClose={() => setShowMapping(false)} />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-4 m-3 flex-shrink-0">
              <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="financials" className="text-xs" data-testid="tab-financials">Financials</TabsTrigger>
              <TabsTrigger value="tbr" className="text-xs" data-testid="tab-tbr">TBR</TabsTrigger>
              <TabsTrigger value="receivables" className="text-xs" data-testid="tab-receivables">A/R</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="overview" className="m-0 mt-0">
                <OverviewTab account={account} />
              </TabsContent>
              <TabsContent value="financials" className="m-0 mt-0">
                <FinancialsTab account={account} />
              </TabsContent>
              <TabsContent value="tbr" className="m-0 mt-0">
                <TBRTab account={account} onNavigate={setLocation} />
              </TabsContent>
              <TabsContent value="receivables" className="m-0 mt-0">
                <ReceivablesTab account={account} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>

      <div className="border-t px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() => { setShowStackEdit(!showStackEdit); setShowMapping(false); }}
          data-testid="button-edit-stack"
        >
          <Shield className="h-3.5 w-3.5 mr-1.5" />
          {showStackEdit ? "Back" : "Edit Stack"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() => { setShowMapping(!showMapping); setShowStackEdit(false); }}
          data-testid="button-map-platforms"
        >
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
          {showMapping ? "Back" : "Map Platforms"}
        </Button>
      </div>
    </div>
  );
}

function SortTh({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  return (
    <th
      className="text-left px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={current === sortKey} dir={dir} />
      </span>
    </th>
  );
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "stack">("list");
  const [sortKey, setSortKey] = useState<SortKey>("companyName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDsImport, setShowDsImport] = useState(false);
  const { toast } = useToast();

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const managedAccounts = useMemo(() => accounts, [accounts]);

  const refreshStackMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/clients/${id}/stack/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Stack data refreshed" });
    },
    onError: () => {
      toast({ title: "Stack refresh failed", description: "Check API connections", variant: "destructive" });
    },
  });

  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/clients/stack/refresh-all`);
    },
    onSuccess: (data: any) => {
      setBulkRefreshing(true);
      const count = data?.count ?? 0;
      toast({ title: `Refreshing ${count} clients`, description: "Stack data is updating in the background — this may take several minutes. Results will appear as each client completes." });
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      }, 5000);
      const maxWait = count > 20 ? 15 * 60 * 1000 : 5 * 60 * 1000;
      setTimeout(() => { clearInterval(poll); setBulkRefreshing(false); }, maxWait);
    },
    onError: () => {
      toast({ title: "Bulk refresh failed", variant: "destructive" });
    },
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let list = managedAccounts.filter(a => {
      const matchSearch = !search || a.companyName.toLowerCase().includes(search.toLowerCase());
      const matchTier = tierFilter === "all" || (a.tierOverride || a.tier) === tierFilter;
      return matchSearch && matchTier;
    });

    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === "companyName") { av = a.companyName; bv = b.companyName; }
      else if (sortKey === "tier") { av = a.tierOverride || a.tier; bv = b.tierOverride || b.tier; }
      else if (sortKey === "totalRevenue") { av = a.totalRevenue ?? 0; bv = b.totalRevenue ?? 0; }
      else if (sortKey === "agrMargin") {
        av = (a.marginAnalysis as any)?.agrMarginPercent ?? -999;
        bv = (b.marginAnalysis as any)?.agrMarginPercent ?? -999;
      }
      else if (sortKey === "arScore") {
        av = AR_SCORE_ORDER[(a.arSummary as any)?.paymentScore ?? ""] ?? 99;
        bv = AR_SCORE_ORDER[(b.arSummary as any)?.paymentScore ?? ""] ?? 99;
      }
      else if (sortKey === "tbrStatus") {
        av = TBR_STATUS_ORDER[a.tbrStatus ?? ""] ?? 99;
        bv = TBR_STATUS_ORDER[b.tbrStatus ?? ""] ?? 99;
      }

      if (typeof av === "string") {
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return list;
  }, [managedAccounts, search, tierFilter, sortKey, sortDir]);

  const selectedAccount = useMemo(() => filtered.find(a => a.id === selectedId) ?? null, [filtered, selectedId]);

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = { all: managedAccounts.length, A: 0, B: 0, C: 0 };
    managedAccounts.forEach(a => { const t = a.tierOverride || a.tier; if (t in c) c[t]++; });
    return c;
  }, [managedAccounts]);

  const stackSummary = useMemo(() => {
    const total = filtered.length;
    const result: Record<string, number> = {};
    STACK_TOOLS.forEach(t => {
      result[t.key] = filtered.filter(a => (a.stackCompliance as any)?.[t.key] === true).length;
    });
    return { total, tools: result };
  }, [filtered]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-6 py-4 border-b flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Client Management</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {managedAccounts.length} managed services clients
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={view === "list" ? "default" : "outline"}
                onClick={() => setView("list")}
                data-testid="button-view-list"
              >
                <LayoutList className="h-3.5 w-3.5 mr-1.5" />
                Client List
              </Button>
              <Button
                size="sm"
                variant={view === "stack" ? "default" : "outline"}
                onClick={() => setView("stack")}
                data-testid="button-view-stack"
              >
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Stack Compliance
              </Button>
              {view === "stack" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDsImport(v => !v)}
                    data-testid="button-dropsuite-import"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    DropSuite IDs
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshAllMutation.mutate()}
                    disabled={refreshAllMutation.isPending || bulkRefreshing}
                    data-testid="button-refresh-all-stack"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${bulkRefreshing ? "animate-spin" : ""}`} />
                    {bulkRefreshing ? "Refreshing…" : "Refresh All"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients..."
                className="pl-8 h-8 text-sm"
                data-testid="input-search-clients"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "A", "B", "C"] as const).map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant={tierFilter === t ? "secondary" : "ghost"}
                  className="h-8 text-xs px-2.5"
                  onClick={() => setTierFilter(t)}
                  data-testid={`filter-tier-${t}`}
                >
                  {t === "all" ? `All (${tierCounts.all})` : `Tier ${t} (${tierCounts[t]})`}
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</span>
          </div>
        </div>

        {showDsImport && view === "stack" && (
          <div className="mx-4 mt-0 mb-3 border rounded-lg bg-muted/30 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-background">
              <div className="flex items-center gap-2">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Import DropSuite Customer IDs</span>
              </div>
            </div>
            <DropSuiteCsvImport onClose={() => setShowDsImport(false)} />
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : view === "list" ? (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-background border-b z-10">
                <tr>
                  <SortTh label="Company" sortKey="companyName" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Tier" sortKey="tier" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Revenue" sortKey="totalRevenue" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Agr Margin" sortKey="agrMargin" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="AR Score" sortKey="arScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="TBR Status" sortKey="tbrStatus" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left">Stack</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(account => (
                  <tr
                    key={account.id}
                    className={cn(
                      "border-b cursor-pointer hover:bg-muted/40 transition-colors",
                      selectedId === account.id && "bg-primary/5 hover:bg-primary/5"
                    )}
                    onClick={() => setSelectedId(selectedId === account.id ? null : account.id)}
                    data-testid={`row-client-${account.cwCompanyId}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-sm">{account.companyName}</td>
                    <td className="px-3 py-2.5"><TierBadge tier={account.tierOverride || account.tier} /></td>
                    <td className="px-3 py-2.5 tabular-nums text-sm">{fmtRevenue(account.totalRevenue)}</td>
                    <td className="px-3 py-2.5"><MarginPct pct={(account.marginAnalysis as any)?.agrMarginPercent} /></td>
                    <td className="px-3 py-2.5"><ARBadge score={(account.arSummary as any)?.paymentScore} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <TBRStatusBadge status={account.tbrStatus} />
                        {account.tbrInvitedAt && (
                          <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-100" variant="outline">
                            Invited
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><ComplianceScore stack={account.stackCompliance} /></td>
                    <td className="px-3 py-2.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={e => { e.stopPropagation(); refreshStackMutation.mutate(account.id); }}
                        data-testid={`button-refresh-stack-${account.cwCompanyId}`}
                        title="Refresh stack data"
                      >
                        <RefreshCw className={cn("h-3 w-3", refreshStackMutation.isPending && "animate-spin")} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background border-b z-10">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground sticky left-0 bg-background z-20 border-r min-w-[180px]">
                      Company
                    </th>
                    {STACK_TOOLS.map(tool => {
                      const count = stackSummary.tools[tool.key];
                      const total = stackSummary.total;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <th key={tool.key} className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center whitespace-nowrap" title={`${count} of ${total} clients have ${tool.label}`}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{tool.abbr}</span>
                            <span className={cn("font-semibold tabular-nums", pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground")}>
                              {count}/{total}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center">Sec Score</th>
                    <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(account => {
                    const stack = account.stackCompliance as any;
                    const haveCount = STACK_TOOLS.filter(t => stack?.[t.key] === true).length;
                    const pct = Math.round((haveCount / STACK_TOOLS.length) * 100);
                    return (
                      <tr
                        key={account.id}
                        className={cn(
                          "border-b cursor-pointer hover:bg-muted/40 transition-colors",
                          selectedId === account.id && "bg-primary/5 hover:bg-primary/5"
                        )}
                        onClick={() => setSelectedId(selectedId === account.id ? null : account.id)}
                        data-testid={`row-stack-${account.cwCompanyId}`}
                      >
                        <td className="px-3 py-2 font-medium sticky left-0 bg-inherit border-r">
                          <span className="block truncate max-w-[175px]">{account.companyName}</span>
                        </td>
                        {STACK_TOOLS.map(tool => (
                          <td key={tool.key} className="px-3 py-2 text-center">
                            <StackDot
                              value={stack?.[tool.key]}
                              needsMapping={tool.key === "dropSuite" && stack?.dropsuiteNeedsMapping === true}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center text-xs font-semibold">
                          {stack?.secureScore != null ? `${stack.secureScore}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <div className="w-16 bg-muted rounded-full h-1.5">
                              <div
                                className={cn("h-full rounded-full", pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedAccount && (
        <ClientSidePanel
          account={selectedAccount}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
