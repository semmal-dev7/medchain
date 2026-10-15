import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, FileHeart, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EmergencyAccessRequest,
  getDoctorEmergencyRequests,
  issueEmergencyGrant,
  viewEmergencyRecordFile,
} from "@/services/api";

interface EmergencyRecordViewer {
  url: string;
  expiresAt: string;
  title: string;
}

export default function DoctorEmergencyRecords() {
  const [requests, setRequests] = useState<EmergencyAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingRequest, setOpeningRequest] = useState<string | null>(null);
  const [viewer, setViewer] = useState<EmergencyRecordViewer | null>(null);
  const approvedRequests = requests.filter((request) => request.status === "approved");

  useEffect(() => {
    getDoctorEmergencyRequests()
      .then(setRequests)
      .catch((error: any) => toast.error(error?.message || "Could not load emergency records"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!viewer) return;
    const remaining = Date.parse(viewer.expiresAt) - Date.now();
    if (remaining <= 0) {
      setViewer(null);
      toast.info("Emergency record access expired");
      return;
    }
    const timeout = window.setTimeout(() => {
      setViewer(null);
      toast.info("Emergency record access expired");
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const blockExportShortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["p", "s"].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", blockExportShortcuts);
    return () => window.removeEventListener("keydown", blockExportShortcuts);
  }, [viewer]);

  useEffect(() => () => {
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
  }, [viewer]);

  const openRecord = async (request: EmergencyAccessRequest) => {
    setOpeningRequest(request.id);
    try {
      const grant = await issueEmergencyGrant(request.id);
      const url = await viewEmergencyRecordFile(grant.grant_token);
      setViewer({
        url,
        expiresAt: grant.expires_at,
        title: request.context.replaceAll("_", " "),
      });
    } catch (error: any) {
      toast.error(error?.message || "Could not open emergency medical record");
    } finally {
      setOpeningRequest(null);
    }
  };

  const closeViewer = () => setViewer(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emergency Records</h1>
        <p className="text-sm text-muted-foreground">
          Only your approved emergency requests appear here. Opening a record issues a temporary 30-minute grant.
        </p>
      </div>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Emergency-only access
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Records here are separate from patient-consented records. Opening an approved request displays the entire uploaded PDF for that record. Access is limited to the requesting doctor, requires an active emergency grant and hospital authorization, and expires after 30 minutes. Viewing is read-only.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileHeart className="h-5 w-5 text-primary" />
            Approved emergency requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading emergency requests...
            </div>
          ) : approvedRequests.length ? (
            <div className="space-y-3">
              {approvedRequests.map((request) => (
                <div key={request.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{request.context.replaceAll("_", " ")}</p>
                        <Badge variant="outline" className="border-success/40 text-success">
                          <ShieldCheck className="mr-1 h-3 w-3" />Approved
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Patient: {request.patientWallet} · Record ID: {request.recordId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested resources: {request.requestedResources.join(", ")}
                      </p>
                      {request.hospitalName && (
                        <p className="text-xs text-muted-foreground">Hospital: {request.hospitalName}</p>
                      )}
                    </div>
                    <Button onClick={() => openRecord(request)} disabled={openingRequest !== null}>
                      {openingRequest === request.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <FileHeart className="mr-2 h-4 w-4" />}
                      View emergency record
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No approved emergency records are available. Once two selected approvers approve one of your requests, it will appear here.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewer} onOpenChange={(open) => !open && closeViewer()}>
        <DialogContent className="max-w-5xl" onContextMenu={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{viewer?.title || "Emergency medical record"}</DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              <Clock3 className="h-4 w-4" />
              The full uploaded PDF is available read-only for this emergency grant. The view closes when the 30-minute grant expires.
            </DialogDescription>
          </DialogHeader>
          {viewer && (
            <iframe
              title="Emergency patient medical record"
              src={`${viewer.url}#toolbar=0&navpanes=0&scrollbar=0`}
              className="h-[70vh] w-full rounded-md border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
