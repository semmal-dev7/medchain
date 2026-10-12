import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteRecord, downloadRecord, getMyRecords, PatientRecord, uploadRecord } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, CheckCircle, FileHeart } from "lucide-react";
import { toast } from "sonner";

export default function UploadRecordPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allergy, setAllergy] = useState("");
  const [condition, setCondition] = useState("");
  const [medication, setMedication] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadRecords = async () => {
    try {
      setRecords(await getMyRecords());
    } catch (error: any) {
      toast.error(error?.message || "Failed to load medical records");
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleDownload = async (record: PatientRecord) => {
    setDownloadingId(record.recordId);
    try {
      await downloadRecord(record.recordId, record.name || `medical-record-${record.recordId}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to download record");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (record: PatientRecord) => {
    setDeletingId(record.recordId);
    try {
      await deleteRecord(record.recordId);
      setRecords((current) => current.filter((item) => item.recordId !== record.recordId));
      toast.success("Record removed from your dashboard");
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove record");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Please select a file"); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const fhirResources = [
        allergy.trim() && { resourceType: "AllergyIntolerance", code: { text: allergy.trim() } },
        condition.trim() && { resourceType: "Condition", code: { text: condition.trim() } },
        medication.trim() && { resourceType: "MedicationStatement", medicationCodeableConcept: { text: medication.trim() } },
      ].filter(Boolean) as Array<Record<string, unknown>>;
      const result = await uploadRecord(name, description, file, fhirResources);
      setTxHash(result.txHash);
      toast.success("Record uploaded successfully!");
      setName("");
      setDescription("");
      setFile(null);
      setAllergy("");
      setCondition("");
      setMedication("");
      await loadRecords();
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Upload Medical Record</h1>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">New Record</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recordName">Record Name</Label>
              <Input id="recordName" placeholder="e.g. Blood Test Results" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Brief description of the record..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input id="file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground">PDF files only.</p>
            </div>
            <div className="space-y-3 rounded-md border border-secondary/30 bg-secondary/5 p-4">
              <div>
                <p className="font-medium">Clinical information</p>
                <p className="text-xs text-muted-foreground">Optional FHIR fields used to create the record commitment.</p>
              </div>
              <Input placeholder="Critical allergy, e.g. Penicillin" value={allergy} onChange={(e) => setAllergy(e.target.value)} />
              <Input placeholder="Condition, e.g. Diabetes" value={condition} onChange={(e) => setCondition(e.target.value)} />
              <Input placeholder="Medication, e.g. Metformin" value={medication} onChange={(e) => setMedication(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading to IPFS...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Upload Record</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {txHash && (
        <Card className="border-success/30 bg-success/5 shadow-md">
          <CardContent className="flex items-start gap-3 pt-6">
            <CheckCircle className="mt-0.5 h-5 w-5 text-success" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Transaction Successful</p>
              <p className="mt-1 break-all text-sm font-mono text-muted-foreground">{txHash}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileHeart className="h-5 w-5 text-primary" />
            Uploaded Medical Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recordsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your records...</div>
          ) : records.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No medical records uploaded yet.</div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div key={record.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{record.name || "Untitled medical record"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{record.description || "No description provided"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="w-fit border-secondary/40 text-secondary">{record.hasFile ? "Encrypted PDF" : "Re-upload required"}</Badge><Button type="button" size="sm" variant="outline" onClick={() => handleDownload(record)} disabled={!record.hasFile || downloadingId === record.recordId}>{downloadingId === record.recordId ? <Loader2 className="h-4 w-4 animate-spin" /> : record.hasFile ? "Download PDF" : "No file stored"}</Button><Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(record)} disabled={deletingId === record.recordId}>{deletingId === record.recordId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}</Button></div>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Record ID: {record.recordId}</span>
                    <span>Uploaded: {new Date(record.createdAt).toLocaleString()}</span>
                    <span className="break-all sm:col-span-2">Storage reference: {record.ipfsHash}</span>
                    <span>FHIR resources: {Array.isArray(record.fhirBundle.entry) ? record.fhirBundle.entry.length : 0}</span>
                    <span className="break-all sm:col-span-2">Clinical commitment: {record.clinicalCommitment || "Not generated"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
