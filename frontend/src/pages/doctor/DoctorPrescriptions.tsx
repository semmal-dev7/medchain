import { FilePlus2, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DoctorPrescriptions() {
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Prescriptions</h1><p className="text-sm text-muted-foreground">Create and review prescriptions for authorized patients.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-secondary" />Prescription Workspace</CardTitle></CardHeader><CardContent><div className="rounded-md border border-dashed p-8 text-center"><FilePlus2 className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No prescriptions recorded yet</p><p className="mt-1 text-sm text-muted-foreground">Prescription creation will be enabled after the prescription model is connected.</p><Button className="mt-4" disabled>Create Prescription</Button></div></CardContent></Card></div>;
}
