import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { createHospital } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, Building2, Home, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function HospitalRegister() {
  const [adminName, setAdminName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalWallet, setHospitalWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { connectWallet, switchWallet, signMessage, shortenedAddress, isConnecting } = useWallet();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const adminWallet = await connectWallet();
      await register(adminName, "admin", adminWallet, signMessage);
      await createHospital(hospitalName, hospitalWallet);
      toast.success("Hospital registered successfully");
      navigate("/admin/hospitals");
    } catch (error: any) {
      toast.error(error?.message || "Hospital registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/")}><Home className="mr-1 h-4 w-4" />Home</Button>
          </div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10"><Building2 className="h-6 w-6 text-secondary" /></div>
          <CardTitle className="text-2xl">Hospital Registration</CardTitle>
          <CardDescription>Create the hospital administrator account and register the hospital wallet.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2"><Label htmlFor="adminName">Hospital administrator name</Label><Input id="adminName" value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Hospital administrator" required /></div>
            <div className="space-y-2"><Label htmlFor="hospitalName">Hospital name</Label><Input id="hospitalName" value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} placeholder="Hospital B" required /></div>
            <div className="space-y-2"><Label htmlFor="hospitalWallet">Hospital wallet</Label><Input id="hospitalWallet" value={hospitalWallet} onChange={(event) => setHospitalWallet(event.target.value)} placeholder="0x..." required /><p className="text-xs text-muted-foreground">Use a unique wallet for each hospital in the shared network.</p></div>
            <div className="space-y-2"><Label>Administrator wallet</Label><div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">{shortenedAddress || "Connect a wallet to continue"}</div></div>
            <div className="rounded-md border border-secondary/30 bg-secondary/5 p-4 text-sm text-muted-foreground">Hospitals manage organizational identity, doctors, emergency policy, and oversight. Patient consent still controls normal medical-record access.</div>
            <Button type="button" variant="outline" className="w-full" onClick={switchWallet} disabled={loading || isConnecting}>Switch MetaMask account</Button>
            <Button className="w-full" type="submit" disabled={loading}><Wallet className="mr-2 h-4 w-4" />{loading ? "Registering hospital..." : "Register Hospital"}</Button>
          </CardContent>
        </form>
        <CardFooter className="justify-center text-center"><p className="text-sm text-muted-foreground">Already registered? <Link to="/hospital/login" className="font-medium text-primary hover:underline">Hospital login</Link></p></CardFooter>
      </Card>
    </div>
  );
}
