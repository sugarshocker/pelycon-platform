import { useState, useRef } from "react";
import { CollapsibleSection } from "./collapsible-section";
import { StatusDot } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUp, UserCheck, Key, Package, AlertTriangle, Check, ShieldCheck, ShieldAlert } from "lucide-react";
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

  const coveragePercent = mfaReport && mfaReport.totalUsers > 0
    ? Math.round((mfaReport.coveredCount / mfaReport.totalUsers) * 100)
    : 0;

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
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
                    <span className="text-xl font-bold" data-testid="text-mfa-total">{mfaReport.totalUsers}</span>
                    <span className="text-xs text-muted-foreground">Active Licensed Users</span>
                  </div>
                  <div className={`flex flex-col items-center gap-1 rounded-md p-3 ${
                    mfaReport.uncoveredCount > 0
                      ? "bg-red-50 dark:bg-red-950/30"
                      : "bg-emerald-50 dark:bg-emerald-950/30"
                  }`}>
                    <span className={`text-xl font-bold ${
                      mfaReport.uncoveredCount > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`} data-testid="text-mfa-coverage">
                      {coveragePercent}%
                    </span>
                    <span className="text-xs text-muted-foreground">MFA Coverage</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Coverage Breakdown</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1 rounded-md bg-muted/30 p-2">
                      <span className="text-sm font-semibold" data-testid="text-mfa-ca">{mfaReport.coveredByCA}</span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">Conditional Access</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 rounded-md bg-muted/30 p-2">
                      <span className="text-sm font-semibold" data-testid="text-mfa-sd">{mfaReport.coveredBySD}</span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">Security Defaults</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 rounded-md bg-muted/30 p-2">
                      <span className="text-sm font-semibold" data-testid="text-mfa-peruser">{mfaReport.coveredByPerUser}</span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">Per-User MFA</span>
                    </div>
                  </div>
                </div>

                {mfaReport.uncoveredUsers.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      {mfaReport.uncoveredCount} User{mfaReport.uncoveredCount !== 1 ? "s" : ""} Without MFA Protection:
                    </p>
                    <div className="grid gap-1 max-h-48 overflow-y-auto">
                      {mfaReport.uncoveredUsers.map((user, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-1.5 text-sm"
                          data-testid={`row-mfa-uncovered-${i}`}
                        >
                          <StatusDot status="action" />
                          <span className="truncate font-medium">{user.displayName}</span>
                          <span className="text-xs text-muted-foreground truncate ml-auto">
                            {user.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {mfaReport.uncoveredUsers.length === 0 && (
                  <div className="text-center py-2 flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      All users have MFA coverage
                    </span>
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
                {licenseReport.totalMonthlyWaste > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm">
                      <strong>{licenseReport.totalWasted}</strong> unused licenses wasting{" "}
                      <strong className="text-red-600 dark:text-red-400">
                        ${licenseReport.totalMonthlyWaste.toFixed(2)}/mo
                      </strong>
                      {" "}(${licenseReport.totalAnnualWaste.toFixed(2)}/yr)
                    </span>
                  </div>
                )}
                {licenseReport.totalMonthlyWaste === 0 && licenseReport.totalWasted > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span className="text-sm">
                      <strong>{licenseReport.totalWasted}</strong> unused licenses detected
                    </span>
                  </div>
                )}
                <div className="grid gap-1.5">
                  {licenseReport.licenses.map((lic, i) => {
                    const hasWaste = lic.wasted > 0;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 flex-wrap ${
                          hasWaste
                            ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40"
                            : "bg-muted/50"
                        }`}
                        data-testid={`license-row-${i}`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm font-medium truncate ${hasWaste ? "text-red-700 dark:text-red-300" : ""}`}>
                            {lic.licenseName}
                          </span>
                          {lic.monthlyPricePerLicense > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ${lic.monthlyPricePerLicense.toFixed(2)}/user/mo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {lic.quantityUsed}/{lic.totalLicenses} used
                          </span>
                          {hasWaste ? (
                            <Badge variant="destructive" className="text-xs">
                              {lic.wasted} unused
                              {lic.monthlyWastedCost > 0 && ` ($${lic.monthlyWastedCost.toFixed(2)}/mo)`}
                            </Badge>
                          ) : (
                            <Check className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
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
