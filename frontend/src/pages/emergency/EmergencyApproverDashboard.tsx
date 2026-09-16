import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { decideEmergencyRequest, EmergencyAccessRequest, getPendingEmergencyRequests } from "@/services/api";

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
      toast.success(decision === "approve" ? `Approval recorded (${result.approval_count}/2)` : "Emergency request rejected");
      await loadRequests();
    } catch (error: any) {
      toast.error(error?.message || "Could not record decision");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Emergency Approvals</h1>
        <p className="text-sm text-muted-foreground">Two distinct approvers are required before temporary access can be issued.</p>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : requests.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No emergency requests are waiting for review.</CardContent></Card>
      ) : requests.map((request) => (
        <Card key={request.id}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">{request.context.replaceAll("_", " ")}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Patient: {request.patientWallet}</p>
            </div>
            <Badge variant="secondary">{request.status}</Badge>
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