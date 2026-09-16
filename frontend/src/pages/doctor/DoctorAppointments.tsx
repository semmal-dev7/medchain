import { useEffect, useState } from "react";
import { CalendarDays, Check, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Appointment, getDoctorAppointments, updateAppointmentStatus } from "@/services/api";
import { toast } from "sonner";

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const load = async () => { try { setAppointments(await getDoctorAppointments()); } catch (error: any) { toast.error(error?.message || "Could not load appointments"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const update = async (id: string, status: "confirmed" | "rejected") => { setActionId(id); try { await updateAppointmentStatus(id, status); toast.success(`Appointment ${status}`); await load(); } catch (error: any) { toast.error(error?.message || "Could not update appointment"); } finally { setActionId(null); } };
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Appointment Management</h1><p className="text-sm text-muted-foreground">Review and manage patient appointment requests.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-secondary" />Patient Requests</CardTitle></CardHeader><CardContent>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : appointments.length ? <div className="space-y-3">{appointments.map((appointment) => <div key={appointment.id} className="flex flex-col gap-3 rounded-md border p-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold">{appointment.patientName}</p><p className="text-sm text-muted-foreground">{new Date(appointment.scheduledFor).toLocaleString()}</p><p className="text-sm text-muted-foreground">{appointment.reason || "No reason provided"}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{appointment.status}</Badge>{appointment.status === "requested" ? <><Button size="sm" onClick={() => update(appointment.id, "confirmed")} disabled={actionId === appointment.id}><Check className="mr-1 h-4 w-4" />Confirm</Button><Button size="sm" variant="destructive" onClick={() => update(appointment.id, "rejected")} disabled={actionId === appointment.id}><X className="mr-1 h-4 w-4" />Reject</Button></> : null}</div></div>)}</div> : <p className="text-sm text-muted-foreground">No appointment requests yet.</p>}</CardContent></Card></div>;
}
