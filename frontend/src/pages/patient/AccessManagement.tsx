import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getAccessRequests, updateAccessStatus, revokeAccess, AccessRequest } from "@/services/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const statusVariant = (s: string) => {
  if (s === "approved") return "default";
  if (s === "rejected" || s === "revoked") return "destructive";
  return "secondary";
};

const statusColor = (s: string) => {
  if (s === "approved") return "bg-success/15 text-success border-success/30";
  if (s === "rejected" || s === "revoked") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-warning/15 text-warning border-warning/30";
};

export default function AccessManagement() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AccessRequest | null>(null);

  useEffect(() => {
    getAccessRequests().then((data) => { setRequests(data); setLoading(false); });
  }, []);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    setActionLoading(id);
    try {
      await updateAccessStatus(id, action);
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: action } : r));
      toast.success(`Access ${action}`);
    } catch { toast.error("Action failed"); }
    finally { setActionLoading(null); }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setActionLoading(revokeTarget.id);
    try {
      await revokeAccess(revokeTarget.id);
      setRequests((prev) => prev.map((r) => r.id === revokeTarget.id ? { ...r, status: "revoked" } : r));
      toast.success("Access revoked");
    } catch { toast.error("Revoke failed"); }
    finally { setActionLoading(null); setRevokeTarget(null); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Access Management</h1>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Doctor Access Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor Name</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.doctorName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.doctorWallet}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(r.status)} variant="outline">{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" disabled={actionLoading === r.id} onClick={() => handleAction(r.id, "approved")}>
                              {actionLoading === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                            </Button>
                            <Button size="sm" variant="destructive" disabled={actionLoading === r.id} onClick={() => handleAction(r.id, "rejected")}>
                              Reject
                            </Button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" variant="outline" disabled={actionLoading === r.id} onClick={() => setRevokeTarget(r)}>
                            Revoke
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Access</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke access for {revokeTarget?.doctorName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={actionLoading === revokeTarget?.id}>
              {actionLoading === revokeTarget?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revoke Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
