import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createEmergencyAccessRequest, getApprovedPatients, getDoctorAccessHistory, getEligibleEmergencyApprovers, getPatientRecordTargets, requestPatientAccess, PatientInfo, ActivityItem, EmergencyApproverHospital, PatientRecordTarget } from "@/services/api";
import { CalendarDays, Clock3, Loader2, Search, ShieldAlert, Siren, UserPlus, Users } from "lucide-react";
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
  const [eligibleEmergencyHospitals, setEligibleEmergencyHospitals] = useState<EmergencyApproverHospital[]>([]);
  const [selectedEmergencyHospital, setSelectedEmergencyHospital] = useState("");
  const [selectedEmergencyApprovers, setSelectedEmergencyApprovers] = useState<string[]>([]);
  const [loadingEmergencyApprovers, setLoadingEmergencyApprovers] = useState(false);
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not submit the access request");
    }
    finally { setRequesting(false); }
  };

  const handleEmergencyRequest = async () => {
    if (!emergencyPatient.trim() || !emergencyReason.trim() || !emergencyRecordId.trim()) {
      toast.error("Enter the patient wallet, choose a patient record, and provide the emergency reason");
      return;
    }
    if (emergencyReason.trim().length < 10) {
      toast.error("Please explain the emergency in at least 10 characters");
      return;
    }
    if (!selectedEmergencyHospital || selectedEmergencyApprovers.length !== 3) {
      toast.error("Select a hospital and exactly three emergency doctors");
      return;
    }
    setEmergencyRequesting(true);
    try {
      if (emergencyRecordId === "all") {
        let targets = emergencyRecords;
        if (!targets.length) {
          try {
            targets = await getPatientRecordTargets(emergencyPatient.trim());
            setEmergencyRecords(targets);
          } catch (err: any) {
            toast.error(err?.message || "Could not fetch patient records");
            return;
          }
        }
        if (!targets.length) {
          toast.error("No active records found for this patient");
          return;
        }

        // Create a single emergency request for all patient records using the primary record as anchor
        const primaryRecordId = targets[0].recordId;
        await createEmergencyAccessRequest(
          emergencyPatient.trim(),
          primaryRecordId,
          selectedEmergencyHospital,
          selectedEmergencyApprovers,
          "critical_condition",
          `[Entire Medical Record] ${emergencyReason.trim()}`,
          ["AllRecords", "Patient", "Condition", "AllergyIntolerance", "MedicationStatement", "DiagnosticReport"],
          "critical_condition",
        );

        toast.success("Emergency access request submitted for entire medical record (single request)");
        setEmergencyDialogOpen(false);
        setEmergencyReason("");
        setSelectedEmergencyApprovers([]);
        setEmergencyRecordId("");
      } else {
        await createEmergencyAccessRequest(
          emergencyPatient.trim(),
          Number(emergencyRecordId),
          selectedEmergencyHospital,
          selectedEmergencyApprovers,
          emergencyContext,
          emergencyReason.trim(),
          emergencyResources.split(",").map((resource) => resource.trim()).filter(Boolean),
          emergencyPredicate,
        );
        toast.success("Emergency access request submitted for approval");
        setEmergencyDialogOpen(false);
        setEmergencyReason("");
        setSelectedEmergencyApprovers([]);
        setEmergencyRecordId("");
      }
    } catch (error: any) {
      toast.error(error?.message || "Emergency request failed");
    } finally {
      setEmergencyRequesting(false);
    }
  };

  const loadEligibleEmergencyDoctors = async () => {
    setLoadingEmergencyApprovers(true);
    setSelectedEmergencyApprovers([]);
    try {
      const hospitals = await getEligibleEmergencyApprovers();
      setEligibleEmergencyHospitals(hospitals);
      setSelectedEmergencyHospital((current) =>
        hospitals.some((hospital) => hospital.id === current) ? current : hospitals[0]?.id || "",
      );
      if (!hospitals.length) {
        toast.error(
          "No eligible hospital: your hospital must enable emergency access for you and designate three other active doctors as emergency approvers. If you are one of only three doctors, a fourth doctor is needed.",
        );
      }
    } catch (error: any) {
      toast.error(error?.message || "Could not load emergency doctors");
    } finally {
      setLoadingEmergencyApprovers(false);
    }
  };

  const openEmergencyRequestDialog = () => {
    setEmergencyDialogOpen(true);
    void loadEligibleEmergencyDoctors();
  };

  const toggleEmergencyApprover = (wallet: string, checked: boolean) => {
    setSelectedEmergencyApprovers((selected) => {
      if (checked) return selected.length < 3 ? [...selected, wallet] : selected;
      return selected.filter((address) => address !== wallet);
    });
  };

  const loadEmergencyRecords = async (patientWallet?: string) => {
    const targetWallet = (patientWallet || emergencyPatient).trim();
    if (!targetWallet) return;
    setLoadingEmergencyRecords(true);
    try {
      const records = await getPatientRecordTargets(targetWallet);
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
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{user?.fullName || "Doctor"}</h1>
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
          <Dialog open={emergencyDialogOpen} onOpenChange={(open) => open ? openEmergencyRequestDialog() : setEmergencyDialogOpen(false)}>
            <DialogTrigger asChild>
              <Button variant="destructive"><Siren className="mr-2 h-4 w-4" />Request Emergency Access</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Emergency Access</DialogTitle>
                <DialogDescription>Select three active emergency doctors from your hospital. Only they receive this request; two must approve within 30 minutes.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedEmergencyHospital} onChange={(event) => { setSelectedEmergencyHospital(event.target.value); setSelectedEmergencyApprovers([]); }} disabled={loadingEmergencyApprovers || !eligibleEmergencyHospitals.length}>
                  <option value="">{loadingEmergencyApprovers ? "Loading hospitals..." : eligibleEmergencyHospitals.length ? "Choose a hospital" : "No eligible hospital available"}</option>
                  {eligibleEmergencyHospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.wallet}</option>)}
                </select>
                {eligibleEmergencyHospitals.find((hospital) => hospital.id === selectedEmergencyHospital) && (
                  <fieldset className="space-y-2 rounded-md border p-3">
                    <legend className="px-1 text-sm font-medium">Select 3 approvers by wallet address ({selectedEmergencyApprovers.length}/3)</legend>
                    {eligibleEmergencyHospitals.find((hospital) => hospital.id === selectedEmergencyHospital)?.doctors.map((doctor) => (
                      <label key={doctor.wallet} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 accent-primary"
                          checked={selectedEmergencyApprovers.includes(doctor.wallet)}
                          disabled={!selectedEmergencyApprovers.includes(doctor.wallet) && selectedEmergencyApprovers.length >= 3}
                          onChange={(event) => toggleEmergencyApprover(doctor.wallet, event.target.checked)}
                        />
                        <span className="min-w-0"><span className="block font-medium">{doctor.fullName || "Emergency doctor"}</span><span className="break-all font-mono text-xs text-muted-foreground">{doctor.wallet}</span></span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Patient wallet 0x..."
                    value={emergencyPatient}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmergencyPatient(val);
                      if (val.trim().length === 42 && val.startsWith("0x")) {
                        void loadEmergencyRecords(val.trim());
                      }
                    }}
                    onBlur={() => loadEmergencyRecords()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadEmergencyRecords()}
                    disabled={loadingEmergencyRecords || !emergencyPatient.trim()}
                  >
                    {loadingEmergencyRecords ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load records"}
                  </Button>
                </div>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={emergencyRecordId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmergencyRecordId(val);
                    if (val === "all") {
                      setEmergencyResources("Patient, Condition, AllergyIntolerance, MedicationStatement, DiagnosticReport");
                    }
                  }}
                  disabled={loadingEmergencyRecords || (!emergencyRecords.length && !emergencyPatient.trim())}
                >
                  <option value="">
                    {loadingEmergencyRecords
                      ? "Loading patient records..."
                      : emergencyRecords.length
                      ? "Choose a record or select entire medical record"
                      : emergencyPatient.trim()
                      ? "Select Entire Medical Record or click 'Load records'"
                      : "Enter a patient wallet first"}
                  </option>
                  {(emergencyRecords.length > 0 || emergencyPatient.trim()) && (
                    <option value="all" className="font-semibold text-primary">
                      🏥 Entire Medical Record {emergencyRecords.length ? `(All ${emergencyRecords.length} Records)` : "(All Patient Records)"}
                    </option>
                  )}
                  {emergencyRecords.map((record) => (
                    <option key={record.recordId} value={record.recordId}>
                      {record.name || "Untitled record"} (ID {record.recordId})
                    </option>
                  ))}
                </select>
                <div className="space-y-1">
                  <Input placeholder="Why is emergency access needed? (at least 10 characters)" value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} minLength={10} />
                  <p className="text-xs text-muted-foreground">Provide at least 10 characters describing why this access is needed.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmergencyDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleEmergencyRequest} disabled={emergencyRequesting || selectedEmergencyApprovers.length !== 3}>
                  {emergencyRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit for Approval
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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

    </div>
  );
}
