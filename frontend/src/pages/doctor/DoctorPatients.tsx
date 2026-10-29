import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { FileHeart, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getApprovedPatients, PatientInfo } from "@/services/api";

export default function DoctorPatients() {
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  useEffect(() => { getApprovedPatients().then(setPatients).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">My Patients</h1><p className="text-sm text-muted-foreground">Patients available under active consent.</p></div><Card><CardHeader><CardTitle>Patient Directory</CardTitle></CardHeader><CardContent>{loading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : patients.length ? <div className="space-y-3">{patients.map((patient) => <div key={patient.id} className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{patient.name}</p><p className="font-mono text-xs text-muted-foreground">{patient.wallet}</p><p className="mt-1 text-sm text-muted-foreground">{patient.recordCount} records</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={patient.status === "approved" ? "border-success/40 text-success" : "border-warning/40 text-warning"}>{patient.status}</Badge><Button size="sm" variant="outline" onClick={() => navigate("/doctor/records")}><FileHeart className="mr-2 h-4 w-4" />View All Patient Records</Button></div></div>)}</div> : <p className="text-sm text-muted-foreground">No approved patients yet.</p>}</CardContent></Card></div>;
}
