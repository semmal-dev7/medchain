import { useEffect, useState } from "react";
import { FileHeart, LockKeyhole, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getApprovedRecordAccess, getAuthorizedRecord, viewAuthorizedRecord } from "@/services/api";
import { toast } from "sonner";

export default function DoctorRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    const loadRecords = async () => {
      try {
        const approved = await getApprovedRecordAccess();
        setRecords(await Promise.all(approved.map((item: any) => getAuthorizedRecord(item.record_id))));
      } catch (error: any) {
        toast.error(error?.message || "Could not load approved records");
      } finally {
        setLoading(false);
      }
    };
    loadRecords();
  }, []);

  const viewRecord = async (record: any) => {
    setViewLoading(true);
    try {
      setViewUrl(await viewAuthorizedRecord(record.record_id));
      setViewingRecord(record);
    } catch (error: any) {
      toast.error(error?.message || "Could not view approved record");
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewer = () => {
    if (viewUrl) URL.revokeObjectURL(viewUrl);
    setViewUrl(null);
    setViewingRecord(null);
  };

  useEffect(() => {
    if (!viewingRecord) return;
    const blockExportShortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["p", "s"].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", blockExportShortcuts);
    return () => window.removeEventListener("keydown", blockExportShortcuts);
  }, [viewingRecord]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medical Records</h1>
        <p className="text-sm text-muted-foreground">Approved patient records are shown automatically after consent.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileHeart className="h-5 w-5 text-primary" />Approved Patient Records</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading approved records...</div> : records.length ? <div className="space-y-3">{records.map((record) => <div key={record.record_id} className="rounded-md border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{record.name || "Medical record"}</p><p className="mt-1 text-sm text-muted-foreground">{record.description || "No description provided"}</p><p className="mt-2 text-xs text-muted-foreground">Record ID: {record.record_id} · Patient: {record.patient_wallet}</p></div><div className="flex items-center gap-2"><Badge className="bg-success/15 text-success" variant="outline">Patient approved</Badge><Button size="sm" onClick={() => viewRecord(record)} disabled={viewLoading}>{viewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "View record"}</Button></div></div></div>)}</div> : <p className="text-sm text-muted-foreground">No patient-approved records are available yet.</p>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-secondary" />Privacy Boundary</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Doctors can view approved patient record details only. Record downloads are not permitted. Unapproved records are not loaded. Emergency records require a separate temporary grant and minimum-disclosure filter.</p></CardContent></Card>
      <Dialog open={!!viewingRecord} onOpenChange={(open) => !open && closeViewer()}>
        <DialogContent className="max-w-5xl" onContextMenu={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{viewingRecord?.name || "Medical record"}</DialogTitle>
          <DialogDescription>Read-only view. Printing and downloading patient records are not permitted.</DialogDescription>
          </DialogHeader>
        {viewUrl && <iframe title="Patient medical record" src={`${viewUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="h-[70vh] w-full rounded-md border" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
