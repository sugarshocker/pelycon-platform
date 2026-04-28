import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { PSAAgreement } from "@shared/types/psa";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

const fmt$ = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusBadge({ status }: { status: PSAAgreement["status"] }) {
  const cls =
    status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    status === "expired" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

export function Agreements() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: agreements = [], isLoading } = useQuery<PSAAgreement[]>({
    queryKey: ["/api/portal/agreements"],
    queryFn: () => authFetch("/api/portal/agreements"),
  });

  const toggle = (id: string) => {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const totalMonthly = agreements
    .filter(a => a.status === "active")
    .reduce((sum, a) => sum + (a.monthlyRevenue || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-[#394442] dark:text-white">Service Agreements</h1>
        {agreements.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {agreements.filter(a => a.status === "active").length} active · <span className="font-semibold text-[#394442] dark:text-white">{fmt$(totalMonthly)}/mo</span>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading agreements...</p>}

      {!isLoading && agreements.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No active agreements found.</CardContent></Card>
      )}

      <div className="space-y-2">
        {agreements.map(agr => {
          const isOpen = expanded.has(agr.id);
          const lineTotal = agr.additions.reduce((sum, a) => sum + (a.extPrice || 0), 0);
          return (
            <Card key={agr.id} className="overflow-hidden">
              <button className="w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => toggle(agr.id)}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <FileText className="h-4 w-4 text-[#E77125] flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#394442] dark:text-white truncate">{agr.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{agr.type}</span>
                          <span>·</span>
                          <span>Start {agr.startDate ? new Date(agr.startDate).toLocaleDateString() : "—"}</span>
                          {agr.endDate && <><span>·</span><span>End {new Date(agr.endDate).toLocaleDateString()}</span></>}
                          {agr.additions.length > 0 && <><span>·</span><span>{agr.additions.length} line items</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#394442] dark:text-white tabular-nums">{fmt$(agr.monthlyRevenue)}<span className="text-xs font-medium text-muted-foreground">/mo</span></div>
                      </div>
                      <StatusBadge status={agr.status} />
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isOpen && agr.additions.length > 0 && (
                <CardContent className="pt-3 pb-4 px-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left py-2 font-semibold uppercase tracking-wide text-[10px]">Item</th>
                        <th className="text-right py-2 font-semibold uppercase tracking-wide text-[10px] w-16">Qty</th>
                        <th className="text-right py-2 font-semibold uppercase tracking-wide text-[10px] w-24">Unit Price</th>
                        <th className="text-right py-2 font-semibold uppercase tracking-wide text-[10px] w-24">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {agr.additions.map((a, i) => (
                        <tr key={i} className="hover:bg-white dark:hover:bg-gray-900/50">
                          <td className="py-1.5 pr-2 text-[#394442] dark:text-gray-200">{a.name}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">{a.quantity}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmt$(a.unitPrice)}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium text-[#394442] dark:text-gray-200">{fmt$(a.extPrice)}</td>
                        </tr>
                      ))}
                      {lineTotal > 0 && (
                        <tr className="border-t-2 border-gray-300 dark:border-gray-700">
                          <td colSpan={3} className="py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Line items total</td>
                          <td className="py-2 text-right tabular-nums font-bold text-[#394442] dark:text-white">{fmt$(lineTotal)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
