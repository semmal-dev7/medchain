import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, Home, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { walletAddress, connectWallet, switchWallet, signMessage, isConnecting } = useWallet();
  const navigate = useNavigate();

  const handleWalletLogin = async () => {
    setLoading(true);
    try {
      const wallet = await connectWallet();
      await login(wallet, signMessage);
      const stored = JSON.parse(localStorage.getItem("healthchain_user") || "{}");
      toast.success("Logged in successfully");
      const dashboardPath = stored.role === "doctor" || stored.role === "patient" || stored.role === "emergency_approver"
        ? `/${stored.role}/dashboard`
        : "/";
      navigate(dashboardPath);
    } catch (err: any) {
      const message = err?.message || "Login failed";
      if (message === "Account not registered") {
        toast.error("This wallet is not registered. Please create an account first.");
        navigate("/register");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/")}>
              <Home className="mr-1 h-4 w-4" />
              Home
            </Button>
          </div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in with your wallet to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" className="w-full" onClick={handleWalletLogin} disabled={loading}>
            <Wallet className="mr-2 h-4 w-4" />
            {loading ? "Signing in..." : "Sign In with Wallet"}
          </Button>
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={switchWallet} disabled={loading || isConnecting}>
            Switch MetaMask account
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">Register</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
