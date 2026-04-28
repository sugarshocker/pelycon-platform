import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PizzaTracker } from "./PizzaTracker";
import type { PSATicket } from "@shared/types/psa";

type StatusFilter = "all" | "open" | "waiting_client" | "resolved";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

export function Tickets() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<StatusFilter>("open");

  const apiStatus = filter === "resolved" ? "resolved" : filter === "all" ? "all" : "open";
  const { data: tickets = [], isLoading } = useQuery<PSATicket[]>({
    queryKey: ["/api/portal/tickets", apiStatus],
    queryFn: () => authFetch(`/api/portal/tickets?status=${apiStatus}&limit=100`),
  });

  const displayed = filter === "waiting_client"
    ? tickets.filter(t => t.status === "waiting_client")
    : tickets;

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "waiting_client", label: "Waiting on You" },
    { key: "all", label: "All" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#394442] dark:text-white">Tickets</h1>
        <Button onClick={() => setLocation("/portal/tickets/new")} className="bg-[#E77125] hover:bg-[#E77125]/90 text-white gap-2">
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key
                ? "border-[#E77125] text-[#E77125]"
                : "border-transparent text-muted-foreground hover:text-[#394442] dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading tickets...</p>}

      {!isLoading && displayed.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No tickets found.</CardContent></Card>
      )}

      <div className="space-y-1.5">
        {displayed.map(t => (
          <button
            key={t.id}
            onClick={() => setLocation(`/portal/tickets/${t.id}`)}
            className="w-full text-left px-4 py-3 rounded-lg border bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#394442] dark:text-white truncate">{t.summary}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span>#{t.id}</span>
                  {t.assignedTo && <span>· {t.assignedTo}</span>}
                  <span>· {new Date(t.dateUpdated || t.dateCreated).toLocaleDateString()}</span>
                  {t.statusDetail && <span className="italic">· {t.statusDetail}</span>}
                </div>
              </div>
              <PizzaTracker status={t.status} mini />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
