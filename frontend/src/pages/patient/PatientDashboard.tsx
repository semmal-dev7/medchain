import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyRecords, getPatientStats, getRecentActivity, ActivityItem, PatientRecord } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { CalendarDays, Eye, ShieldCheck } from "lucide-react";

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
      <div className="rounded-xl bg-primary p-6 text-primary-foreground shadow-sm">
        <h1 className="text-3xl font-bold">Welcome back, {user?.fullName || "Patient"}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-85">Your healthcare records are cryptographically secured. You control authorized clinicians and emergency break-glass disclosures.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Medical Records</p>
            <p className="mt-2 text-3xl font-bold">{loading ? "-" : records.length}</p>
            <p className="mt-1 text-xs text-secondary">Encrypted records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Active Consents</p>
            <p className="mt-2 text-3xl font-bold text-primary">{loading ? "-" : stats?.activeDoctors || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Authorized clinicians</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pending Requests</p>
            <p className="mt-2 text-3xl font-bold text-warning">{loading ? "-" : stats?.pendingRequests || 0}</p>
            <p className="mt-1 text-xs text-warning">Consent decisions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Recent Access</p>
            <p className="mt-2 text-3xl font-bold">{loading ? "-" : activity.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Recorded events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />Upcoming Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No appointment data available.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-secondary" />Active Consent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{stats?.activeDoctors || 0} authorized clinicians</p>
            <p className="mt-1 text-sm text-muted-foreground">Manage or revoke consent at any time.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-primary" />Recent Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{activity.length ? `${activity.length} recorded events` : "No access recorded"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Review who accessed your records.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
