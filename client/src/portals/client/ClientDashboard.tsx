import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, Receipt, ShieldCheck, Monitor, Plus, ExternalLink } from "lucide-react";
import { PizzaTracker } from "./PizzaTracker";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

export function ClientDashboard() {
  const [, setLocation] = useLocation();

  const { data: tickets = [] } = useQuery({ queryKey: ["/api/portal/tickets"], queryFn: () => authFetch("/api/portal/tickets?status=open&limit=5") });
  const { data: invoiceSummary } = useQuery({ queryKey: ["/api/portal/invoices/summary"], queryFn: () => authFetch("/api/portal/invoices/summary") });
  const { data: security } = useQuery({ queryKey: ["/api/portal/security"], queryFn: () => authFetch("/api/portal/security") });
  const { data: assets } = useQuery({ queryKey: ["/api/portal/assets"], queryFn: () => authFetch("/api/portal/assets") });
  const { data: announcements = [] } = useQuery({ queryKey: ["/api/portal/announcements"], queryFn: () => authFetch("/api/portal/announcements") });

  const waitingOnYou = (tickets as any[]).filter((t: any) => t.status === "waiting_client").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#394442] dark:text-white">Dashboard</h1>
        <Button onClick={() => setLocation("/portal/tickets/new")} className="bg-[#E77125] hover:bg-[#E77125]/90 text-white gap-2">
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/portal/tickets")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Ticket className="h-3.5 w-3.5" /> Open Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#394442] dark:text-white">{(tickets as any[]).length}</div>
            {waitingOnYou > 0 && (
              <Badge variant="destructive" className="mt-1 text-[10px]">{waitingOnYou} need your reply</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/portal/invoices")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5" /> Outstanding Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#394442] dark:text-white">
              {invoiceSummary ? `$${(invoiceSummary as any).outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
            </div>
            {(invoiceSummary as any)?.outstanding > 0 && (
              <a href="https://pay.pelycon.com" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-[#E77125] mt-1 hover:underline" onClick={e => e.stopPropagation()}>
                Pay now <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/portal/security")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#394442] dark:text-white">
              {(security as any)?.secureScore != null ? `${(security as any).secureScore}%` : "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/portal/assets")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5" /> Total Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#394442] dark:text-white">
              {(assets as any)?.summary?.total ?? "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent tickets */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Tickets</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setLocation("/portal/tickets")}>View all</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(tickets as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No open tickets</p>
            )}
            {(tickets as any[]).slice(0, 5).map((t: any) => (
              <button key={t.id} onClick={() => setLocation(`/portal/tickets/${t.id}`)} className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-[#394442] dark:text-white truncate">{t.summary}</div>
                  <PizzaTracker status={t.status} compact />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">#{t.id} · {t.assignedTo || "Unassigned"}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(announcements as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No announcements</p>
            )}
            {(announcements as any[]).slice(0, 3).map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg border">
                <div className="text-sm font-medium text-[#394442] dark:text-white">{a.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.body}</div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
