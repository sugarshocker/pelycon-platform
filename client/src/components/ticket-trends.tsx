import { useQuery } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { StatusDot } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, AlertTriangle, Clock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TicketSummary, Organization } from "@shared/schema";

interface TicketTrendsProps {
  client: Organization;
}

export function TicketTrends({ client }: TicketTrendsProps) {
  const { data, isLoading, error } = useQuery<TicketSummary>({
    queryKey: ["/api/tickets", client.id],
    enabled: !!client.id,
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-md" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-md" />
            <Skeleton className="h-20 rounded-md" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Unable to load ticket data.</p>
          <p className="text-xs mt-1">
            Check that ConnectWise is configured correctly.
          </p>
        </div>
      );
    }

    if (!data) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 px-6 py-3">
            <span className="text-3xl font-bold">{data.totalTickets}</span>
            <span className="text-xs text-muted-foreground">
              Support Requests (6 Months)
            </span>
          </div>
        </div>

        {data.monthlyVolume.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Monthly Volume</h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyVolume}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Tickets"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {data.topCategories.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Request Categories</h4>
            <div className="grid gap-2">
              {data.topCategories.map((cat, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2"
                >
                  <span className="text-sm">{cat.name}</span>
                  <Badge variant="secondary">{cat.count} tickets</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.recurringIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recurring Issues
            </h4>
            <div className="grid gap-2">
              {data.recurringIssues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status="warning" />
                    <span className="text-sm truncate">{issue.subject}</span>
                  </div>
                  <Badge variant="outline">{issue.count}x</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.oldOpenTickets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              Open Requests Over 30 Days
            </h4>
            <div className="grid gap-2">
              {data.oldOpenTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2"
                  data-testid={`ticket-old-${ticket.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status="action" />
                    <span className="text-sm truncate">{ticket.summary}</span>
                  </div>
                  <Badge variant="destructive" className="flex-shrink-0">
                    {ticket.ageDays} days
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <CollapsibleSection
      title="Support Requests"
      icon={<Ticket className="h-5 w-5" />}
      testId="section-tickets"
    >
      {renderContent()}
    </CollapsibleSection>
  );
}
