import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, FileText, DollarSign, Clock, ExternalLink, RefreshCw, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface QuoterQuote {
  id: string;
  name: string;
  status: string;
  draft: boolean;
  total: number | null;
  oneTimeTotal: number | null;
  monthlyTotal: number | null;
  annualTotal: number | null;
  organization: string;
  contactId: string;
  createdAt: string;
  modifiedAt: string;
  expiredAt: string | null;
  emailStatus: string | null;
  connectwiseOpportunityId: string | null;
  number: string;
}

interface QuoterSummary {
  activeQuotes: QuoterQuote[];
  activeCount: number;
  activeValue: number;
  olderActiveCount: number;
  quotesThisMonth: number;
  wonThisMonth: number;
  wonThisMonthValue: number;
  recentQuotes: QuoterQuote[];
}

function fmt$(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try { return format(parseISO(s), "MMM d, yyyy"); } catch { return s; }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted") return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">Won</Badge>;
  if (status === "pending") return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs">Pending</Badge>;
  if (status === "declined") return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">Declined</Badge>;
  if (status === "expired") return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-xs">Expired</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

function EmailBadge({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "clicked") return <span className="text-xs text-green-600 dark:text-green-400">Clicked</span>;
  if (status === "opened") return <span className="text-xs text-blue-600 dark:text-blue-400">Opened</span>;
  if (status === "sent") return <span className="text-xs text-muted-foreground">Sent</span>;
  return <span className="text-xs text-muted-foreground">{status}</span>;
}

function QuoteRow({ q }: { q: QuoterQuote }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0 text-sm" data-testid={`quote-row-${q.id}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{q.name}</div>
        <div className="text-xs text-muted-foreground truncate">{q.organization}</div>
      </div>
      <div className="text-right shrink-0 w-28">
        <div className="font-semibold">{fmt$(q.total)}</div>
        <div className="text-xs text-muted-foreground">{fmtDate(q.createdAt)}</div>
      </div>
      <div className="shrink-0 w-20 text-right">
        <StatusBadge status={q.status} />
        <div className="mt-0.5"><EmailBadge status={q.emailStatus} /></div>
      </div>
    </div>
  );
}

export default function Sales() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<QuoterSummary>({
    queryKey: ["/api/sales/quotes"],
    staleTime: 5 * 60 * 1000,
  });

  const monthName = format(new Date(), "MMMM");

  const statCards = [
    {
      icon: FileText,
      label: "Active Quotes",
      value: isLoading ? null : (data?.activeCount ?? 0),
      display: isLoading ? null : String(data?.activeCount ?? 0),
      sub: "Currently pending approval",
      color: "text-blue-500",
    },
    {
      icon: Clock,
      label: "Quotes This Month",
      value: isLoading ? null : (data?.quotesThisMonth ?? 0),
      display: isLoading ? null : String(data?.quotesThisMonth ?? 0),
      sub: `Created in ${monthName}`,
      color: "text-purple-500",
    },
    {
      icon: DollarSign,
      label: "Pipeline Value",
      value: isLoading ? null : (data?.activeValue ?? 0),
      display: isLoading ? null : fmt$(data?.activeValue ?? 0),
      sub: "Total value of active quotes",
      color: "text-primary",
    },
    {
      icon: TrendingUp,
      label: `Won in ${monthName}`,
      value: isLoading ? null : (data?.wonThisMonthValue ?? 0),
      display: isLoading ? null : fmt$(data?.wonThisMonthValue ?? 0),
      sub: `${data?.wonThisMonth ?? 0} quote${(data?.wonThisMonth ?? 0) === 1 ? "" : "s"} accepted`,
      color: "text-green-500",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live quote data from Quoter</p>
        </div>
        <div className="flex items-center gap-2">
          {isError && (
            <Badge variant="outline" className="gap-1.5 text-red-600 border-red-400 bg-red-50 dark:bg-red-950/30">
              <AlertCircle className="h-3.5 w-3.5" />
              Error loading data
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-quotes"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" asChild data-testid="button-open-quoter">
            <a href="https://pelycon.quoter.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Open Quoter
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, display, sub, color }) => (
          <Card key={label} data-testid={`card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-24 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold mt-1">{display}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
                <div className={`${color} opacity-70`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Circle className="h-4 w-4 text-blue-500 fill-blue-100 dark:fill-blue-900/50" />
                Outstanding Quotes
                {!isLoading && data && (
                  <Badge variant="secondary" className="text-xs font-normal">{data.activeCount}</Badge>
                )}
              </CardTitle>
              {!isLoading && data && (
                <p className="text-xs text-muted-foreground">Last 12 months{data.olderActiveCount > 0 ? ` · ${data.olderActiveCount} older quote${data.olderActiveCount === 1 ? "" : "s"} not shown` : ""}</p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : isError ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {(error as Error)?.message || "Failed to load quotes"}
              </div>
            ) : data?.activeQuotes.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No outstanding quotes right now
              </div>
            ) : (
              <div className="divide-y">
                {data!.activeQuotes.slice(0, 10).map(q => (
                  <QuoteRow key={q.id} q={q} />
                ))}
                {data!.activeQuotes.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-3">
                    +{data!.activeQuotes.length - 10} more — view in Quoter
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Recent Quote Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : isError ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Failed to load quote activity
              </div>
            ) : (
              <div className="divide-y">
                {(data?.recentQuotes || []).slice(0, 10).map(q => (
                  <QuoteRow key={q.id} q={q} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
