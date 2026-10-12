import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createEmergencyAccessRequest, getApprovedPatients, getDoctorAccessHistory, getPatientRecordTargets, requestPatientAccess, PatientInfo, ActivityItem, PatientRecordTarget } from "@/services/api";
import { CalendarDays, CheckCircle2, Clock3, FileHeart, History, Loader2, Search, ShieldAlert, Siren, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function DoctorDashboard() {
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [history, setHistory] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestAddress, setRequestAddress] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyPatient, setEmergencyPatient] = useState("");
  const [emergencyContext, setEmergencyContext] = useState("road_accident");
  const [emergencyPredicate, setEmergencyPredicate] = useState("critical_drug_allergy");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyResources, setEmergencyResources] = useState("Patient, AllergyIntolerance, MedicationStatement");
  const [emergencyRecordId, setEmergencyRecordId] = useState("");
  const [emergencyRecords, setEmergencyRecords] = useState<PatientRecordTarget[]>([]);
  const [loadingEmergencyRecords, setLoadingEmergencyRecords] = useState(false);
  const [emergencyRequesting, setEmergencyRequesting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([getApprovedPatients(), getDoctorAccessHistory()]).then(([p, h]) => {
      setPatients(p);
      setHistory(h);
      setLoading(false);
    });
  }, []);

  const handleRequest = async () => {
    if (!requestAddress.trim()) { toast.error("Enter a patient wallet address"); return; }
    setRequesting(true);
    try {
      await requestPatientAccess(requestAddress);
      toast.success("Access request sent");
      setRequestAddress("");
      setDialogOpen(false);
    } catch { toast.error("Request failed"); }
    finally { setRequesting(false); }
  };

  const handleEmergencyRequest = async () => {
    if (!emergencyPatient.trim() || !emergencyReason.trim() || !emergencyRecordId.trim()) {
      toast.error("Enter the patient wallet, choose a patient record, and provide the emergency reason");
      return;
    }
    setEmergencyRequesting(true);
    try {
      await createEmergencyAccessRequest(
        emergencyPatient,
        Number(emergencyRecordId),
        emergencyContext,
        emergencyReason,
        emergencyResources.split(",").map((resource) => resource.trim()).filter(Boolean),
        emergencyPredicate,
      );
      toast.success("Emergency access request submitted for approval");
      setEmergencyDialogOpen(false);
      setEmergencyReason("");
    } catch (error: any) {
      toast.error(error?.message || "Emergency request failed");
    } finally {
      setEmergencyRequesting(false);
    }
  };

  const loadEmergencyRecords = async () => {
    if (!emergencyPatient.trim()) return;
    setLoadingEmergencyRecords(true);
    setEmergencyRecords([]);
    setEmergencyRecordId("");
    try {
      const records = await getPatientRecordTargets(emergencyPatient);
      setEmergencyRecords(records);
      if (!records.length) toast.error("No active records found for this patient");
    } catch (error: any) {
      toast.error(error?.message || "Could not load patient records");
    } finally {
      setLoadingEmergencyRecords(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="-mx-6 -mt-6 flex items-center justify-between gap-4 bg-destructive px-6 py-3 text-destructive-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <p className="truncate text-sm font-semibold">Emergency Break-Glass Protocol: controlled access requires multi-party approval.</p>
        </div>
        <Badge className="hidden shrink-0 border-white/30 bg-white/10 text-white sm:flex">Minimum Disclosure Filter Active</Badge>
      </div>

      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>MedChain</span><span>/</span><span>Doctor</span><span>/</span><span className="text-primary">Overview Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <div className="hidden items-center rounded-md border bg-card px-3 text-sm text-muted-foreground xl:flex">
            <Search className="mr-2 h-4 w-4" />Search patients, FHIR resources...
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Request Access</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Patient Access</DialogTitle>
                <DialogDescription>Enter the patient's wallet address to request access to their records.</DialogDescription>
              </DialogHeader>
              <Input placeholder="0x..." value={requestAddress} onChange={(e) => setRequestAddress(e.target.value)} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleRequest} disabled={requesting}>
                  {requesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={emergencyDialogOpen} onOpenChange={setEmergencyDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive"><Siren className="mr-2 h-4 w-4" />Request Emergency Access</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Emergency Access</DialogTitle>
                <DialogDescription>Request only the minimum patient information needed for the emergency. This request requires approval.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2"><Input placeholder="Patient wallet 0x..." value={emergencyPatient} onChange={(e) => setEmergencyPatient(e.target.value)} onBlur={loadEmergencyRecords} /><Button type="button" variant="outline" onClick={loadEmergencyRecords} disabled={loadingEmergencyRecords}>{loadingEmergencyRecords ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load records"}</Button></div>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={emergencyRecordId} onChange={(e) => setEmergencyRecordId(e.target.value)} disabled={loadingEmergencyRecords || !emergencyRecords.length}>
                  <option value="">{loadingEmergencyRecords ? "Loading patient records..." : emergencyRecords.length ? "Choose the record needed for this emergency" : "Load a patient wallet's records first"}</option>
                  {emergencyRecords.map((record) => <option key={record.recordId} value={record.recordId}>{record.name || "Untitled record"} (ID {record.recordId})</option>)}
                </select>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={emergencyContext} onChange={(e) => setEmergencyContext(e.target.value)}>
                  <option value="road_accident">Road accident</option>
                  <option value="cardiac_event">Cardiac event</option>
                  <option value="critical_condition">Critical condition</option>
                  <option value="other">Other</option>
                </select>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={emergencyPredicate} onChange={(e) => setEmergencyPredicate(e.target.value)}>
                  <option value="critical_drug_allergy">Critical drug allergy</option>
                  <option value="anticoagulant_use">Anticoagulant use</option>
                  <option value="critical_medication">Critical medication</option>
                  <option value="blood_group">Blood group</option>
                  <option value="emergency_contraindication">Emergency contraindication</option>
                  <option value="critical_condition">Critical condition</option>
                </select>
                <Input placeholder="Why is emergency access needed?" value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} />
                <Input placeholder="FHIR resources, comma-separated" value={emergencyResources} onChange={(e) => setEmergencyResources(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmergencyDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleEmergencyRequest} disabled={emergencyRequesting}>
                  {emergencyRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit for Approval
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-primary/15 bg-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Badge variant="outline" className="border-primary/30 text-primary">Clinical Command Center</Badge> Secure clinical workspace</div>
            <h2 className="text-2xl font-bold text-foreground">Clinical Overview - {user?.fullName || "Doctor"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Verified medical workspace</p>
          </div>
          <Button variant="destructive" onClick={() => setEmergencyDialogOpen(true)}><ShieldAlert className="mr-2 h-4 w-4" />Request Emergency Access</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>Authorized Patients</span><Users className="h-5 w-5 text-primary" /></div><p className="mt-3 text-3xl font-bold">{patients.length}</p><p className="mt-1 text-xs text-secondary">Live consent access</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>Today's Appointments</span><CalendarDays className="h-5 w-5 text-secondary" /></div><p className="mt-3 text-3xl font-bold">0 Scheduled</p><p className="mt-1 text-xs text-muted-foreground">No appointment data available</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>Access Events</span><Clock3 className="h-5 w-5 text-warning" /></div><p className="mt-3 text-3xl font-bold">{history.length}</p><p className="mt-1 text-xs text-warning">Recorded events</p></CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>Active Emergencies</span><ShieldAlert className="h-5 w-5 text-destructive" /></div><p className="mt-3 text-3xl font-bold text-destructive">0 Active</p><p className="mt-1 text-xs text-destructive">No active emergency grants</p></CardContent></Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between"><div><CardTitle className="text-lg">Today's Appointments</CardTitle><p className="mt-1 text-sm text-muted-foreground">Outpatient consultation and clinical rounds</p></div><Button variant="link">View Calendar -&gt;</Button></div>
        </CardHeader>
        <CardContent>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead><TableHead>Time</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody><TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No appointments scheduled.</TableCell></TableRow></TableBody>
            </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-lg">Recent Patients</CardTitle><p className="mt-1 text-sm text-muted-foreground">Recently evaluated under clinical consent</p></div><Button variant="link">My Patients Directory -&gt;</Button></div></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
            <Table><TableHeader><TableRow><TableHead>Patient</TableHead><TableHead>Last Visit</TableHead><TableHead>Records</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
              {patients.slice(0, 4).map((p) => <TableRow key={p.id}><TableCell><p className="font-semibold">{p.name}</p><p className="font-mono text-xs text-muted-foreground">{p.wallet}</p></TableCell><TableCell className="text-muted-foreground">Recent clinical visit</TableCell><TableCell>{p.recordCount} EHR records</TableCell><TableCell><Badge variant="outline" className={p.status === "approved" ? "border-success/40 text-success" : "border-warning/40 text-warning"}>{p.status}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline"><FileHeart className="mr-2 h-4 w-4" />Examine EHR</Button></TableCell></TableRow>)}
            </TableBody></Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30 shadow-sm">
        <CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-lg"><ShieldAlert className="h-5 w-5 text-destructive" />Emergency Break-Glass Requests</CardTitle><p className="mt-1 text-sm text-destructive">Controlled emergency pipeline requiring multi-party threshold verification</p></div><Button variant="link" className="text-destructive">Emergency Access Center -&gt;</Button></div></CardHeader>
        <CardContent><div className="rounded-md border border-destructive/20 bg-destructive/5 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-foreground">No active emergency requests</p><p className="text-sm text-muted-foreground">Create a break-glass request to begin context verification and 2-of-3 approval.</p></div><Button variant="destructive" onClick={() => setEmergencyDialogOpen(true)}><Siren className="mr-2 h-4 w-4" />Open Pipeline</Button></div></div></CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5 text-secondary" />Access History</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : history.length ? <div className="grid gap-3 sm:grid-cols-2">{history.slice(0, 4).map((h) => <div key={h.id} className="rounded-md border p-4"><p className="font-medium">{h.action}</p><p className="text-sm text-muted-foreground">{h.detail}</p><p className="mt-1 text-xs text-muted-foreground">{h.timestamp}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No access events recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
