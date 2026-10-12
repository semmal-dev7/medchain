import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, Home, Stethoscope, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function DoctorLogin() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { connectWallet, switchWallet, signMessage, shortenedAddress, isConnecting } = useWallet();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const wallet = await connectWallet();
      await login(wallet, signMessage);
      const stored = JSON.parse(localStorage.getItem("healthchain_user") || "{}");
      if (stored.role !== "doctor") throw new Error("This wallet is not registered as a doctor");
      toast.success("Doctor portal opened");
      navigate("/doctor/dashboard");
    } catch (error: any) {
      toast.error(error?.message || "Doctor login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/")}><Home className="mr-1 h-4 w-4" />Home</Button>
          </div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Stethoscope className="h-6 w-6 text-primary" /></div>
          <CardTitle className="text-2xl">Doctor Portal</CardTitle>
          <CardDescription>Sign in to manage approved patients, appointments, records, and emergency requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">Doctor wallet: {shortenedAddress || "Not connected"}</div>
          <Button className="w-full" onClick={handleLogin} disabled={loading}><Wallet className="mr-2 h-4 w-4" />{loading ? "Signing in..." : "Sign In as Doctor"}</Button>
          <Button variant="outline" className="w-full" onClick={switchWallet} disabled={loading || isConnecting}>Switch MetaMask account</Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center">
          <p className="text-sm text-muted-foreground">New doctor? <Link to="/doctor/register" className="font-medium text-primary hover:underline">Register with a hospital</Link></p>
          <p className="text-sm text-muted-foreground">Patient? <Link to="/login" className="font-medium text-primary hover:underline">Patient login</Link></p>
        </CardFooter>
      </Card>
    </div>
  );
}
