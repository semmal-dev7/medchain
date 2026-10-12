import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, Home, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function PatientRegister() {
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { connectWallet, switchWallet, signMessage, shortenedAddress, isConnecting } = useWallet();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const wallet = await connectWallet();
      await register(fullName, "patient", wallet, signMessage);
      toast.success("Patient account created successfully");
      navigate("/patient/dashboard");
    } catch (error: any) {
      toast.error(error?.message || "Patient registration failed");
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
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Activity className="h-6 w-6 text-primary" /></div>
          <CardTitle className="text-2xl">Patient Registration</CardTitle>
          <CardDescription>Create your private MedChain patient identity and control record access.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2"><Label htmlFor="patientFullName">Full name</Label><Input id="patientFullName" placeholder="John Doe" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></div>
            <div className="space-y-2"><Label>Patient wallet</Label><div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">{shortenedAddress || "Connect a wallet to continue"}</div></div>
            <div className="rounded-md border border-secondary/30 bg-secondary/5 p-4 text-sm text-muted-foreground">Your wallet is your MedChain identity. Medical records remain protected and are shared only through consent or approved emergency policies.</div>
            <Button type="button" variant="outline" className="w-full" onClick={switchWallet} disabled={loading || isConnecting}>Switch MetaMask account</Button>
            <Button className="w-full" type="submit" disabled={loading}><Wallet className="mr-2 h-4 w-4" />{loading ? "Creating patient account..." : "Create Patient Account"}</Button>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col gap-2 text-center">
          <p className="text-sm text-muted-foreground">Already a patient? <Link to="/login" className="font-medium text-primary hover:underline">Patient login</Link></p>
          <p className="text-sm text-muted-foreground">Hospital administrator? <Link to="/hospital/register" className="font-medium text-primary hover:underline">Register a hospital</Link></p>
        </CardFooter>
      </Card>
    </div>
  );
}
