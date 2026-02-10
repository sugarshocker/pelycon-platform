import { useState, useRef } from "react";
import { CollapsibleSection } from "./collapsible-section";
import { StatusDot } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUp, UserCheck, Key, Package, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/queryClient";
import type { MfaReport, LicenseReport } from "@shared/schema";

interface CippReportsProps {
  mfaReport: MfaReport | null;
  licenseReport: LicenseReport | null;
  onMfaUpload: (report: MfaReport) => void;
  onLicenseUpload: (report: LicenseReport) => void;
}

export function CippReports({
  mfaReport,
  licenseReport,
  onMfaUpload,
  onLicenseUpload,
}: CippReportsProps) {
  const [mfaLoading, setMfaLoading] = useState(false);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const mfaInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (
    file: File,
    type: "mfa" | "license",
    setLoading: (v: boolean) => void
  ) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const headers: Record<string, string> = {};
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/reports/${type}`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const data = await res.json();
      if (type === "mfa") {
        onMfaUpload(data);
      } else {
        onLicenseUpload(data);
      }

      toast({
        title: "Report Uploaded",
        description: `${type === "mfa" ? "MFA" : "License"} report processed successfully.`,
      });
    } catch (err: any) {
      toast({
        title: "Upload Failed",
        description: err.message || "Could not process the file.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CollapsibleSection
      title="Account Security & Licensing"
      icon={<Key className="h-5 w-5" />}
      testId="section-cipp"
    >
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Multi-Factor Authentication
              </h4>
              <div>
                <input
                  ref={mfaInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file, "mfa", setMfaLoading);
                    e.target.value = "";
                  }}
                  data-testid="input-mfa-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mfaInputRef.current?.click()}
                  disabled={mfaLoading}
                  data-testid="button-upload-mfa"
                >
                  <FileUp className="h-4 w-4 mr-1.5" />
                  {mfaLoading ? "Processing..." : "Upload MFA Report"}
                </Button>
              </div>
            </div>

            {mfaReport ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
                    <span className="text-xl font-bold">{mfaReport.totalUsers}</span>
                    <span className="text-xs text-muted-foreground">Total Users</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-3">
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {mfaReport.mfaEnabledCount}
                    </span>
                    <span className="text-xs text-muted-foreground">MFA On</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-md bg-red-50 dark:bg-red-950/30 p-3">
                    <span className="text-xl font-bold text-red-600 dark:text-red-400">
                      {mfaReport.mfaDisabledCount}
                    </span>
                    <span className="text-xs text-muted-foreground">MFA Off</span>
                  </div>
                </div>
                {mfaReport.usersWithoutMfa.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Users Without MFA:
                    </p>
                    <div className="grid gap-1">
                      {mfaReport.usersWithoutMfa.map((user, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-1.5 text-sm"
                        >
                          <StatusDot status="action" />
                          <span className="truncate">{user.displayName}</span>
                          <span className="text-xs text-muted-foreground truncate ml-auto">
                            {user.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {mfaReport.usersWithoutMfa.length === 0 && (
                  <div className="text-center py-2">
                    <StatusDot status="good" label="All users have MFA enabled" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm rounded-md border border-dashed">
                Upload a CSV from CIPP to view MFA status
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                License Usage
              </h4>
              <div>
                <input
                  ref={licenseInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file, "license", setLicenseLoading);
                    e.target.value = "";
                  }}
                  data-testid="input-license-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => licenseInputRef.current?.click()}
                  disabled={licenseLoading}
                  data-testid="button-upload-license"
                >
                  <FileUp className="h-4 w-4 mr-1.5" />
                  {licenseLoading ? "Processing..." : "Upload License Report"}
                </Button>
              </div>
            </div>

            {licenseReport ? (
              <div className="space-y-3">
                {licenseReport.totalWasted > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span className="text-sm">
                      <strong>{licenseReport.totalWasted}</strong> unused licenses
                      detected — potential cost savings
                    </span>
                  </div>
                )}
                <div className="grid gap-2">
                  {licenseReport.licenses.map((lic, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 flex-wrap"
                    >
                      <span className="text-sm font-medium truncate min-w-0">
                        {lic.licenseName}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {lic.quantityUsed}/{lic.quantityAssigned} used
                        </span>
                        {lic.wasted > 0 && (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                            {lic.wasted} unused
                          </Badge>
                        )}
                        {lic.wasted === 0 && (
                          <Check className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm rounded-md border border-dashed">
                Upload a CSV from CIPP to view license usage
              </div>
            )}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
