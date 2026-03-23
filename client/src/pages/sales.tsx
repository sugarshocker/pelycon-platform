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
  stage: string;
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
  awaitingQuotes: QuoterQuote[];
  awaitingCount: number;
  awaitingValue: number;
  needsActionQuotes: QuoterQuote[];
  needsActionCount: number;
  needsActionValue: number;
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

function StageBadge({ stage }: { stage: string }) {
  if (stage === "Won - Accepted" || stage === "Won - Ordered" || stage === "Won - Fulfilled")
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Sent - Clicked")
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Sent - Opened")
    return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Sent - Delivered" || stage === "Sent - Pending")
    return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Sent - Undeliverable")
    return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Published")
    return <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Expired")
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Draft")
    return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  if (stage === "Lost")
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
  return <Badge variant="secondary" className="text-[10px] px-1.5 whitespace-nowrap">{stage}</Badge>;
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
      <div className="shrink-0 w-32 text-right">
        <StageBadge stage={q.stage} />
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
      label: "Awaiting Decision",
      value: isLoading ? null : (data?.awaitingCount ?? 0),
      display: isLoading ? null : String(data?.awaitingCount ?? 0),
      sub: "Sent to client, waiting for response",
      color: "text-blue-500",
    },
    {
      icon: Clock,
      label: "Needs Follow-Up",
      value: isLoading ? null : (data?.needsActionCount ?? 0),
      display: isLoading ? null : String(data?.needsActionCount ?? 0),
      sub: "Draft quotes not yet sent",
      color: "text-amber-500",
    },
    {
      icon: DollarSign,
      label: "Pipeline Value",
      value: isLoading ? null : (data?.awaitingValue ?? 0),
      display: isLoading ? null : fmt$(data?.awaitingValue ?? 0),
      sub: "Sent + expired quotes awaiting decision",
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
                Awaiting Decision
                {!isLoading && data && (
                  <Badge variant="secondary" className="text-xs font-normal">{data.awaitingCount}</Badge>
                )}
              </CardTitle>
              {!isLoading && data && (
                <p className="text-xs text-muted-foreground">Sent to client, no response yet</p>
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
            ) : (data?.awaitingQuotes ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No quotes awaiting decision
              </div>
            ) : (
              <div className="divide-y">
                {data!.awaitingQuotes.slice(0, 10).map(q => (
                  <QuoteRow key={q.id} q={q} />
                ))}
                {data!.awaitingQuotes.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-3">
                    +{data!.awaitingQuotes.length - 10} more — view in Quoter
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Needs Follow-Up
                {!isLoading && data && (
                  <Badge variant="secondary" className="text-xs font-normal">{data.needsActionCount}</Badge>
                )}
              </CardTitle>
              {!isLoading && data && (
                <p className="text-xs text-muted-foreground">Draft quotes</p>
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
                Failed to load quotes
              </div>
            ) : (data?.needsActionQuotes ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No expired or draft quotes
              </div>
            ) : (
              <div className="divide-y">
                {data!.needsActionQuotes.slice(0, 10).map(q => (
                  <QuoteRow key={q.id} q={q} />
                ))}
                {data!.needsActionQuotes.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-3">
                    +{data!.needsActionQuotes.length - 10} more — view in Quoter
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
