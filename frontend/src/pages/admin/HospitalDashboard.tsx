import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, HospitalMember, DoctorHospitalRequest, getMyHospitals, getHospitalDoctorRequests, getHospitalMembers, getHospitalPublicAudit, reviewHospitalDoctorRequest, updateHospitalDoctor } from "@/services/api";

interface PublicAudit {
  hospital: { id: string; name: string; wallet: string; status: string };
  doctors: Array<{ wallet: string; name: string; role: string; active: boolean }>;
}

export default function HospitalDashboard() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [requests, setRequests] = useState<DoctorHospitalRequest[]>([]);
  const [members, setMembers] = useState<HospitalMember[]>([]);
  const [audit, setAudit] = useState<PublicAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    try {
      const rows = await getMyHospitals();
      setHospitals(rows);
      if (!selectedHospital && rows[0]) setSelectedHospital(rows[0].id);
    } catch (error: any) {
      toast.error(error?.message || "Could not load hospitals");
    } finally {
      setLoading(false);
    }
  };

  const loadSelected = async () => {
    if (!selectedHospital) return;
    try {
      const [doctorRequests, response, hospitalMembers] = await Promise.all([
        getHospitalDoctorRequests(selectedHospital),
        getHospitalPublicAudit(selectedHospital),
        getHospitalMembers(selectedHospital),
      ]);
      setRequests(doctorRequests);
      setAudit(response);
      setMembers(hospitalMembers);
    } catch (error: any) {
      toast.error(error?.message || "Could not load hospital audit");
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadSelected(); }, [selectedHospital]);

  const review = async (requestId: string, decision: "approve" | "reject") => {
    setActionId(requestId);
    try {
      await reviewHospitalDoctorRequest(selectedHospital, requestId, decision);
      toast.success(decision === "approve" ? "Doctor request approved" : "Doctor request rejected");
      await loadSelected();
    } catch (error: any) {
      toast.error(error?.message || "Could not review doctor request");
    } finally {
      setActionId(null);
    }
  };

  const setEmergencyAccess = async (member: HospitalMember) => {
    setActionId(member.wallet);
    try {
      await updateHospitalDoctor(selectedHospital, member.wallet, { emergency_access: !member.emergency_access });
      toast.success(member.emergency_access ? "Emergency access disabled" : "Emergency access enabled");
      await loadSelected();
    } catch (error: any) {
      toast.error(error?.message || "Could not update emergency access");
    } finally {
      setActionId(null);
    }
  };

  const setEmergencyApproverRole = async (member: HospitalMember) => {
    setActionId(member.wallet);
    try {
      const role = member.role === "emergency_doctor" ? "doctor" : "emergency_doctor";
      await updateHospitalDoctor(selectedHospital, member.wallet, {
        role,
        ...(role === "emergency_doctor" ? { emergency_access: true } : {}),
      });
      toast.success(role === "emergency_doctor" ? "Doctor enabled as an emergency approver" : "Emergency approver role removed");
      await loadSelected();
    } catch (error: any) {
      toast.error(error?.message || "Could not update emergency approver role");
    } finally {
      setActionId(null);
    }
  };

  const currentHospital = hospitals.find((h) => h.id === selectedHospital) || audit?.hospital;
  const hospitalDisplayName = currentHospital?.name || "Hospital Dashboard";

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{hospitalDisplayName}</h1><p className="text-sm text-muted-foreground">Handle doctor verification requests and publish a transparent hospital affiliation audit.</p></div>
      {hospitals.length > 1 && <select className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedHospital} onChange={(event) => setSelectedHospital(event.target.value)}>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.wallet}</option>)}</select>}
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : !selectedHospital ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No registered hospitals are available.</CardContent></Card> : <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-warning" />Doctor Requests</CardTitle></CardHeader><CardContent>{requests.filter((item) => item.status === "pending").length ? <div className="space-y-3">{requests.filter((item) => item.status === "pending").map((item) => <div key={item.id} className="rounded-md border p-4"><p className="font-semibold">{item.doctor_name || item.doctor_wallet}</p><p className="font-mono text-xs text-muted-foreground">{item.doctor_wallet}</p><p className="mt-2 text-sm text-muted-foreground">Requested role: {item.requested_role}</p><p className="mt-1 text-sm text-muted-foreground">{item.reason || "No reason provided"}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => review(item.id, "approve")} disabled={actionId === item.id}><CheckCircle2 className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" onClick={() => review(item.id, "reject")} disabled={actionId === item.id}><XCircle className="mr-1 h-4 w-4" />Reject</Button></div></div>)}</div> : <p className="text-sm text-muted-foreground">No pending doctor requests.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-secondary" />Public Hospital Audit</CardTitle></CardHeader><CardContent>{audit ? <div className="space-y-4"><div className="rounded-md border bg-muted/30 p-4"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><p className="font-semibold">{audit.hospital.name}</p><Badge variant="outline">{audit.hospital.status}</Badge></div><p className="mt-2 break-all font-mono text-xs text-muted-foreground">Hospital wallet: {audit.hospital.wallet}</p></div><div><p className="mb-2 text-sm font-medium">Related doctors ({audit.doctors.length})</p>{audit.doctors.length ? <div className="space-y-2">{audit.doctors.map((doctor) => <div key={doctor.wallet} className="flex items-center justify-between rounded-md border p-3 text-sm"><div><p className="font-medium">{doctor.name || doctor.wallet}</p><p className="font-mono text-xs text-muted-foreground">{doctor.wallet}</p></div><Badge variant="outline" className={doctor.active ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}>{doctor.active ? doctor.role : "revoked"}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">No affiliated doctors yet.</p>}</div></div> : <Loader2 className="h-4 w-4 animate-spin" />}</CardContent></Card>
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Emergency authorization</CardTitle><p className="text-sm text-muted-foreground">Requesters need emergency access. Each request also requires three other active emergency approvers. Use “Make emergency approver” to enable both the approver role and emergency access for a doctor. If the requester is one of only three doctors at the hospital, add a fourth doctor so three colleagues can be selected.</p></CardHeader><CardContent>{members.length ? <div className="space-y-2">{members.map((member) => <div key={member.wallet} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{member.full_name || member.wallet}</p><p className="font-mono text-xs text-muted-foreground">{member.wallet}</p><p className="text-xs text-muted-foreground">{member.role} · {member.active ? "active membership" : "inactive membership"} · {member.emergency_access ? "emergency access enabled" : "emergency access disabled"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={member.emergency_access ? "outline" : "destructive"} onClick={() => setEmergencyAccess(member)} disabled={!member.active || actionId === member.wallet}>{actionId === member.wallet ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{member.emergency_access ? "Revoke request access" : "Enable request access"}</Button><Button size="sm" variant="outline" onClick={() => setEmergencyApproverRole(member)} disabled={!member.active || actionId === member.wallet}>{member.role === "emergency_doctor" ? "Remove approver role" : "Make emergency approver"}</Button></div></div>)}</div> : <p className="text-sm text-muted-foreground">No doctor memberships found.</p>}</CardContent></Card>
      </div>}
    </div>
  );
}