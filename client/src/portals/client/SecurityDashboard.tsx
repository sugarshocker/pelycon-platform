import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, HelpCircle } from "lucide-react";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

function PostureCard({ label, pass, detail }: { label: string; pass: boolean | null; detail?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          {pass === null
            ? <HelpCircle className="h-6 w-6 text-gray-400" />
            : pass
            ? <CheckCircle className="h-6 w-6 text-green-500" />
            : <XCircle className="h-6 w-6 text-red-500" />}
          <div>
            <div className="text-sm font-semibold text-[#394442] dark:text-white">{label}</div>
            {detail && <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-[200px]">{detail}</div>}
            <div className={`text-xs font-medium mt-0.5 ${pass === null ? "text-gray-400" : pass ? "text-green-600" : "text-red-600"}`}>
              {pass === null ? "Unknown" : pass ? "Configured" : "Not Configured"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityDashboard() {
  const { data: security, isLoading } = useQuery({
    queryKey: ["/api/portal/security"],
    queryFn: () => authFetch("/api/portal/security"),
  });

  const s = security as any;
  const posture = s?.emailPosture;

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-8">Loading security data...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#394442] dark:text-white">Security Overview</h1>
      {s?.dataAsOf && (
        <p className="text-xs text-muted-foreground">Data from TBR review on {new Date(s.dataAsOf).toLocaleDateString()}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Secure Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Microsoft Secure Score</CardTitle>
          </CardHeader>
          <CardContent>
            {s?.secureScore != null ? (
              <div className="flex items-end gap-1">
                <div className="text-4xl font-bold text-[#E77125]">{s.secureScore}</div>
                <div className="text-sm text-muted-foreground mb-1">/100</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Not available</div>
            )}
          </CardContent>
        </Card>

        {/* MFA Coverage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">MFA Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            {s?.mfaCoverage ? (
              <div>
                <div className="text-2xl font-bold text-[#394442] dark:text-white">
                  {s.mfaCoverage.covered} <span className="text-sm font-normal text-muted-foreground">/ {s.mfaCoverage.total} users</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#E77125] rounded-full transition-all"
                    style={{ width: `${Math.round((s.mfaCoverage.covered / s.mfaCoverage.total) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round((s.mfaCoverage.covered / s.mfaCoverage.total) * 100)}% covered
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Not available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email posture */}
      {posture && (
        <div>
          <h2 className="text-sm font-semibold text-[#394442] dark:text-white mb-3">Email Security Posture</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <PostureCard label="SPF" pass={posture.spf} detail={posture.spfRecord} />
            <PostureCard label="DMARC" pass={posture.dmarc} detail={posture.dmarcRecord} />
            <PostureCard label="DKIM" pass={posture.dkim} detail={posture.dkimRecord} />
            <PostureCard label="DNSSEC" pass={posture.dnssec} />
          </div>
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-muted-foreground space-y-1">
            <p><strong>SPF</strong> — tells mail servers which IPs are allowed to send email for your domain.</p>
            <p><strong>DMARC</strong> — tells receiving servers what to do with emails that fail SPF/DKIM checks.</p>
            <p><strong>DKIM</strong> — cryptographic signature that verifies emails weren't tampered with in transit.</p>
            <p><strong>DNSSEC</strong> — protects your DNS records from being spoofed or hijacked.</p>
          </div>
        </div>
      )}
    </div>
  );
}
