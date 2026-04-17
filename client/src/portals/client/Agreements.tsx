import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PSAAgreement } from "@shared/types/psa";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#394442] dark:text-white">Service Agreements</h1>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading agreements...</p>}

      {!isLoading && agreements.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No active agreements found.</CardContent></Card>
      )}

      <div className="space-y-3">
        {agreements.map(agr => (
          <Card key={agr.id}>
            <button className="w-full text-left" onClick={() => toggle(agr.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {expanded.has(agr.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <CardTitle className="text-sm">{agr.name}</CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2 ml-6">
                      <span>{agr.type}</span>
                      <span>·</span>
                      <span>Start: {agr.startDate ? new Date(agr.startDate).toLocaleDateString() : "—"}</span>
                      {agr.endDate && <><span>·</span><span>End: {new Date(agr.endDate).toLocaleDateString()}</span></>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-[#394442] dark:text-white">
                      ${agr.monthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      agr.status === "active" ? "bg-green-100 text-green-700" :
                      agr.status === "expired" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"
                    }`}>
                      {agr.status}
                    </span>
                  </div>
                </div>
              </CardHeader>
            </button>

            {expanded.has(agr.id) && agr.additions.length > 0 && (
              <CardContent className="pt-0 border-t border-gray-100 dark:border-gray-800">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 ml-6">Line Items</div>
                <table className="w-full text-xs ml-6">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1 font-medium">Item</th>
                      <th className="text-right py-1 font-medium">Qty</th>
                      <th className="text-right py-1 font-medium">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {agr.additions.map((a, i) => (
                      <tr key={i}>
                        <td className="py-1.5 text-[#394442] dark:text-gray-200">{a.name}</td>
                        <td className="py-1.5 text-right">{a.quantity}</td>
                        <td className="py-1.5 text-right">${a.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
