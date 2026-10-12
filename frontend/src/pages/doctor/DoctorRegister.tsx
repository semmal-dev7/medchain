import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { Hospital, createDoctorHospitalRequest, getHospitals } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, Home, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function DoctorRegister() {
  const [fullName, setFullName] = useState("");
  const [hospitalWallet, setHospitalWallet] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [requestedRole, setRequestedRole] = useState<"doctor" | "emergency_doctor">("doctor");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { connectWallet, switchWallet, signMessage, shortenedAddress, isConnecting } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    getHospitals().then((rows) => {
      setHospitals(rows);
      if (rows[0]) setHospitalWallet(rows[0].wallet);
    }).catch(() => setHospitals([])).finally(() => setHospitalsLoading(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hospitalWallet) {
      toast.error("No active hospital is available. Ask a hospital administrator to register one first.");
      return;
    }
    setLoading(true);
    try {
      const wallet = await connectWallet();
      await register(fullName, "doctor", wallet, signMessage);
      await createDoctorHospitalRequest(hospitalWallet, requestedRole, reason);
      toast.success("Doctor registration request sent to the hospital");
      navigate("/doctor/pending");
    } catch (error: any) {
      toast.error(error?.message || "Could not submit doctor registration request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-2 flex items-center justify-between"><Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button><Button type="button" variant="ghost" size="sm" onClick={() => navigate("/")}><Home className="mr-1 h-4 w-4" />Home</Button></div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Activity className="h-6 w-6 text-primary" /></div>
          <CardTitle className="text-2xl">Doctor Registration</CardTitle>
          <CardDescription>Submit your wallet and hospital address for organizational verification.</CardDescription>
        </CardHeader>
        <form onSubmit={submit}><CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="doctorName">Full name</Label><Input id="doctorName" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Dr. Priya Kumar" required /></div>
          <div className="space-y-2"><Label htmlFor="hospitalWallet">Hospital wallet/address</Label><select id="hospitalWallet" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={hospitalWallet} onChange={(event) => setHospitalWallet(event.target.value)} disabled={hospitalsLoading || !hospitals.length} required><option value="">{hospitalsLoading ? "Loading hospitals..." : hospitals.length ? "Select a registered hospital" : "No active hospitals registered"}</option>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.wallet}>{hospital.name} · {hospital.wallet}</option>)}</select><p className="text-xs text-muted-foreground">Select the hospital wallet from the active MedChain directory.</p></div>
          <div className="space-y-2"><Label htmlFor="doctorRole">Requested hospital role</Label><select id="doctorRole" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as "doctor" | "emergency_doctor")}><option value="doctor">General Doctor</option><option value="emergency_doctor">Emergency Doctor</option></select></div>
          <div className="space-y-2"><Label htmlFor="reason">Reason for registration</Label><Input id="reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Department or emergency duty context" /></div>
          <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">Doctor wallet: {shortenedAddress || "Connect a wallet to continue"}</div>
          <Button type="button" variant="outline" className="w-full" onClick={switchWallet} disabled={loading || isConnecting}>Switch MetaMask account</Button>
          <Button className="w-full" type="submit" disabled={loading}><Wallet className="mr-2 h-4 w-4" />{loading ? "Sending request..." : "Request Hospital Verification"}</Button>
        </CardContent></form>
        <CardFooter className="justify-center text-center"><p className="text-sm text-muted-foreground">Already registered? <Link to="/doctor/login" className="font-medium text-primary hover:underline">Doctor login</Link></p></CardFooter>
      </Card>
    </div>
  );
}