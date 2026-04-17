import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

const PRIORITY_COLORS: Record<string, string> = { urgent: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#16a34a" };

export function TrendsAnalysis() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/portal/trends"], queryFn: () => authFetch("/api/portal/trends") });
  const d = data as any;

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-8">Loading trends...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#394442] dark:text-white">Trends & Analysis</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Tickets (12 months)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-[#394442] dark:text-white">{d?.totalTickets ?? "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Currently Open</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-[#394442] dark:text-white">{d?.openTickets ?? "—"}</div></CardContent>
        </Card>
      </div>

      {/* Monthly volume chart */}
      {d?.monthlyVolume?.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Ticket Volume (Last 12 Months)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.monthlyVolume} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="count" fill="#E77125" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top categories */}
      {d?.topCategories?.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Top Ticket Categories</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(d.topCategories as any[]).map((cat: any, i: number) => {
                const maxCount = d.topCategories[0]?.count || 1;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-36 text-xs text-[#394442] dark:text-gray-200 truncate">{cat.name}</div>
                    <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#E77125] rounded-full transition-all"
                        style={{ width: `${(cat.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground w-8 text-right">{cat.count}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations */}
      {d?.recommendations?.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Recommendations from Your Last Review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(d.recommendations as any[]).map((rec: any, i: number) => (
              <div key={i} className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-[#394442] dark:text-white">{rec.title}</div>
                  <Badge style={{ backgroundColor: PRIORITY_COLORS[rec.priority] || "#6b7280", color: "white" }} className="text-[10px] flex-shrink-0">
                    {rec.priority}
                  </Badge>
                </div>
                {rec.businessImpact && <div className="text-xs text-muted-foreground mt-1">{rec.businessImpact}</div>}
              </div>
            ))}
            {d?.dataAsOf && (
              <p className="text-[10px] text-muted-foreground">Based on review from {new Date(d.dataAsOf).toLocaleDateString()}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
