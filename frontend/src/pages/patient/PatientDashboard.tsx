import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyRecords, getPatientStats, getRecentActivity, ActivityItem, PatientRecord } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { Activity, CalendarDays, CheckCircle2, Clock, Eye, FileHeart, FileText, FlaskConical, LockKeyhole, Pill, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PatientDashboard() {
  const [stats, setStats] = useState<{ totalRecords: number; activeDoctors: number; pendingRequests: number } | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([getPatientStats(), getRecentActivity(), getMyRecords()]).then(([s, a, r]) => {
      setStats(s);
      setActivity(a);
      setRecords(r);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div className="-mx-6 -mt-6 flex items-center justify-between gap-4 bg-destructive px-6 py-3 text-destructive-foreground"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /><p className="text-sm font-semibold">Emergency Break-Glass Protection Active: access requires 2-of-3 approval and minimum disclosure.</p></div><Badge className="hidden border-white/30 bg-white/10 text-white sm:flex">Record Integrity Protected</Badge></div>
      <div className="rounded-xl bg-primary p-6 text-primary-foreground shadow-sm"><div className="mb-3 flex items-center gap-2"><Badge className="border-secondary/40 bg-secondary/20 text-primary-foreground">Verified Patient Portal</Badge><span className="font-mono text-sm opacity-80">Wallet: {user?.wallet?.slice(0, 6)}...{user?.wallet?.slice(-4)}</span></div><h1 className="text-3xl font-bold">Welcome back, {user?.fullName || "Patient"}</h1><p className="mt-2 max-w-2xl text-sm opacity-85">Your healthcare records are cryptographically secured. You control authorized clinicians and emergency break-glass disclosures.</p></div>
      <div className="flex items-center justify-between rounded-lg border border-secondary/30 bg-secondary/5 p-4 text-sm"><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-secondary" /><span><strong>Emergency protection active:</strong> your medical vault is locked and disclosures are logged.</span></div><Badge variant="outline" className="border-secondary/40 text-secondary"><CheckCircle2 className="mr-1 h-4 w-4" />Integrity verified</Badge></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Medical Records</p><p className="mt-2 text-3xl font-bold">{loading ? "-" : records.length}</p><p className="mt-1 text-xs text-secondary">Encrypted records</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Active Consents</p><p className="mt-2 text-3xl font-bold text-primary">{loading ? "-" : stats?.activeDoctors || 0}</p><p className="mt-1 text-xs text-muted-foreground">Authorized clinicians</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Pending Requests</p><p className="mt-2 text-3xl font-bold text-warning">{loading ? "-" : stats?.pendingRequests || 0}</p><p className="mt-1 text-xs text-warning">Consent decisions</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Recent Access</p><p className="mt-2 text-3xl font-bold">{loading ? "-" : activity.length}</p><p className="mt-1 text-xs text-muted-foreground">Recorded events</p></CardContent></Card></div>
      <div className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-primary" />Upcoming Appointment</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">No appointment data available.</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-secondary" />Active Consent</CardTitle></CardHeader><CardContent><p className="font-semibold">{stats?.activeDoctors || 0} authorized clinicians</p><p className="mt-1 text-sm text-muted-foreground">Manage or revoke consent at any time.</p><Button className="mt-4" variant="outline">Manage Consents</Button></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-5 w-5 text-primary" />Recent Access</CardTitle></CardHeader><CardContent><p className="font-semibold">{activity.length ? `${activity.length} recorded events` : "No access recorded"}</p><p className="mt-1 text-sm text-muted-foreground">Review who accessed your records.</p></CardContent></Card></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileHeart className="h-5 w-5 text-primary" />Recent Medical Records</CardTitle></CardHeader><CardContent>{loading ? <Skeleton className="h-16 w-full" /> : records.length ? <div className="space-y-3">{records.slice(0, 3).map((record) => <div key={record.id} className="flex items-center justify-between rounded-md border p-4"><div><p className="font-semibold">{record.name || "Untitled medical record"}</p><p className="text-sm text-muted-foreground">{record.description || "Encrypted record"}</p></div><Badge variant="outline" className="border-secondary/40 text-secondary">Encrypted</Badge></div>)}</div> : <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No medical records uploaded yet.</div>}</CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Pill className="h-5 w-5 text-secondary" />Recent Prescription</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">No prescription data available.</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FlaskConical className="h-5 w-5 text-warning" />Recent Lab Report</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">No laboratory reports available.</p></CardContent></Card></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-secondary" />Access History</CardTitle></CardHeader><CardContent>{activity.length ? <Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Detail</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{activity.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.action}</TableCell><TableCell>{item.detail}</TableCell><TableCell className="text-muted-foreground">{item.timestamp}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">No access events recorded yet.</p>}</CardContent></Card>
    </div>
  );
}
