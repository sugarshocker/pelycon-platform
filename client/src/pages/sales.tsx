import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileText, DollarSign, Clock, AlertCircle, Plus } from "lucide-react";

export default function Sales() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Active quotes and revenue tracking via Quoter</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <AlertCircle className="h-3.5 w-3.5" />
          Quoter API pending configuration
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: "Active Quotes", value: "—", sub: "Awaiting approval", color: "text-blue-500" },
          { icon: Clock, label: "Quotes This Month", value: "—", sub: "Created in the last 30 days", color: "text-purple-500" },
          { icon: DollarSign, label: "Pipeline Value", value: "—", sub: "Total value of active quotes", color: "text-primary" },
          { icon: TrendingUp, label: "Revenue Won (MTD)", value: "—", sub: "Accepted quotes this month", color: "text-green-500" },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-3xl font-bold mt-1 text-muted-foreground/50">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
                <div className={`${color} opacity-60`}>
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
              <CardTitle className="text-base">Outstanding Quotes</CardTitle>
              <Button size="sm" variant="outline" disabled>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Quote
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Quoter integration pending</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Once the Quoter API is configured, active and outstanding quotes will appear here with client name, value, and status.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue Won — This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">No data yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Won revenue will show accepted quotes by month with a trend line comparing to prior periods.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-amber-700 dark:text-amber-400">To connect Quoter:</span>
              <span className="text-muted-foreground ml-1">
                Provide your Quoter API base URL and API key and they'll be configured as secrets. The integration will then auto-populate quotes, pipeline value, and won revenue in real time.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
