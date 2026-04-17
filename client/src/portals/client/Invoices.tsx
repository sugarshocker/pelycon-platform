import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { PSAInvoice } from "@shared/types/psa";

type Filter = "all" | "open" | "paid";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

function statusBadge(status: PSAInvoice["status"]) {
  const map: Record<string, string> = {
    open: "bg-amber-100 text-amber-700 border-amber-200",
    partial: "bg-orange-100 text-orange-700 border-orange-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    void: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[status] || ""} capitalize`}>{status}</span>;
}

export function Invoices() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: summary } = useQuery({ queryKey: ["/api/portal/invoices/summary"], queryFn: () => authFetch("/api/portal/invoices/summary") });
  const { data: invoices = [], isLoading } = useQuery<PSAInvoice[]>({
    queryKey: ["/api/portal/invoices", filter],
    queryFn: () => authFetch(`/api/portal/invoices?status=${filter}&limit=100`),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#394442] dark:text-white">Invoices</h1>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Outstanding</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-[#394442] dark:text-white">
                ${(summary as any).outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {(summary as any).outstanding > 0 && (
                <a href="https://pay.pelycon.com" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[#E77125] mt-1 hover:underline">
                  Pay now <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Overdue</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${(summary as any).overdue > 0 ? "text-red-600" : "text-green-600"}`}>
                ${(summary as any).overdue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Open Invoices</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-[#394442] dark:text-white">{(summary as any).openCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(["all", "open", "paid"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${filter === f ? "border-[#E77125] text-[#E77125]" : "border-transparent text-muted-foreground hover:text-[#394442]"}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading invoices...</p>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-muted-foreground uppercase">
            <tr>
              {["Invoice #", "Date", "Due Date", "Amount", "Balance", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                <td className="px-4 py-3">{inv.date ? new Date(inv.date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">${inv.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3">${inv.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                <td className="px-4 py-3">
                  {inv.paymentUrl && (
                    <a href={inv.paymentUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#E77125] text-[#E77125] hover:bg-[#E77125] hover:text-white">
                        Pay <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && invoices.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No invoices found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
