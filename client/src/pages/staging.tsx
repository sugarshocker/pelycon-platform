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
  ClipboardList,
  Upload,
  Save,
  Loader2,
  FileText,
  CheckCircle2,
  Trash2,
  FileSpreadsheet,
  StickyNote,
  User,
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
    <div className="h-full bg-background">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold" data-testid="text-staging-title">TBR Staging Area</h1>
          <p className="text-sm text-muted-foreground">Pre-load notes and reports before starting a TBR review</p>
        </div>

        {orgsLoading || stagingListLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="space-y-6">
            {stagedClients.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Clients with Staged Data
                  </CardTitle>
                  <Badge variant="secondary">{stagedClients.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-1">
                  {stagedClients.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                      data-testid={`staged-client-${s.orgId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.orgName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.engineerNotes && <Badge variant="secondary" className="text-xs">Engineer Notes</Badge>}
                          {s.serviceManagerNotes && <Badge variant="secondary" className="text-xs">SM Notes</Badge>}
                          {s.mfaFileName && <Badge variant="secondary" className="text-xs">MFA</Badge>}
                          {s.licenseFileName && <Badge variant="secondary" className="text-xs">License</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLoadStaging(s)}
                          data-testid={`button-load-staging-${s.orgId}`}
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
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Select Client</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedOrgId} onValueChange={handleClientSelect}>
                  <SelectTrigger data-testid="select-staging-client">
                    <SelectValue placeholder="Choose a client to stage data for..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedOrg && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Lead Engineer Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={engineerNotes}
                        onChange={(e) => setEngineerNotes(e.target.value)}
                        placeholder="Enter observations, concerns, and recommendations from the lead engineer..."
                        className="min-h-[160px] text-sm"
                        data-testid="textarea-engineer-notes"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <StickyNote className="h-4 w-4" />
                        Service Manager Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={serviceManagerNotes}
                        onChange={(e) => setServiceManagerNotes(e.target.value)}
                        placeholder="Enter service manager observations and relationship notes..."
                        className="min-h-[160px] text-sm"
                        data-testid="textarea-sm-notes"
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => saveNotesMutation.mutate()}
                    disabled={saveNotesMutation.isPending}
                    data-testid="button-save-notes"
                  >
                    {saveNotesMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Notes
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        MFA Coverage Report
                      </CardTitle>
                      {currentStaging?.mfaFileName && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {currentStaging.mfaFileName}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3">
                        Upload the CIPP MFA report CSV. This will be stored and automatically used when you start a TBR review for this client.
                      </p>
                      <div className="flex items-center gap-2">
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
                          variant="outline"
                          onClick={() => mfaFileRef.current?.click()}
                          disabled={uploadMfaMutation.isPending}
                          data-testid="button-upload-mfa"
                        >
                          {uploadMfaMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          Upload MFA CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        License Utilization Report
                      </CardTitle>
                      {currentStaging?.licenseFileName && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {currentStaging.licenseFileName}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3">
                        Upload the CIPP License report CSV. This will be stored and automatically used when you start a TBR review for this client.
                      </p>
                      <div className="flex items-center gap-2">
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
                          variant="outline"
                          onClick={() => licenseFileRef.current?.click()}
                          disabled={uploadLicenseMutation.isPending}
                          data-testid="button-upload-license"
                        >
                          {uploadLicenseMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          Upload License CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {currentStaging && hasStagedData(currentStaging) && (
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteStagingMutation.mutate(currentStaging.id)}
                      data-testid="button-clear-staging"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear All Staged Data
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
