import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  FileText,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import type { ClientAccount } from "@shared/schema";

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

type ClientWithAR = ClientAccount & { arSummary?: ARSummary | null; effectiveTier?: string };

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

export default function Receivables() {
  const { data: accounts, isLoading } = useQuery<ClientWithAR[]>({ queryKey: ["/api/accounts"] });
  const [search, setSearch] = useState("");
  const [filterScore, setFilterScore] = useState("all");
  const [sortField, setSortField] = useState<SortField>("outstandingBalance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedAccount, setSelectedAccount] = useState<ClientWithAR | null>(null);

  const accountsWithAR = useMemo(() => {
    if (!accounts) return [];
    return accounts
      .filter(a => a.arSummary)
      .map(a => ({ ...a, ar: a.arSummary as ARSummary }));
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = accountsWithAR;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.companyName.toLowerCase().includes(q));
    }
    if (filterScore !== "all") {
      list = list.filter(a => a.ar.paymentScore === filterScore);
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
  }, [accountsWithAR, search, filterScore, sortField, sortDir]);

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
      <h1 className="text-2xl font-bold" data-testid="text-page-title">Accounts Receivable</h1>

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
        <span className="text-xs text-muted-foreground">{filtered.length} clients</span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader field="companyName">Company</SortHeader>
              <SortHeader field="paymentScore">Score</SortHeader>
              <SortHeader field="outstandingBalance">Outstanding</SortHeader>
              <SortHeader field="overdueBalance">Overdue</SortHeader>
              <SortHeader field="avgDaysToPay">Avg Days</SortHeader>
              <SortHeader field="onTimePercent">On-Time %</SortHeader>
              <TableHead className="py-2 px-2 text-xs">Aging</TableHead>
              <TableHead className="py-2 px-2 text-xs">Trend</TableHead>
              <SortHeader field="totalRevenue">Revenue</SortHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                {accountsWithAR.length === 0 ? "No AR data yet — run a sync to populate." : "No clients match your filters."}
              </TableCell></TableRow>
            ) : filtered.map((a) => (
              <TableRow
                key={a.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedAccount(a)}
                data-testid={`row-ar-${a.id}`}
              >
                <TableCell className="py-2 px-2 text-xs font-medium max-w-[200px] truncate" data-testid={`text-ar-company-${a.id}`}>
                  {a.companyName}
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
