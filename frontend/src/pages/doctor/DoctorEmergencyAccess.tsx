import { ShieldAlert, Siren } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function DoctorEmergencyAccess() {
  const navigate = useNavigate();
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Emergency Access</h1><p className="text-sm text-muted-foreground">Controlled break-glass access with context verification, 2-of-3 approval, and temporary expiry.</p></div><Card className="border-destructive/30"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" />Break-Glass Protocol</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Request only the minimum FHIR resources needed for treatment. Access is issued only after approval.</p><Button className="mt-4" variant="destructive" onClick={() => navigate("/doctor/dashboard")}><Siren className="mr-2 h-4 w-4" />Open Request Workflow</Button></CardContent></Card></div>;
}
