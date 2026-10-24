import { useEffect, useState } from "react";
import { Check, Clock3, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { decideEmergencyRequest, EmergencyAccessRequest, getPendingEmergencyRequests } from "@/services/api";

function ApproverWindowCountdown({ requestedAt }: { requestedAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    const target = Date.parse(requestedAt) + 30 * 60000;
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
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
  }, [requestedAt]);

  return (
    <span className={`inline-flex items-center text-xs font-mono px-2 py-0.5 rounded border ${
      isExpired ? "border-destructive/30 text-destructive bg-destructive/10" : "border-warning/40 text-warning bg-warning/10"
    }`}>
      <Clock3 className="mr-1 h-3 w-3" />
      {isExpired ? "30-min window expired" : `${timeLeft} to decide (30-min window)`}
    </span>
  );
}

export default function EmergencyApproverDashboard() {
  const [requests, setRequests] = useState<EmergencyAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setRequests(await getPendingEmergencyRequests());
    } catch (error: any) {
      toast.error(error?.message || "Could not load emergency requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setActionId(id);
    try {
      const result = await decideEmergencyRequest(id, decision);
      toast.success(decision === "approve"
        ? `Approval recorded (${result.approval_count}/${result.committee_size}; ${result.threshold} required)`
        : "Emergency request rejected");
      await loadRequests();
    } catch (error: any) {
      toast.error(error?.message || "Could not record decision");
    } finally {
      setActionId(null);
    }
  };

  const approveAll = async () => {
    setActionId("all");
    try {
      for (const req of requests) {
        await decideEmergencyRequest(req.id, "approve");
      }
      toast.success(`Approved all ${requests.length} emergency requests`);
      await loadRequests();
    } catch (error: any) {
      toast.error(error?.message || "Could not approve all requests");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Approvals</h1>
          <p className="text-sm text-muted-foreground">Each request is sent only to the three emergency doctors selected by the requester. Two of those three must approve within 30 minutes; one rejection closes the request.</p>
        </div>
        {requests.length > 1 && (
          <Button onClick={approveAll} disabled={actionId !== null} className="shrink-0">
            {actionId === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve All ({requests.length}) Requests
          </Button>
        )}
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : requests.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No emergency requests are waiting for review.</CardContent></Card>
      ) : requests.map((request) => (
        <Card key={request.id}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">
                {request.isAllRecords
                  ? "Entire Medical Record"
                  : `${request.recordName ? request.recordName + " · " : ""}${request.context.replaceAll("_", " ")}`}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Patient: {request.patientWallet}</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">
                Scope: {request.isAllRecords ? "All Patient Records (Entire Vault Access)" : `${request.recordName} (ID ${request.recordId})`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Selected approvers: {request.selectedApprovers.join(", ")}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant="secondary">{request.status}</Badge>
              <ApproverWindowCountdown requestedAt={request.requestedAt} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{request.reason}</p>
            <p className="text-xs text-muted-foreground">Minimum disclosure: {request.requestedResources.join(", ")}</p>
            <div className="flex gap-2">
              <Button onClick={() => decide(request.id, "approve")} disabled={actionId === request.id}>
                <Check className="mr-2 h-4 w-4" />Approve
              </Button>
              <Button variant="destructive" onClick={() => decide(request.id, "reject")} disabled={actionId === request.id}>
                <X className="mr-2 h-4 w-4" />Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}