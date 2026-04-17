import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

export function AssetInventory() {
  const { data: assets, isLoading } = useQuery({ queryKey: ["/api/portal/assets"], queryFn: () => authFetch("/api/portal/assets") });
  const { data: licensing } = useQuery({ queryKey: ["/api/portal/assets/licensing"], queryFn: () => authFetch("/api/portal/assets/licensing") });
  const a = assets as any;

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-8">Loading assets...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#394442] dark:text-white">Asset Inventory</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Devices", value: a?.summary?.total },
          { label: "Workstations", value: a?.summary?.workstations },
          { label: "Servers", value: a?.summary?.servers },
          { label: "Patch Compliance", value: a?.summary?.patchCompliance != null ? `${a.summary.patchCompliance}%` : null },
          { label: "Pending Patches", value: a?.summary?.pendingPatches },
        ].map(c => (
          <Card key={c.label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-[#394442] dark:text-white">{c.value ?? "—"}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Critical alerts */}
      {a?.criticalAlerts?.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">Critical Alerts</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(a.criticalAlerts as any[]).map((alert: any, i: number) => (
                <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-950/30 rounded">
                  <span className="font-medium">{alert.deviceName || alert.name}</span>
                  {alert.message && <span className="text-muted-foreground"> — {alert.message}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* EOL OS devices */}
      {a?.eolOsDevices?.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-600">End-of-Life Operating Systems</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(a.eolOsDevices as any[]).map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                  <span className="font-medium">{d.name}</span>
                  <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">{d.os}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Old devices */}
      {a?.oldDevices?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Aging Devices (5+ Years)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(a.oldDevices as any[]).map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <span className="font-medium text-[#394442] dark:text-white">{d.name}</span>
                  <span className="text-muted-foreground">{d.age} years old</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Licensing */}
      {(licensing as any)?.available && (licensing as any)?.data && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">License Utilization</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Data from review on {(licensing as any).dataAsOf ? new Date((licensing as any).dataAsOf).toLocaleDateString() : "—"}
            </p>
            <pre className="text-xs text-muted-foreground overflow-auto">{JSON.stringify((licensing as any).data, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {!(licensing as any)?.available && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {(licensing as any)?.message || "Licensing data not available."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
