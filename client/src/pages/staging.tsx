import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Save,
  Loader2,
  FileText,
  CheckCircle2,
  Trash2,
  FileSpreadsheet,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { apiRequest, getToken, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Organization, TbrStaging } from "@shared/schema";

export default function Staging() {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [engineerNotes, setEngineerNotes] = useState("");
  const [serviceManagerNotes, setServiceManagerNotes] = useState("");
  const mfaFileRef = useRef<HTMLInputElement>(null);
  const licenseFileRef = useRef<HTMLInputElement>(null);

  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: allStaging, isLoading: stagingListLoading } = useQuery<TbrStaging[]>({
    queryKey: ["/api/staging"],
  });

  const selectedOrg = organizations?.find((o) => o.id === parseInt(selectedOrgId));

  const { data: stagingData } = useQuery<{ staging: TbrStaging | null }>({
    queryKey: ["/api/staging", selectedOrgId],
    enabled: !!selectedOrgId,
  });

  const currentStaging = stagingData?.staging;

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrg) throw new Error("No client selected");
      const res = await apiRequest("POST", "/api/staging/save", {
        orgId: selectedOrg.id,
        orgName: selectedOrg.name,
        engineerNotes: engineerNotes || null,
        serviceManagerNotes: serviceManagerNotes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staging"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staging", selectedOrgId] });
      toast({ title: "Notes saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    },
  });

  const uploadMfaMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedOrg) throw new Error("No client selected");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", String(selectedOrg.id));
      formData.append("orgName", selectedOrg.name);
      const token = getToken();
      const res = await fetch("/api/staging/upload-mfa", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staging"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staging", selectedOrgId] });
      toast({ title: "MFA report uploaded" });
      if (mfaFileRef.current) mfaFileRef.current.value = "";
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const uploadLicenseMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedOrg) throw new Error("No client selected");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", String(selectedOrg.id));
      formData.append("orgName", selectedOrg.name);
      const token = getToken();
      const res = await fetch("/api/staging/upload-license", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staging"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staging", selectedOrgId] });
      toast({ title: "License report uploaded" });
      if (licenseFileRef.current) licenseFileRef.current.value = "";
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteStagingMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/staging/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staging"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staging", selectedOrgId] });
      setEngineerNotes("");
      setServiceManagerNotes("");
      toast({ title: "Staging data cleared" });
    },
  });

  const handleClientSelect = (orgId: string) => {
    setSelectedOrgId(orgId);
    const staging = allStaging?.find((s) => s.orgId === parseInt(orgId));
    if (staging) {
      setEngineerNotes(staging.engineerNotes || "");
      setServiceManagerNotes(staging.serviceManagerNotes || "");
    } else {
      setEngineerNotes("");
      setServiceManagerNotes("");
    }
  };

  const handleLoadStaging = (staging: TbrStaging) => {
    setSelectedOrgId(String(staging.orgId));
    setEngineerNotes(staging.engineerNotes || "");
    setServiceManagerNotes(staging.serviceManagerNotes || "");
  };

  const hasStagedData = (s: TbrStaging) =>
    !!(s.engineerNotes || s.serviceManagerNotes || s.mfaReportData || s.licenseReportData);

  const stagedClients = (allStaging || []).filter(hasStagedData);

  return (
    <div className="h-full bg-background overflow-auto">
      <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-4">
        {orgsLoading || stagingListLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-lg font-semibold" data-testid="text-staging-title">TBR Staging</h1>
                <p className="text-xs text-muted-foreground">Pre-load notes and CSV reports before starting reviews</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedOrgId} onValueChange={handleClientSelect}>
                  <SelectTrigger className="w-[240px]" data-testid="select-staging-client">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOrgId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setSelectedOrgId(""); setEngineerNotes(""); setServiceManagerNotes(""); }}
                    data-testid="button-clear-selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {stagedClients.length > 0 && !selectedOrgId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Staged Clients</CardTitle>
                  <Badge variant="secondary" className="text-xs">{stagedClients.length}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-staged-clients">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground">Client</th>
                          <th className="text-center py-2 font-medium text-muted-foreground">Engineer</th>
                          <th className="text-center py-2 font-medium text-muted-foreground">SM</th>
                          <th className="text-center py-2 font-medium text-muted-foreground">MFA</th>
                          <th className="text-center py-2 font-medium text-muted-foreground">License</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stagedClients.map((s) => (
                          <tr key={s.id} className="border-b last:border-0" data-testid={`staged-row-${s.orgId}`}>
                            <td className="py-2 font-medium">{s.orgName}</td>
                            <td className="py-2 text-center">
                              {s.engineerNotes ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">--</span>}
                            </td>
                            <td className="py-2 text-center">
                              {s.serviceManagerNotes ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">--</span>}
                            </td>
                            <td className="py-2 text-center">
                              {s.mfaFileName ? (
                                <Badge variant="secondary" className="text-xs">{s.mfaFileName}</Badge>
                              ) : <span className="text-muted-foreground">--</span>}
                            </td>
                            <td className="py-2 text-center">
                              {s.licenseFileName ? (
                                <Badge variant="secondary" className="text-xs">{s.licenseFileName}</Badge>
                              ) : <span className="text-muted-foreground">--</span>}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleLoadStaging(s)}
                                  data-testid={`button-edit-staging-${s.orgId}`}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteStagingMutation.mutate(s.id)}
                                  data-testid={`button-delete-staging-${s.orgId}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedOrg && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">{selectedOrg.name}</CardTitle>
                  {currentStaging && hasStagedData(currentStaging) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteStagingMutation.mutate(currentStaging.id)}
                      data-testid="button-clear-staging"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <label className="text-sm font-medium">Lead Engineer Notes</label>
                      </div>
                      <Textarea
                        value={engineerNotes}
                        onChange={(e) => setEngineerNotes(e.target.value)}
                        placeholder="Observations, concerns, recommendations..."
                        className="min-h-[120px] text-sm"
                        data-testid="textarea-engineer-notes"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="h-4 w-4 text-muted-foreground" />
                        <label className="text-sm font-medium">Service Manager Notes</label>
                      </div>
                      <Textarea
                        value={serviceManagerNotes}
                        onChange={(e) => setServiceManagerNotes(e.target.value)}
                        placeholder="Relationship notes, client feedback..."
                        className="min-h-[120px] text-sm"
                        data-testid="textarea-sm-notes"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 flex-wrap border-t pt-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">MFA:</span>
                        {currentStaging?.mfaFileName ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {currentStaging.mfaFileName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not uploaded</span>
                        )}
                        <input
                          ref={mfaFileRef}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadMfaMutation.mutate(file);
                          }}
                          data-testid="input-mfa-file"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mfaFileRef.current?.click()}
                          disabled={uploadMfaMutation.isPending}
                          data-testid="button-upload-mfa"
                        >
                          {uploadMfaMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">License:</span>
                        {currentStaging?.licenseFileName ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {currentStaging.licenseFileName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not uploaded</span>
                        )}
                        <input
                          ref={licenseFileRef}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadLicenseMutation.mutate(file);
                          }}
                          data-testid="input-license-file"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => licenseFileRef.current?.click()}
                          disabled={uploadLicenseMutation.isPending}
                          data-testid="button-upload-license"
                        >
                          {uploadLicenseMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={() => saveNotesMutation.mutate()}
                      disabled={saveNotesMutation.isPending}
                      data-testid="button-save-notes"
                    >
                      {saveNotesMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedOrgId && stagedClients.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <StickyNote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Select a client above to begin staging notes and reports for their next TBR.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
