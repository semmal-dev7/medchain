import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Wallet, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

export function Navbar() {
  const { user, logout } = useAuth();
  const { walletAddress, shortenedAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4">
      <SidebarTrigger className="text-foreground" />

      <div className="flex-1" />

      {walletAddress ? (
        <Badge
          variant="outline"
          className="cursor-pointer gap-1.5 border-secondary/40 bg-secondary/10 text-secondary-foreground/80 hover:bg-secondary/20"
          onClick={disconnectWallet}
        >
          <Wallet className="h-3 w-3" />
          {shortenedAddress}
        </Badge>
      ) : (
        <Button variant="outline" size="sm" onClick={connectWallet} disabled={isConnecting}>
          <Wallet className="mr-1.5 h-3.5 w-3.5" />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      )}

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {(user?.fullName || user?.wallet || "User")} ({user?.role})
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
