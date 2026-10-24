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
  getPatientRecordTargets,
  issueEmergencyGrant,
  PatientRecordTarget,
  viewEmergencyRecordFile,
} from "@/services/api";

interface EmergencyRecordViewer {
  url: string;
  expiresAt: string;
  title: string;
}

function ViewerCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    const target = Date.parse(expiresAt);
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft("0m 00s");
        setIsExpired(true);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs < 10 ? "0" : ""}${secs}s`);
      setIsExpired(false);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono ${
      isExpired
        ? "bg-destructive/10 text-destructive border border-destructive/30"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse"
    }`}>
      <Clock3 className="h-3.5 w-3.5" />
      {isExpired ? "Access Expired" : `30-Min Break-Glass: ${timeLeft} remaining`}
    </div>
  );
}

export default function DoctorEmergencyRecords() {
  const [requests, setRequests] = useState<EmergencyAccessRequest[]>([]);
  const [patientRecords, setPatientRecords] = useState<Record<string, PatientRecordTarget[]>>({});
  const [loading, setLoading] = useState(true);
  const [openingRequest, setOpeningRequest] = useState<string | null>(null);
  const [viewer, setViewer] = useState<EmergencyRecordViewer | null>(null);
  const approvedRequests = requests.filter((request) => request.status === "approved");

  useEffect(() => {
    getDoctorEmergencyRequests()
      .then(async (data) => {
        setRequests(data);
        const allRecRequests = data.filter((r) => r.status === "approved" && r.isAllRecords);
        const map: Record<string, PatientRecordTarget[]> = {};
        for (const req of allRecRequests) {
          if (!map[req.patientWallet]) {
            try {
              map[req.patientWallet] = await getPatientRecordTargets(req.patientWallet);
            } catch {
              // ignore
            }
          }
        }
        setPatientRecords(map);
      })
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

  const openRecord = async (request: EmergencyAccessRequest, recordId?: number, recordName?: string) => {
    const actionKey = recordId !== undefined ? `${request.id}-${recordId}` : request.id;
    setOpeningRequest(actionKey);
    try {
      const grant = await issueEmergencyGrant(request.id);
      const url = await viewEmergencyRecordFile(grant.grant_token, recordId);
      setViewer({
        url,
        expiresAt: grant.expires_at,
        title: recordName ? `${recordName} · Emergency Medical Record` : `${request.recordName ? request.recordName + " · " : ""}${request.context.replaceAll("_", " ")}`,
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
                <div key={request.id} className="rounded-md border p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {request.isAllRecords
                            ? "Entire Medical Record"
                            : `${request.recordName ? request.recordName + " · " : ""}${request.context.replaceAll("_", " ")}`}
                        </p>
                        <Badge variant="outline" className="border-success/40 text-success">
                          <ShieldCheck className="mr-1 h-3 w-3" />Approved
                        </Badge>
                        <Badge variant="outline" className="border-warning/40 text-warning">
                          <Clock3 className="mr-1 h-3 w-3" />30-Minute Break-Glass
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Patient: {request.patientWallet} · {request.isAllRecords ? "Scope: Full Medical Record (All Records)" : `Record: ${request.recordName || `ID ${request.recordId}`}`}
                      </p>
                      {request.hospitalName && (
                        <p className="text-xs text-muted-foreground">Hospital: {request.hospitalName}</p>
                      )}
                    </div>
                    {!request.isAllRecords && (
                      <Button onClick={() => openRecord(request)} disabled={openingRequest !== null}>
                        {openingRequest === request.id
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <FileHeart className="mr-2 h-4 w-4" />}
                        View emergency record
                      </Button>
                    )}
                  </div>

                  {request.isAllRecords && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileHeart className="h-3.5 w-3.5 text-primary" />
                        Patient Records Available Under This Emergency Grant:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {patientRecords[request.patientWallet]?.length ? (
                          patientRecords[request.patientWallet].map((rec) => (
                            <Button
                              key={rec.recordId}
                              size="sm"
                              variant="outline"
                              className="border-primary/40 hover:bg-primary/10"
                              onClick={() => openRecord(request, rec.recordId, rec.name || `Record ID ${rec.recordId}`)}
                              disabled={openingRequest !== null}
                            >
                              {openingRequest === `${request.id}-${rec.recordId}` ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileHeart className="mr-1.5 h-3.5 w-3.5 text-primary" />
                              )}
                              View {rec.name || `Record (ID ${rec.recordId})`}
                            </Button>
                          ))
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => openRecord(request)}
                            disabled={openingRequest !== null}
                          >
                            <FileHeart className="mr-1.5 h-3.5 w-3.5" />
                            View patient record
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle>{viewer?.title || "Emergency medical record"}</DialogTitle>
                <DialogDescription className="flex items-center gap-1 mt-1">
                  <Clock3 className="h-4 w-4" />
                  Read-only emergency consultation. Closes automatically when the 30-minute grant expires.
                </DialogDescription>
              </div>
              {viewer?.expiresAt && <ViewerCountdown expiresAt={viewer.expiresAt} />}
            </div>
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
