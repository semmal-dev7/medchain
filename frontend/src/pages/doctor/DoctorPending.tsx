import { Link, useNavigate } from "react-router-dom";
import { Building2, Clock3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export default function DoctorPending() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader><Clock3 className="mx-auto h-10 w-10 text-warning" /><CardTitle>Hospital approval pending</CardTitle></CardHeader>
        <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Your doctor identity was created, but you are not part of the MedChain network yet. A hospital administrator must approve your registration request first.</p><div className="rounded-md border border-secondary/30 bg-secondary/5 p-4 text-sm text-muted-foreground"><Building2 className="mx-auto mb-2 h-5 w-5 text-secondary" />After approval, sign in again to access the doctor portal.</div><div className="flex justify-center gap-2"><Button variant="outline" onClick={() => { logout(); navigate("/doctor/login"); }}><LogOut className="mr-2 h-4 w-4" />Doctor login</Button><Button asChild><Link to="/">Home</Link></Button></div></CardContent>
      </Card>
    </div>
  );
}