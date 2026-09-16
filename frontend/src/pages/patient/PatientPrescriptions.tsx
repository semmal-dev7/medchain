import { Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PatientPrescriptions() {
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Prescriptions</h1><p className="text-sm text-muted-foreground">Review prescriptions issued by authorized clinicians.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-secondary" />Current Prescriptions</CardTitle></CardHeader><CardContent><div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No prescription data available.</div></CardContent></Card></div>;
}