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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TrendingDown,
  ClipboardList,
  Receipt,
  LayoutList,
  Table2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Ban,
  Building2,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ArrowRight,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { ClientAccount, StackComplianceData } from "@shared/schema";

type SortKey = "companyName" | "tier" | "totalRevenue" | "gmPct" | "arScore" | "tbrStatus" | "secureScore";
type SortDir = "asc" | "desc";

const AR_SCORE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
const TBR_STATUS_ORDER: Record<string, number> = { red: 0, yellow: 1, scheduled: 2, green: 3 };

const STACK_TOOL_GROUPS: {
  key: string;
  label: string;
  description: string;
  tools: { key: keyof StackComplianceData; label: string; abbr: string; required: boolean }[];
}[] = [
  {
    key: "endpoint",
    label: "Endpoint",
    description: "Installed on devices",
    tools: [
      { key: "ninjaRmm", label: "Ninja RMM", abbr: "Ninja", required: true },
      { key: "huntressEdr", label: "Huntress EDR", abbr: "EDR", required: true },
      { key: "zorusDns", label: "Zorus DNS", abbr: "Zorus", required: true },
    ],
  },
  {
    key: "mailbox",
    label: "Mailbox / User",
    description: "Per user or mailbox",
    tools: [
      { key: "huntressItdr", label: "Huntress ITDR", abbr: "ITDR", required: true },
      { key: "huntressSat", label: "Huntress SAT", abbr: "SAT", required: true },
      { key: "dropSuite", label: "DropSuite Backup", abbr: "DropSuite", required: true },
      { key: "msBizPremium", label: "MS Business Premium", abbr: "MS BP", required: true },
    ],
  },
  {
    key: "optional",
    label: "Optional",
    description: "Add-on services",
    tools: [
      { key: "connectSecure", label: "ConnectSecure", abbr: "ConnSec", required: false },
      { key: "huntressSiem", label: "Huntress SIEM", abbr: "SIEM", required: false },
    ],
  },
];

const STACK_TOOLS = STACK_TOOL_GROUPS.flatMap(g => g.tools.map(t => ({ ...t, group: g.key })));

function StackDot({ value, required = true, optedOut = false }: { value: boolean | null | undefined; required?: boolean; optedOut?: boolean }) {
  if (optedOut) return <Ban className="h-4 w-4 text-muted-foreground/50 mx-auto" title="Opted out" />;
  if (value === true) return <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />;
  if (value === false) {
    if (!required) return <MinusCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
    return <XCircle className="h-4 w-4 text-red-500 mx-auto" />;
  }
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

const REQUIRED_TOOLS = STACK_TOOLS.filter(t => t.required);

function getComplianceStats(stack: StackComplianceData | null | undefined) {
  if (!stack) return { have: 0, total: 0, pct: 0 };
  const optedOut = stack.optedOutTools ?? [];
  const applicable = REQUIRED_TOOLS.filter(t => !optedOut.includes(t.key as string));
  const have = applicable.filter(t => stack[t.key] === true).length;
  const total = applicable.length;
  const pct = total > 0 ? Math.round((have / total) * 100) : 100;
  return { have, total, pct };
}

function ComplianceScore({ stack }: { stack: StackComplianceData | null | undefined }) {
  if (!stack) return <span className="text-muted-foreground text-xs">—</span>;
  const { have, total, pct } = getComplianceStats(stack);
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
        {STACK_TOOL_GROUPS.filter(g => g.key !== "optional").map(group => (
          <div key={group.key} className="mb-2 last:mb-0">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">{group.label}</p>
            <div className="grid grid-cols-3 gap-y-1.5 gap-x-1">
              {group.tools.map(tool => {
                const optedOut = (account.stackCompliance?.optedOutTools ?? []).includes(tool.key as string);
                return (
                  <div key={tool.key} className="flex items-center gap-1.5">
                    <StackDot value={account.stackCompliance?.[tool.key] as boolean | null} required={tool.required} optedOut={optedOut} />
                    <span className={cn("text-xs truncate", optedOut ? "text-muted-foreground/40 line-through" : "text-muted-foreground")}>{tool.abbr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t">
          <div className="w-4 text-center">
            <span className="text-xs font-bold text-primary">{account.stackCompliance?.secureScore ?? "—"}</span>
          </div>
          <span className="text-xs text-muted-foreground">Secure Score</span>
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

function computePaymentTrend(monthlyTrend: { onTimePercent: number }[] | null | undefined): "improving" | "declining" | "stable" | null {
  if (!monthlyTrend || monthlyTrend.length < 4) return null;
  const sorted = [...monthlyTrend].slice(-6);
  const half = Math.floor(sorted.length / 2);
  const older = sorted.slice(0, half);
  const recent = sorted.slice(half);
  const avgOlder = older.reduce((s, m) => s + m.onTimePercent, 0) / older.length;
  const avgRecent = recent.reduce((s, m) => s + m.onTimePercent, 0) / recent.length;
  const diff = avgRecent - avgOlder;
  if (diff >= 8) return "improving";
  if (diff <= -8) return "declining";
  return "stable";
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
  const hasOverdue = (ar.outstandingBalance ?? ar.totalOutstanding ?? 0) > 0;
  const trend = hasOverdue ? computePaymentTrend(ar.monthlyTrend) : null;
  return (
    <div className="space-y-4 p-4">
      {trend && trend !== "stable" && (
        <div className={cn(
          "flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-md border",
          trend === "improving"
            ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
        )}>
          {trend === "improving"
            ? <TrendingUp className="h-3.5 w-3.5" />
            : <TrendingDown className="h-3.5 w-3.5" />}
          {trend === "improving"
            ? "Catching up — on-time payment rate improving over last 3 months"
            : "Falling behind — on-time payment rate declining over last 3 months"}
        </div>
      )}
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

  const toggleOptOut = (key: string) => {
    const current = stack.optedOutTools ?? [];
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    mutation.mutate({ optedOutTools: next } as any);
  };

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Auto-detected values are read-only. Toggle manual overrides or mark a service as opted-out to adjust compliance.
      </p>
      {STACK_TOOL_GROUPS.map(group => (
        <div key={group.key}>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {group.tools.map(tool => {
              const val = stack[tool.key];
              const isManual = stack.manualOverrides?.[tool.key] !== undefined;
              const isOptedOut = (stack.optedOutTools ?? []).includes(tool.key as string);
              return (
                <div key={tool.key} className={cn("flex items-center justify-between rounded px-2 py-1", isOptedOut && "bg-muted/40 opacity-70")}>
                  <div className="flex items-center gap-2">
                    <StackDot value={val} required={tool.required} optedOut={isOptedOut} />
                    <span className={cn("text-sm", isOptedOut && "line-through text-muted-foreground")}>{tool.label}</span>
                    {isManual && !isOptedOut && <Badge variant="outline" className="text-[10px] h-4 px-1">manual</Badge>}
                    {isOptedOut && <Badge variant="secondary" className="text-[10px] h-4 px-1 text-muted-foreground">opted out</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    {!isOptedOut && (
                      <button
                        onClick={() => toggleTool(tool.key as string, val as boolean | null)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                        data-testid={`toggle-stack-${tool.key}`}
                      >
                        {val === true ? "mark ✗" : val === false ? "clear" : "mark ✓"}
                      </button>
                    )}
                    <button
                      onClick={() => toggleOptOut(tool.key as string)}
                      className={cn("text-xs underline", isOptedOut ? "text-primary hover:text-primary/80" : "text-muted-foreground/60 hover:text-muted-foreground")}
                      data-testid={`optout-stack-${tool.key}`}
                      title={isOptedOut ? "Remove opt-out — include in compliance" : "Mark as opted out — exclude from compliance"}
                    >
                      {isOptedOut ? "re-enable" : "opt out"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
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

function SearchableOrgSelect({
  value,
  onChange,
  options,
  placeholder,
  testId,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder: string;
  testId: string;
  loading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <Select value={value} onValueChange={v => { onChange(v === "__clear__" ? "" : v); }}>
      <SelectTrigger className="h-8 text-sm" data-testid={testId}>
        <SelectValue placeholder={loading ? "Loading…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="px-2 pb-1">
          <Input
            value={search}
            onChange={e => { e.stopPropagation(); setSearch(e.target.value); }}
            placeholder="Search…"
            className="h-7 text-xs"
            onKeyDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          />
        </div>
        <SelectItem value="__clear__" className="text-muted-foreground italic text-xs">
          — Auto-detect by name —
        </SelectItem>
        {filtered.slice(0, 100).map(o => (
          <SelectItem key={o.id} value={o.id} className="text-sm">
            {o.label}
          </SelectItem>
        ))}
        {filtered.length > 100 && (
          <div className="px-3 py-1 text-xs text-muted-foreground">Type to filter ({filtered.length} total)</div>
        )}
      </SelectContent>
    </Select>
  );
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

  const { data: ninjaOrgs = [], isLoading: ninjaLoading } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/organizations"],
  });
  const { data: huntressOrgs = [], isLoading: huntressLoading } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/huntress/organizations"],
  });
  const { data: cippTenants = [], isLoading: cippLoading } = useQuery<{ id: string; defaultDomainName: string; displayName: string }[]>({
    queryKey: ["/api/cipp/tenants"],
  });

  const ninjaOptions = useMemo(() =>
    ninjaOrgs.slice().sort((a, b) => a.name.localeCompare(b.name)).map(o => ({ id: String(o.id), label: o.name })),
    [ninjaOrgs]);
  const huntressOptions = useMemo(() =>
    huntressOrgs.slice().sort((a, b) => a.name.localeCompare(b.name)).map(o => ({ id: String(o.id), label: o.name })),
    [huntressOrgs]);
  const cippOptions = useMemo(() =>
    cippTenants.slice().sort((a, b) => a.displayName.localeCompare(b.displayName)).map(o => ({
      id: o.defaultDomainName,
      label: `${o.displayName} (${o.defaultDomainName})`,
    })),
    [cippTenants]);

  const [refreshing, setRefreshing] = useState(false);

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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-mappings"] });
      toast({ title: "Mapping saved — refreshing stack…", description: `Checking ${account.companyName}'s tools with the new mapping.` });
      // Auto-trigger single-client stack refresh so the new mapping takes effect immediately
      setRefreshing(true);
      try {
        await apiRequest("POST", `/api/clients/${account.id}/stack/refresh`);
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
        toast({ title: "Stack refreshed", description: `${account.companyName} compliance data updated with new mapping.` });
      } catch {
        toast({ title: "Stack refresh failed", description: "Mapping was saved. Run 'Refresh Stack Data' manually to apply it.", variant: "destructive" });
      } finally {
        setRefreshing(false);
        onClose();
      }
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Select the matching organization from each platform. Choose "Auto-detect by name" to let the system match automatically.
      </p>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">NinjaOne Organization</label>
          <SearchableOrgSelect
            value={ninjaOrgId}
            onChange={setNinjaOrgId}
            options={ninjaOptions}
            placeholder="Auto-detect by name"
            testId="select-ninja-org"
            loading={ninjaLoading}
          />
          {ninjaOrgId && ninjaOptions.find(o => o.id === ninjaOrgId) && (
            <p className="text-[11px] text-green-600 dark:text-green-400">
              ✓ Mapped to: {ninjaOptions.find(o => o.id === ninjaOrgId)?.label} (ID: {ninjaOrgId})
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Huntress Organization</label>
          <SearchableOrgSelect
            value={huntressOrgId}
            onChange={setHuntressOrgId}
            options={huntressOptions}
            placeholder="Auto-detect by name"
            testId="select-huntress-org"
            loading={huntressLoading}
          />
          {huntressOrgId && huntressOptions.find(o => o.id === huntressOrgId) && (
            <p className="text-[11px] text-green-600 dark:text-green-400">
              ✓ Mapped to: {huntressOptions.find(o => o.id === huntressOrgId)?.label} (ID: {huntressOrgId})
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">CIPP / Microsoft Tenant</label>
          <SearchableOrgSelect
            value={cippTenantId}
            onChange={setCippTenantId}
            options={cippOptions}
            placeholder="Auto-detect by name"
            testId="select-cipp-tenant"
            loading={cippLoading}
          />
          {cippTenantId && (
            <p className="text-[11px] text-green-600 dark:text-green-400">
              ✓ Domain: {cippTenantId}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">DropSuite User ID (override)</label>
          <Input
            value={dropsuiteUserId}
            onChange={e => setDropsuiteUserId(e.target.value)}
            placeholder="Auto-detected via email domain"
            className="h-8 text-sm"
            data-testid="input-dropsuite-user-id"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank — auto-detected by matching the CIPP tenant email domain. Only set this to force a specific user ID.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Notes</label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes about this mapping"
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
          disabled={mutation.isPending || refreshing}
          data-testid="button-save-mapping"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${(mutation.isPending || refreshing) ? "animate-spin" : "hidden"}`} />
          {refreshing ? "Refreshing stack…" : mutation.isPending ? "Saving…" : "Save & Refresh Stack"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} disabled={mutation.isPending || refreshing} data-testid="button-cancel-mapping">
          Cancel
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
  const [complianceSortKey, setComplianceSortKey] = useState<string>("companyName");
  const [complianceSortDir, setComplianceSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { toast } = useToast();

  const fullSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/accounts/sync");
      return res as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-accounts"] });
      const removed = data.removedNames?.length ? ` Removed: ${data.removedNames.join(", ")}.` : "";
      toast({ title: `Clients synced`, description: `${data.synced} active client(s) loaded from ConnectWise.${removed}` });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not sync clients from ConnectWise.", variant: "destructive" });
    },
  });

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

  const [bulkProgress, setBulkProgress] = useState<{ active: boolean; total: number; completed: number; currentClient: string } | null>(null);

  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/clients/stack/refresh-all`);
    },
    onSuccess: (data: any) => {
      if (data?.alreadyRunning) {
        toast({ title: "Refresh already in progress", description: "Stack data is still updating from a previous run." });
      }
      // Start polling progress
      const pollInterval = setInterval(async () => {
        try {
          const prog = await apiRequest("GET", "/api/clients/stack/refresh-progress") as any;
          setBulkProgress(prog);
          if (!prog.active) {
            clearInterval(pollInterval);
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            setTimeout(() => setBulkProgress(null), 3000);
          } else {
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
          }
        } catch {
          clearInterval(pollInterval);
          setBulkProgress(null);
        }
      }, 2000);
      // Safety timeout
      setTimeout(() => { clearInterval(pollInterval); setBulkProgress(null); }, 20 * 60 * 1000);
    },
    onError: () => {
      toast({ title: "Stack refresh failed", variant: "destructive" });
    },
  });

  const bulkRefreshing = bulkProgress?.active ?? false;

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
      else if (sortKey === "gmPct") {
        av = a.grossMarginPercent ?? -999;
        bv = b.grossMarginPercent ?? -999;
      }
      else if (sortKey === "secureScore") {
        av = (a.stackCompliance as any)?.secureScore ?? -1;
        bv = (b.stackCompliance as any)?.secureScore ?? -1;
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

    if (view === "stack") {
      const toNum = (v: boolean | null | undefined) => v === true ? 1 : v === false ? 0 : -1;
      list = [...list].sort((a, b) => {
        const sA = (a.stackCompliance as any) || {};
        const sB = (b.stackCompliance as any) || {};
        let av: any, bv: any;
        if (complianceSortKey === "companyName") { av = a.companyName; bv = b.companyName; }
        else if (complianceSortKey === "secureScore") { av = sA.secureScore ?? -1; bv = sB.secureScore ?? -1; }
        else if (complianceSortKey === "coverage") {
          av = REQUIRED_TOOLS.filter(t => sA[t.key] === true).length;
          bv = REQUIRED_TOOLS.filter(t => sB[t.key] === true).length;
        } else {
          av = toNum(sA[complianceSortKey]); bv = toNum(sB[complianceSortKey]);
        }
        if (typeof av === "string") { const cmp = av.localeCompare(bv); return complianceSortDir === "asc" ? cmp : -cmp; }
        return complianceSortDir === "asc" ? av - bv : bv - av;
      });
    }

    return list;
  }, [managedAccounts, search, tierFilter, sortKey, sortDir, view, complianceSortKey, complianceSortDir]);

  const handleComplianceSort = (key: string) => {
    if (complianceSortKey === key) setComplianceSortDir(d => d === "asc" ? "desc" : "asc");
    else { setComplianceSortKey(key); setComplianceSortDir("asc"); }
  };

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
              <Button
                size="sm"
                variant="outline"
                onClick={() => fullSyncMutation.mutate()}
                disabled={fullSyncMutation.isPending}
                title="Pull the current client list, financials, and AR data from ConnectWise"
                data-testid="button-sync-clients"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${fullSyncMutation.isPending ? "animate-spin" : ""}`} />
                {fullSyncMutation.isPending ? "Syncing…" : "Update Client List"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshAllMutation.mutate()}
                disabled={refreshAllMutation.isPending || bulkRefreshing}
                title="Re-check all clients' tool compliance against Huntress, NinjaOne, CIPP, and DropSuite"
                data-testid="button-refresh-all-stack"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${bulkRefreshing ? "animate-spin" : ""}`} />
                {bulkRefreshing ? `Refreshing Stack…` : "Refresh Stack Data"}
              </Button>
            </div>
          </div>

          {/* Stack refresh progress bar */}
          {bulkProgress && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1.5" data-testid="stack-refresh-progress">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin text-[#E77125]" />
                  {bulkProgress.active
                    ? <><span className="font-medium text-foreground">{bulkProgress.completed}</span> of <span className="font-medium text-foreground">{bulkProgress.total}</span> clients refreshed</>
                    : <span className="text-green-600 dark:text-green-400 font-medium">✓ Refresh complete — {bulkProgress.completed} clients updated</span>
                  }
                </span>
                {bulkProgress.active && bulkProgress.currentClient && (
                  <span className="text-muted-foreground/70 truncate max-w-[200px]">→ {bulkProgress.currentClient}</span>
                )}
              </div>
              {bulkProgress.active && bulkProgress.total > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#E77125] rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((bulkProgress.completed / bulkProgress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

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
                  <SortTh label="GM%" sortKey="gmPct" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="AR Score" sortKey="arScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="TBR Status" sortKey="tbrStatus" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left">Stack</th>
                  <SortTh label="Sec Score" sortKey="secureScore" current={sortKey} dir={sortDir} onSort={handleSort} />
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
                    <td className="px-3 py-2.5"><MarginPct pct={account.grossMarginPercent} /></td>
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
                      {(account.stackCompliance as any)?.secureScore != null ? (
                        <span className={cn("text-xs font-semibold tabular-nums",
                          (account.stackCompliance as any).secureScore >= 70 ? "text-green-600 dark:text-green-400" :
                          (account.stackCompliance as any).secureScore >= 40 ? "text-amber-600 dark:text-amber-400" :
                          "text-red-600 dark:text-red-400"
                        )}>
                          {(account.stackCompliance as any).secureScore}%
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
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
                  {/* Group header row */}
                  <tr className="border-b border-border/50">
                    <th className="sticky left-0 bg-background z-20 border-r" />
                    {STACK_TOOL_GROUPS.map(group => (
                      <th
                        key={group.key}
                        colSpan={group.tools.length}
                        className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-center text-muted-foreground/70 border-r last:border-r-0"
                        style={{ background: group.key === "endpoint" ? "hsl(var(--muted)/0.4)" : group.key === "mailbox" ? "hsl(var(--muted)/0.25)" : undefined }}
                      >
                        {group.label}
                      </th>
                    ))}
                    <th colSpan={2} />
                  </tr>
                  {/* Tool column header row */}
                  <tr>
                    <th
                      className="text-left px-3 py-2 text-xs font-medium text-muted-foreground sticky left-0 bg-background z-20 border-r min-w-[180px] cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleComplianceSort("companyName")}
                    >
                      <span className="flex items-center gap-1">
                        Company
                        <SortIcon active={complianceSortKey === "companyName"} dir={complianceSortDir} />
                      </span>
                    </th>
                    {STACK_TOOLS.map((tool) => {
                      const count = stackSummary.tools[tool.key];
                      const total = stackSummary.total;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const isLastInGroup = (() => {
                        const gTools = STACK_TOOL_GROUPS.find(g => g.key === tool.group)?.tools ?? [];
                        return gTools[gTools.length - 1]?.key === tool.key;
                      })();
                      return (
                        <th
                          key={tool.key}
                          className={cn("px-3 py-2 text-[10px] font-medium text-muted-foreground text-center whitespace-nowrap cursor-pointer hover:text-foreground select-none", isLastInGroup && "border-r")}
                          title={`${count} of ${total} clients have ${tool.label} — click to sort`}
                          onClick={() => handleComplianceSort(tool.key)}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="flex items-center gap-0.5">
                              {tool.abbr}
                              {!tool.required && <span className="text-[9px] text-muted-foreground/60 italic leading-none">opt</span>}
                              <SortIcon active={complianceSortKey === tool.key} dir={complianceSortDir} />
                            </span>
                            <span className={cn("font-semibold tabular-nums", pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground")}>
                              {count}/{total}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    <th
                      className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                      onClick={() => handleComplianceSort("secureScore")}
                    >
                      <span className="flex items-center justify-center gap-0.5">
                        Sec Score
                        <SortIcon active={complianceSortKey === "secureScore"} dir={complianceSortDir} />
                      </span>
                    </th>
                    <th
                      className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleComplianceSort("coverage")}
                    >
                      <span className="flex items-center justify-center gap-0.5">
                        Coverage
                        <SortIcon active={complianceSortKey === "coverage"} dir={complianceSortDir} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(account => {
                    const stack = account.stackCompliance as StackComplianceData | null;
                    const optedOut = stack?.optedOutTools ?? [];
                    const { pct } = getComplianceStats(stack);
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
                        {STACK_TOOLS.map(tool => {
                          const isLastInGroup = (() => {
                            const gTools = STACK_TOOL_GROUPS.find(g => g.key === tool.group)?.tools ?? [];
                            return gTools[gTools.length - 1]?.key === tool.key;
                          })();
                          return (
                            <td key={tool.key} className={cn("px-3 py-2 text-center", isLastInGroup && "border-r")}>
                              <StackDot
                                value={stack?.[tool.key] as boolean | null}
                                required={tool.required}
                                optedOut={optedOut.includes(tool.key as string)}
                              />
                            </td>
                          );
                        })}
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
