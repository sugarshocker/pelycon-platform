import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowUpDown,
  FileText,
  CheckCircle2,
  XCircle,
  MinusCircle,
  X,
  Activity,
  BarChart3,
} from "lucide-react";
interface ReceivablesClient {
  id: number;
  cwCompanyId: number;
  companyName: string;
  agreementTypes: string | null;
  arSummary: any;
  lastSyncedAt: string | null;
  tier: string | null;
  totalRevenue: number | null;
  source: "managed" | "agreement-only";
}

interface ARAgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
}

interface ARInvoiceEntry {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  total: number;
  payments: number;
  balance: number;
  status: string;
  type: string;
  daysToPay: number | null;
  daysOverdue: number;
  paidDate: string | null;
}

interface ARSummary {
  outstandingBalance: number;
  overdueBalance: number;
  totalInvoiced18mo: number;
  totalPaid18mo: number;
  aging: ARAgingBuckets;
  agingCounts: ARAgingBuckets;
  avgDaysToPay: number | null;
  medianDaysToPay: number | null;
  onTimePercent: number | null;
  paymentScore: "A" | "B" | "C" | "D";
  paymentScoreLabel: string;
  invoiceCount: number;
  paidInvoiceCount: number;
  openInvoiceCount: number;
  recentInvoices: ARInvoiceEntry[];
  monthlyTrend: { month: string; onTimeCount: number; lateCount: number; onTimePercent: number }[];
  lastPaymentDate: string | null;
  fetchedAt: string;
}

type ClientWithAR = ReceivablesClient & { ar?: ARSummary };

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function formatCurrencyExact(val: number | null | undefined): string {
  if (val == null) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
}

function PaymentScoreBadge({ score, label }: { score: string; label?: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    A: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
    B: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
    C: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
    D: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
  };
  const c = config[score] || config.D;
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`} data-testid={`badge-score-${score}`}>
          {score}
        </span>
      </TooltipTrigger>
      {label && <TooltipContent>{label}</TooltipContent>}
    </Tooltip>
  );
}

function AgingBar({ aging, total }: { aging: ARAgingBuckets; total: number }) {
  if (total <= 0) return <span className="text-xs text-muted-foreground">No balance</span>;
  const segments = [
    { key: "current", label: "Current", value: aging.current, color: "bg-green-500" },
    { key: "1-30", label: "1-30 days", value: aging.days1to30, color: "bg-yellow-500" },
    { key: "31-60", label: "31-60 days", value: aging.days31to60, color: "bg-orange-500" },
    { key: "61-90", label: "61-90 days", value: aging.days61to90, color: "bg-red-400" },
    { key: "91+", label: "91+ days", value: aging.days91plus, color: "bg-red-600" },
  ];
  return (
    <div className="space-y-1">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        {segments.filter(s => s.value > 0).map(s => (
          <div
            key={s.key}
            className={`${s.color} rounded-sm`}
            style={{ width: `${Math.max((s.value / total) * 100, 2)}%` }}
            title={`${s.label}: ${formatCurrencyExact(s.value)}`}
          />
        ))}
      </div>
    </div>
  );
}

function TrendChart({ trend }: { trend: { month: string; onTimePercent: number; onTimeCount: number; lateCount: number }[] }) {
  if (trend.length === 0) return <span className="text-xs text-muted-foreground">No trend data</span>;
  const maxH = 48;
  return (
    <div className="flex items-end gap-1 h-14">
      {trend.map((t) => {
        const total = t.onTimeCount + t.lateCount;
        const h = total > 0 ? Math.max((t.onTimePercent / 100) * maxH, 4) : 4;
        const color = t.onTimePercent >= 80 ? "bg-green-500" : t.onTimePercent >= 50 ? "bg-yellow-500" : "bg-red-400";
        return (
          <Tooltip key={t.month}>
            <TooltipTrigger>
              <div className="flex flex-col items-center gap-0.5">
                <div className={`w-4 rounded-t-sm ${color}`} style={{ height: `${h}px` }} />
                <span className="text-[8px] text-muted-foreground leading-none">{formatMonth(t.month).split(" ")[0]}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">{formatMonth(t.month)}</div>
                <div>{t.onTimePercent}% on-time ({t.onTimeCount}/{total})</div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

type SortField = "companyName" | "outstandingBalance" | "overdueBalance" | "avgDaysToPay" | "paymentScore" | "onTimePercent" | "totalRevenue";

function ClientARDetail({ account, ar, open, onOpenChange }: { account: ClientWithAR; ar: ARSummary; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [invoiceTab, setInvoiceTab] = useState<"all" | "open" | "paid">("all");

  const filteredInvoices = ar.recentInvoices.filter(inv => {
    if (invoiceTab === "open") return inv.balance > 0;
    if (invoiceTab === "paid") return inv.balance === 0;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3" data-testid="text-ar-detail-title">
            {account.companyName}
            <PaymentScoreBadge score={ar.paymentScore} label={ar.paymentScoreLabel} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className="text-sm font-semibold" data-testid="text-ar-outstanding">{formatCurrency(ar.outstandingBalance)}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Overdue</div>
            <div className={`text-sm font-semibold ${ar.overdueBalance > 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-ar-overdue">
              {formatCurrency(ar.overdueBalance)}
            </div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Avg Days to Pay</div>
            <div className="text-sm font-semibold" data-testid="text-ar-avg-days">{ar.avgDaysToPay ?? "—"}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">On-Time %</div>
            <div className="text-sm font-semibold" data-testid="text-ar-ontime">{ar.onTimePercent != null ? `${ar.onTimePercent}%` : "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Aging Breakdown</div>
            <AgingBar aging={ar.aging} total={ar.outstandingBalance} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              {ar.aging.current > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" />Current: {formatCurrencyExact(ar.aging.current)}</span>}
              {ar.aging.days1to30 > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" />1–30: {formatCurrencyExact(ar.aging.days1to30)}</span>}
              {ar.aging.days31to60 > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />31–60: {formatCurrencyExact(ar.aging.days31to60)}</span>}
              {ar.aging.days61to90 > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" />61–90: {formatCurrencyExact(ar.aging.days61to90)}</span>}
              {ar.aging.days91plus > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-600" />91+: {formatCurrencyExact(ar.aging.days91plus)}</span>}
              {ar.outstandingBalance === 0 && <span className="text-muted-foreground">No outstanding balance</span>}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Payment Trend (Monthly On-Time %)</div>
            <TrendChart trend={ar.monthlyTrend} />
          </div>
        </div>

        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
          Invoices ({ar.invoiceCount} total, 18mo)
          <div className="flex gap-1 ml-auto">
            {(["all", "open", "paid"] as const).map(tab => (
              <Button
                key={tab}
                variant={invoiceTab === tab ? "default" : "outline"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setInvoiceTab(tab)}
                data-testid={`button-inv-tab-${tab}`}
              >
                {tab === "all" ? "All" : tab === "open" ? `Open (${ar.openInvoiceCount})` : `Paid (${ar.paidInvoiceCount})`}
              </Button>
            ))}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="py-1.5 px-2">Invoice</TableHead>
                <TableHead className="py-1.5 px-2">Date</TableHead>
                <TableHead className="py-1.5 px-2">Due</TableHead>
                <TableHead className="py-1.5 px-2">Type</TableHead>
                <TableHead className="py-1.5 px-2 text-right">Total</TableHead>
                <TableHead className="py-1.5 px-2 text-right">Balance</TableHead>
                <TableHead className="py-1.5 px-2 text-right">Days to Pay</TableHead>
                <TableHead className="py-1.5 px-2">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">No invoices</TableCell></TableRow>
              ) : filteredInvoices.map((inv) => (
                <TableRow key={inv.invoiceNumber} className="text-xs" data-testid={`row-invoice-${inv.invoiceNumber}`}>
                  <TableCell className="py-1.5 px-2 font-mono">#{inv.invoiceNumber}</TableCell>
                  <TableCell className="py-1.5 px-2">{formatDate(inv.date)}</TableCell>
                  <TableCell className="py-1.5 px-2">{formatDate(inv.dueDate)}</TableCell>
                  <TableCell className="py-1.5 px-2">{inv.type}</TableCell>
                  <TableCell className="py-1.5 px-2 text-right tabular-nums">{formatCurrencyExact(inv.total)}</TableCell>
                  <TableCell className={`py-1.5 px-2 text-right tabular-nums ${inv.balance > 0 ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                    {inv.balance > 0 ? formatCurrencyExact(inv.balance) : "—"}
                  </TableCell>
                  <TableCell className="py-1.5 px-2 text-right tabular-nums">
                    {inv.daysToPay != null ? (
                      <span className={inv.daysToPay > 35 ? "text-red-600 dark:text-red-400" : inv.daysToPay > 30 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}>
                        {inv.daysToPay}d
                      </span>
                    ) : inv.balance > 0 && inv.daysOverdue > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{inv.daysOverdue}d overdue</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="py-1.5 px-2">
                    {inv.balance === 0 ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />Paid</span>
                    ) : inv.daysOverdue > 0 ? (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><XCircle className="h-3 w-3" />Overdue</span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground"><MinusCircle className="h-3 w-3" />Open</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>Invoiced (18mo): {formatCurrency(ar.totalInvoiced18mo)}</span>
          <span>Paid: {formatCurrency(ar.totalPaid18mo)}</span>
          {ar.lastPaymentDate && <span>Last Payment: {formatDate(ar.lastPaymentDate)}</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type AccountWithAR = ClientWithAR & { ar: ARSummary };

const CLIENT_COLORS = [
  { line: "#f97316", fill: "rgba(249,115,22,0.15)", label: "text-orange-600 dark:text-orange-400" },
  { line: "#3b82f6", fill: "rgba(59,130,246,0.15)", label: "text-blue-600 dark:text-blue-400" },
  { line: "#8b5cf6", fill: "rgba(139,92,246,0.15)", label: "text-violet-600 dark:text-violet-400" },
  { line: "#10b981", fill: "rgba(16,185,129,0.15)", label: "text-emerald-600 dark:text-emerald-400" },
  { line: "#ec4899", fill: "rgba(236,72,153,0.15)", label: "text-pink-600 dark:text-pink-400" },
  { line: "#f59e0b", fill: "rgba(245,158,11,0.15)", label: "text-amber-600 dark:text-amber-400" },
];

interface PaymentEvent {
  date: string;
  amount: number;
  invoiceNumber: string;
  invoiceTotal: number;
  clientName: string;
  clientId: number;
  dueDate: string;
  daysToPay: number | null;
}

interface MonthlyPaymentSummary {
  month: string;
  paymentCount: number;
  paymentTotal: number;
  invoicedTotal: number;
  cumulativeBalance: number;
}

function buildCatchUpData(clients: AccountWithAR[]) {
  const allPayments: PaymentEvent[] = [];
  const clientMonthlyData = new Map<number, MonthlyPaymentSummary[]>();

  for (const client of clients) {
    const invoices = client.ar.recentInvoices;
    const monthMap = new Map<string, { paid: number; paidCount: number; invoiced: number }>();

    for (const inv of invoices) {
      const invMonthKey = inv.date.substring(0, 7);
      const existing = monthMap.get(invMonthKey) || { paid: 0, paidCount: 0, invoiced: 0 };
      existing.invoiced += inv.total;

      if (inv.paidDate && inv.balance === 0) {
        allPayments.push({
          date: inv.paidDate,
          amount: inv.payments,
          invoiceNumber: inv.invoiceNumber,
          invoiceTotal: inv.total,
          clientName: client.companyName,
          clientId: client.id,
          dueDate: inv.dueDate,
          daysToPay: inv.daysToPay,
        });
        const paidMonthKey = inv.paidDate.substring(0, 7);
        const paidBucket = monthMap.get(paidMonthKey) || { paid: 0, paidCount: 0, invoiced: 0 };
        paidBucket.paid += inv.payments;
        paidBucket.paidCount++;
        monthMap.set(paidMonthKey, paidBucket);
      }

      monthMap.set(invMonthKey, existing);
    }

    const now = new Date();
    const continuousMonths: string[] = [];
    for (let i = 17; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      continuousMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    let cumBalance = 0;
    const monthlySummaries: MonthlyPaymentSummary[] = continuousMonths.map(m => {
      const d = monthMap.get(m) || { paid: 0, paidCount: 0, invoiced: 0 };
      cumBalance += d.invoiced - d.paid;
      return {
        month: m,
        paymentCount: d.paidCount,
        paymentTotal: d.paid,
        invoicedTotal: d.invoiced,
        cumulativeBalance: Math.max(0, cumBalance),
      };
    });
    clientMonthlyData.set(client.id, monthlySummaries);
  }

  allPayments.sort((a, b) => a.date.localeCompare(b.date));
  return { allPayments, clientMonthlyData };
}

const PERIOD_OPTIONS = [3, 6, 9, 12] as const;
type PeriodMonths = typeof PERIOD_OPTIONS[number];

function CatchUpAnalysis({ clients, onClose }: { clients: AccountWithAR[]; onClose: () => void }) {
  const [period, setPeriod] = useState<PeriodMonths>(6);
  const [showLegend, setShowLegend] = useState(false);

  const { allPayments, clientMonthlyData } = useMemo(() => buildCatchUpData(clients), [clients]);

  const allMonths = useMemo(() => {
    const monthSet = new Set<string>();
    clientMonthlyData.forEach(summaries => summaries.forEach(s => monthSet.add(s.month)));
    return Array.from(monthSet).sort();
  }, [clientMonthlyData]);

  const recentMonths = allMonths.slice(-(period * 2));

  const velocityAnalysis = useMemo(() => {
    return clients.map((client, idx) => {
      const monthly = clientMonthlyData.get(client.id) || [];
      const last = monthly.slice(-period);
      const prior = monthly.slice(-(period * 2), -period);

      const recentPayments = last.reduce((s, m) => s + m.paymentCount, 0);
      const recentPaid = last.reduce((s, m) => s + m.paymentTotal, 0);
      const priorPayments = prior.reduce((s, m) => s + m.paymentCount, 0);
      const priorPaid = prior.reduce((s, m) => s + m.paymentTotal, 0);

      const recentAvgPerMonth = last.length > 0 ? recentPayments / last.length : 0;
      const priorAvgPerMonth = prior.length > 0 ? priorPayments / prior.length : 0;

      const frequencyChange = priorAvgPerMonth > 0
        ? ((recentAvgPerMonth - priorAvgPerMonth) / priorAvgPerMonth) * 100
        : recentAvgPerMonth > 0 ? 100 : 0;

      const recentAvgAmount = recentPayments > 0 ? recentPaid / recentPayments : 0;
      const priorAvgAmount = priorPayments > 0 ? priorPaid / priorPayments : 0;

      const balanceStart = monthly.length >= period ? monthly[monthly.length - period]?.cumulativeBalance ?? 0 : 0;
      const balanceEnd = monthly.length > 0 ? monthly[monthly.length - 1]?.cumulativeBalance ?? 0 : 0;
      const balanceTrend = balanceStart > 0 ? ((balanceEnd - balanceStart) / balanceStart) * 100 : 0;

      const isCatchingUp = frequencyChange > 10 || balanceTrend < -10;
      const isFallingBehind = frequencyChange < -20 && balanceTrend > 10;

      return {
        client,
        colorIdx: idx % CLIENT_COLORS.length,
        recentPayments,
        recentPaid,
        priorPayments,
        priorPaid,
        recentAvgPerMonth: Math.round(recentAvgPerMonth * 10) / 10,
        priorAvgPerMonth: Math.round(priorAvgPerMonth * 10) / 10,
        frequencyChange: Math.round(frequencyChange),
        recentAvgAmount,
        priorAvgAmount,
        balanceStart,
        balanceEnd,
        balanceTrend: Math.round(balanceTrend),
        isCatchingUp,
        isFallingBehind,
      };
    });
  }, [clients, clientMonthlyData, period]);

  const chartMaxBalance = useMemo(() => {
    let max = 0;
    clientMonthlyData.forEach(summaries => {
      summaries.forEach(s => { if (s.cumulativeBalance > max) max = s.cumulativeBalance; });
    });
    return max || 1;
  }, [clientMonthlyData]);

  const chartMaxPayments = useMemo(() => {
    let max = 0;
    clientMonthlyData.forEach(summaries => {
      summaries.forEach(s => { if (s.paymentTotal > max) max = s.paymentTotal; });
    });
    return max || 1;
  }, [clientMonthlyData]);

  return (
    <Card className="p-4 space-y-5 border-2 border-orange-200 dark:border-orange-900/50">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold" data-testid="text-catchup-title">Catch-Up Analysis</h2>
          <span className="text-xs text-muted-foreground">
            {clients.length} client{clients.length !== 1 ? "s" : ""} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md overflow-hidden" data-testid="toggle-period">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${period === p ? "bg-orange-500 text-white" : "bg-background hover:bg-muted text-muted-foreground"}`}
                data-testid={`button-period-${p}`}
              >
                {p}mo
              </button>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowLegend(!showLegend)}
                data-testid="button-toggle-legend"
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>How status labels are determined</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-catchup">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showLegend && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-2 text-xs" data-testid="legend-panel">
          <div className="font-medium text-sm">How are status labels determined?</div>
          <div className="text-muted-foreground">
            Compares the <span className="font-medium text-foreground">recent {period} months</span> against the <span className="font-medium text-foreground">prior {period} months</span> on two measures:
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shrink-0">
                <TrendingUp className="h-3 w-3" /> Catching Up
              </span>
              <span className="text-muted-foreground">Payment frequency increased by 10%+ <span className="font-medium text-foreground">or</span> outstanding balance decreased by 10%+</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 shrink-0">
                <TrendingDown className="h-3 w-3" /> Falling Behind
              </span>
              <span className="text-muted-foreground">Payment frequency dropped by 20%+ <span className="font-medium text-foreground">and</span> balance grew by 10%+</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
                <MinusCircle className="h-3 w-3" /> Steady
              </span>
              <span className="text-muted-foreground">No significant change in either direction</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        {clients.map((c, i) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{ borderColor: CLIENT_COLORS[i % CLIENT_COLORS.length].line }}
            data-testid={`badge-catchup-client-${c.id}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLIENT_COLORS[i % CLIENT_COLORS.length].line }} />
            {c.companyName}
            <PaymentScoreBadge score={c.ar.paymentScore} />
          </span>
        ))}
      </div>

      {velocityAnalysis.map((v) => (
        <Card key={v.client.id} className="p-3 space-y-3" data-testid={`card-velocity-${v.client.id}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CLIENT_COLORS[v.colorIdx].line }} />
              <span className="font-medium text-sm">{v.client.companyName}</span>
              {v.isCatchingUp && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" data-testid={`badge-catching-up-${v.client.id}`}>
                  <TrendingUp className="h-3 w-3" /> Catching Up
                </span>
              )}
              {v.isFallingBehind && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" data-testid={`badge-falling-behind-${v.client.id}`}>
                  <TrendingDown className="h-3 w-3" /> Falling Behind
                </span>
              )}
              {!v.isCatchingUp && !v.isFallingBehind && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  Steady
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Outstanding: <span className="font-medium text-foreground">{formatCurrency(v.client.ar.outstandingBalance)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="border rounded-md p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Payment Freq (recent {period}mo)</div>
              <div className="text-sm font-semibold">{v.recentAvgPerMonth}/mo</div>
              <div className={`text-[10px] ${v.frequencyChange > 0 ? "text-green-600 dark:text-green-400" : v.frequencyChange < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                {v.frequencyChange > 0 ? "+" : ""}{v.frequencyChange}% vs prior
              </div>
            </div>
            <div className="border rounded-md p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Recent {period}mo Paid</div>
              <div className="text-sm font-semibold">{formatCurrency(v.recentPaid)}</div>
              <div className="text-[10px] text-muted-foreground">{v.recentPayments} payments</div>
            </div>
            <div className="border rounded-md p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Prior {period}mo Paid</div>
              <div className="text-sm font-semibold">{formatCurrency(v.priorPaid)}</div>
              <div className="text-[10px] text-muted-foreground">{v.priorPayments} payments</div>
            </div>
            <div className="border rounded-md p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Balance Trend ({period}mo)</div>
              <div className={`text-sm font-semibold ${v.balanceTrend < 0 ? "text-green-600 dark:text-green-400" : v.balanceTrend > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {v.balanceTrend > 0 ? "+" : ""}{v.balanceTrend}%
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatCurrency(v.balanceStart)} → {formatCurrency(v.balanceEnd)}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">Monthly Payments vs Running Balance</div>
            <div className="flex items-end gap-0.5 h-24 border-b border-l relative pl-8">
              <div className="absolute left-0 top-0 text-[8px] text-muted-foreground">{formatCurrency(chartMaxBalance)}</div>
              <div className="absolute left-0 bottom-0 text-[8px] text-muted-foreground">$0</div>
              {recentMonths.map((month) => {
                const data = (clientMonthlyData.get(v.client.id) || []).find(s => s.month === month);
                const balH = data ? (data.cumulativeBalance / chartMaxBalance) * 100 : 0;
                const payH = data ? (data.paymentTotal / chartMaxPayments) * 100 : 0;
                return (
                  <Tooltip key={month}>
                    <TooltipTrigger asChild>
                      <div className="flex-1 flex flex-col items-center justify-end h-full relative">
                        <div className="absolute bottom-0 w-full rounded-t-sm opacity-20" style={{ height: `${balH}%`, backgroundColor: CLIENT_COLORS[v.colorIdx].line }} />
                        <div className="relative w-3/4 rounded-t-sm" style={{ height: `${Math.max(payH, data?.paymentTotal ? 3 : 0)}%`, backgroundColor: CLIENT_COLORS[v.colorIdx].line }} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-0.5">
                        <div className="font-medium">{formatMonth(month)}</div>
                        {data ? (
                          <>
                            <div>Payments: {formatCurrency(data.paymentTotal)} ({data.paymentCount}x)</div>
                            <div>Invoiced: {formatCurrency(data.invoicedTotal)}</div>
                            <div>Running Balance: {formatCurrency(data.cumulativeBalance)}</div>
                          </>
                        ) : <div>No activity</div>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="flex gap-0.5 pl-8">
              {recentMonths.map(m => (
                <div key={m} className="flex-1 text-center text-[7px] text-muted-foreground">{formatMonth(m).split(" ")[0]}</div>
              ))}
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: CLIENT_COLORS[v.colorIdx].line }} /> Payments
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-sm opacity-20" style={{ backgroundColor: CLIENT_COLORS[v.colorIdx].line }} /> Running Balance
              </span>
            </div>
          </div>

          {allPayments.filter(p => p.clientId === v.client.id).length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-medium">Recent Payment Activity</div>
              <div className="max-h-32 overflow-y-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-1 px-2 font-medium">Paid Date</th>
                      <th className="text-left py-1 px-2 font-medium">Invoice</th>
                      <th className="text-right py-1 px-2 font-medium">Amount</th>
                      <th className="text-right py-1 px-2 font-medium">Days to Pay</th>
                      <th className="text-left py-1 px-2 font-medium">Timing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments
                      .filter(p => p.clientId === v.client.id)
                      .slice(-15)
                      .reverse()
                      .map((p, i) => {
                        const onTime = p.daysToPay != null && p.daysToPay <= 35;
                        return (
                          <tr key={`${p.invoiceNumber}-${i}`} className="border-b last:border-0" data-testid={`row-payment-${p.invoiceNumber}`}>
                            <td className="py-1 px-2">{formatDate(p.date)}</td>
                            <td className="py-1 px-2 font-mono">#{p.invoiceNumber}</td>
                            <td className="py-1 px-2 text-right tabular-nums font-medium">{formatCurrencyExact(p.amount)}</td>
                            <td className="py-1 px-2 text-right tabular-nums">
                              {p.daysToPay != null ? `${p.daysToPay}d` : "—"}
                            </td>
                            <td className="py-1 px-2">
                              {p.daysToPay != null ? (
                                onTime ? (
                                  <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" />On time</span>
                                ) : (
                                  <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5"><XCircle className="h-3 w-3" />Late</span>
                                )
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      ))}

      {allPayments.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-6">
          No payment history available for the selected client{clients.length > 1 ? "s" : ""}.
        </div>
      )}

      <div className="text-[10px] text-muted-foreground italic">
        Payment dates are approximated from invoice last-updated timestamps. Velocity comparisons use continuous {period}-month windows. Data covers trailing 18 months.
      </div>
    </Card>
  );
}

export default function Receivables() {
  const { data: accounts, isLoading } = useQuery<ReceivablesClient[]>({ queryKey: ["/api/receivables/clients"] });
  const [search, setSearch] = useState("");
  const [filterScore, setFilterScore] = useState("all");
  const [filterSource, setFilterSource] = useState<"all" | "managed" | "agreement-only">("all");
  const [sortField, setSortField] = useState<SortField>("outstandingBalance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedAccount, setSelectedAccount] = useState<ClientWithAR | null>(null);
  const [catchUpIds, setCatchUpIds] = useState<Set<number>>(new Set());

  const toggleCatchUp = useCallback((id: number) => {
    setCatchUpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  }, []);

  const accountsWithAR: (ReceivablesClient & { ar: ARSummary })[] = useMemo(() => {
    if (!accounts) return [];
    return accounts
      .filter(a => a.arSummary)
      .map(a => ({ ...a, ar: a.arSummary as ARSummary }));
  }, [accounts]);

  const catchUpClients = useMemo(() => {
    return accountsWithAR.filter(a => catchUpIds.has(a.id));
  }, [accountsWithAR, catchUpIds]);

  const filtered = useMemo(() => {
    let list = accountsWithAR;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.companyName.toLowerCase().includes(q));
    }
    if (filterScore !== "all") {
      list = list.filter(a => a.ar.paymentScore === filterScore);
    }
    if (filterSource !== "all") {
      list = list.filter(a => a.source === filterSource);
    }
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "companyName": cmp = a.companyName.localeCompare(b.companyName); break;
        case "outstandingBalance": cmp = (a.ar.outstandingBalance) - (b.ar.outstandingBalance); break;
        case "overdueBalance": cmp = (a.ar.overdueBalance) - (b.ar.overdueBalance); break;
        case "avgDaysToPay": cmp = (a.ar.avgDaysToPay ?? 999) - (b.ar.avgDaysToPay ?? 999); break;
        case "paymentScore": cmp = a.ar.paymentScore.localeCompare(b.ar.paymentScore); break;
        case "onTimePercent": cmp = (a.ar.onTimePercent ?? -1) - (b.ar.onTimePercent ?? -1); break;
        case "totalRevenue": cmp = (a.totalRevenue ?? 0) - (b.totalRevenue ?? 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [accountsWithAR, search, filterScore, filterSource, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const portfolio = useMemo(() => {
    const all = accountsWithAR;
    return {
      totalOutstanding: all.reduce((s, a) => s + a.ar.outstandingBalance, 0),
      totalOverdue: all.reduce((s, a) => s + a.ar.overdueBalance, 0),
      avgDaysToPay: (() => {
        const vals = all.filter(a => a.ar.avgDaysToPay != null).map(a => a.ar.avgDaysToPay!);
        return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      })(),
      scoreA: all.filter(a => a.ar.paymentScore === "A").length,
      scoreB: all.filter(a => a.ar.paymentScore === "B").length,
      scoreC: all.filter(a => a.ar.paymentScore === "C").length,
      scoreD: all.filter(a => a.ar.paymentScore === "D").length,
      totalClients: all.length,
      managedCount: all.filter(a => a.source === "managed").length,
      agreementOnlyCount: all.filter(a => a.source === "agreement-only").length,
      portfolioAging: {
        current: all.reduce((s, a) => s + a.ar.aging.current, 0),
        days1to30: all.reduce((s, a) => s + a.ar.aging.days1to30, 0),
        days31to60: all.reduce((s, a) => s + a.ar.aging.days31to60, 0),
        days61to90: all.reduce((s, a) => s + a.ar.aging.days61to90, 0),
        days91plus: all.reduce((s, a) => s + a.ar.aging.days91plus, 0),
      },
    };
  }, [accountsWithAR]);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Accounts Receivable</h1>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-lg" />)}</div>
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none py-2 px-2"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1 text-xs">
        {children}
        {sortField === field ? (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  const totalAgingSum = portfolio.totalOutstanding;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Accounts Receivable</h1>
        <span className="text-xs text-muted-foreground">
          {portfolio.totalClients} clients ({portfolio.managedCount} managed, {portfolio.agreementOnlyCount} agreement-only)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            Total Outstanding
          </div>
          <div className="text-lg font-semibold" data-testid="text-total-outstanding">{formatCurrency(portfolio.totalOutstanding)}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Total Overdue
          </div>
          <div className={`text-lg font-semibold ${portfolio.totalOverdue > 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-total-overdue">
            {formatCurrency(portfolio.totalOverdue)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            Avg Days to Pay
          </div>
          <div className="text-lg font-semibold" data-testid="text-avg-days-to-pay">
            {portfolio.avgDaysToPay != null ? `${portfolio.avgDaysToPay} days` : "—"}
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Payment Health
          </div>
          <div className="flex items-center gap-1.5 text-sm" data-testid="text-payment-health">
            <span className="text-green-600 dark:text-green-400 font-semibold">{portfolio.scoreA}A</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{portfolio.scoreB}B</span>
            <span className="text-orange-600 dark:text-orange-400 font-semibold">{portfolio.scoreC}C</span>
            {portfolio.scoreD > 0 && <span className="text-red-600 dark:text-red-400 font-semibold">{portfolio.scoreD}D</span>}
          </div>
        </Card>
      </div>

      {totalAgingSum > 0 && (
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Portfolio Aging</div>
          <AgingBar aging={portfolio.portfolioAging} total={totalAgingSum} />
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" />Current: {formatCurrency(portfolio.portfolioAging.current)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" />1–30 days: {formatCurrency(portfolio.portfolioAging.days1to30)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />31–60 days: {formatCurrency(portfolio.portfolioAging.days31to60)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" />61–90 days: {formatCurrency(portfolio.portfolioAging.days61to90)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-600" />91+ days: {formatCurrency(portfolio.portfolioAging.days91plus)}</span>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs w-48"
            data-testid="input-search-ar"
          />
        </div>
        <Select value={filterScore} onValueChange={setFilterScore}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-score-filter">
            <SelectValue placeholder="All Scores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="A">A — Excellent</SelectItem>
            <SelectItem value="B">B — Good</SelectItem>
            <SelectItem value="C">C — Slow</SelectItem>
            <SelectItem value="D">D — At Risk</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={(v) => setFilterSource(v as any)}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-source-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="managed">Managed Services</SelectItem>
            <SelectItem value="agreement-only">Agreement Only</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} clients</span>
        {catchUpIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">{catchUpIds.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCatchUpIds(new Set())}
              data-testid="button-clear-selection"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {catchUpClients.length > 0 && (
        <CatchUpAnalysis
          clients={catchUpClients}
          onClose={() => setCatchUpIds(new Set())}
        />
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-1.5 px-0.5">
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-primary/60" />
          Click any row to view invoices &amp; AR detail
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <BarChart3 className="h-3.5 w-3.5 text-primary/60" />
          Check <strong className="font-semibold text-foreground">Compare</strong> on up to 6 clients to analyze payment trends side-by-side
        </span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2 px-2 w-16">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-default">
                      <BarChart3 className="h-3 w-3" />
                      Compare
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Check up to 6 clients to compare payment trends side-by-side</TooltipContent>
                </Tooltip>
              </TableHead>
              <SortHeader field="companyName">Company</SortHeader>
              <SortHeader field="paymentScore">Score</SortHeader>
              <SortHeader field="outstandingBalance">Outstanding</SortHeader>
              <SortHeader field="overdueBalance">Overdue</SortHeader>
              <SortHeader field="avgDaysToPay">Avg Days</SortHeader>
              <SortHeader field="onTimePercent">On-Time %</SortHeader>
              <TableHead className="py-2 px-2 text-xs">Aging</TableHead>
              <TableHead className="py-2 px-2 text-xs">Trend</TableHead>
              <SortHeader field="totalRevenue">Revenue</SortHeader>
              <TableHead className="py-2 px-2 w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
                {accountsWithAR.length === 0 ? "No AR data yet — run a sync to populate." : "No clients match your filters."}
              </TableCell></TableRow>
            ) : filtered.map((a) => (
              <TableRow
                key={a.id}
                className={`group cursor-pointer hover:bg-muted/50 transition-colors ${catchUpIds.has(a.id) ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                onClick={() => setSelectedAccount(a)}
                data-testid={`row-ar-${a.id}`}
              >
                <TableCell className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Checkbox
                          checked={catchUpIds.has(a.id)}
                          onCheckedChange={() => toggleCatchUp(a.id)}
                          disabled={!catchUpIds.has(a.id) && catchUpIds.size >= 6}
                          data-testid={`checkbox-catchup-${a.id}`}
                        />
                      </div>
                    </TooltipTrigger>
                    {!catchUpIds.has(a.id) && catchUpIds.size >= 6 && (
                      <TooltipContent>Max 6 clients — deselect one first</TooltipContent>
                    )}
                  </Tooltip>
                </TableCell>
                <TableCell className="py-2 px-2 text-xs font-medium max-w-[240px]" data-testid={`text-ar-company-${a.id}`}>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{a.companyName}</span>
                    {a.source === "agreement-only" && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">AGR</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2 px-2">
                  <PaymentScoreBadge score={a.ar.paymentScore} label={a.ar.paymentScoreLabel} />
                </TableCell>
                <TableCell className="py-2 px-2 text-xs tabular-nums font-medium" data-testid={`text-ar-balance-${a.id}`}>
                  {a.ar.outstandingBalance > 0 ? formatCurrency(a.ar.outstandingBalance) : <span className="text-green-600 dark:text-green-400">$0</span>}
                </TableCell>
                <TableCell className={`py-2 px-2 text-xs tabular-nums ${a.ar.overdueBalance > 0 ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                  {a.ar.overdueBalance > 0 ? formatCurrency(a.ar.overdueBalance) : "—"}
                </TableCell>
                <TableCell className="py-2 px-2 text-xs tabular-nums">
                  {a.ar.avgDaysToPay != null ? (
                    <span className={a.ar.avgDaysToPay > 45 ? "text-red-600 dark:text-red-400" : a.ar.avgDaysToPay > 30 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}>
                      {a.ar.avgDaysToPay}d
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="py-2 px-2 text-xs tabular-nums">
                  {a.ar.onTimePercent != null ? (
                    <span className={a.ar.onTimePercent >= 80 ? "text-green-600 dark:text-green-400" : a.ar.onTimePercent >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>
                      {a.ar.onTimePercent}%
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="py-2 px-2 w-28">
                  <AgingBar aging={a.ar.aging} total={a.ar.outstandingBalance} />
                </TableCell>
                <TableCell className="py-2 px-2 w-32">
                  <TrendChart trend={a.ar.monthlyTrend.slice(-6)} />
                </TableCell>
                <TableCell className="py-2 px-2 text-xs tabular-nums">
                  {formatCurrency(a.totalRevenue)}
                </TableCell>
                <TableCell className="py-2 px-2 w-8">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedAccount && selectedAccount.arSummary && (
        <ClientARDetail
          account={selectedAccount}
          ar={selectedAccount.arSummary as ARSummary}
          open={!!selectedAccount}
          onOpenChange={(v) => { if (!v) setSelectedAccount(null); }}
        />
      )}
    </div>
  );
}
