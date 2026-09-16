import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface WalletContextType {
  walletAddress: string | null;
  isConnecting: boolean;
  connectWallet: () => Promise<string>;
  switchWallet: () => Promise<string>;
  disconnectWallet: () => void;
  signMessage: (message: string) => Promise<string>;
  shortenedAddress: string;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

const WALLET_KEY = "healthchain_wallet";
const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(() => localStorage.getItem(WALLET_KEY));
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(async (): Promise<string> => {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }
    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = (accounts?.[0] || "").toLowerCase();
      if (!address) throw new Error("No wallet address returned");
      setWalletAddress(address);
      localStorage.setItem(WALLET_KEY, address);
      toast.success("Wallet connected");
      return address;
    } catch (err: any) {
      const msg = err?.message || "Failed to connect wallet";
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchWallet = useCallback(async (): Promise<string> => {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }
    setIsConnecting(true);
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
      const address = (accounts?.[0] || "").toLowerCase();
      if (!address) throw new Error("No wallet address returned");
      setWalletAddress(address);
      localStorage.setItem(WALLET_KEY, address);
      toast.success("MetaMask account switched");
      return address;
    } catch (err: any) {
      const msg = err?.message || "Failed to switch MetaMask account";
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!window.ethereum) throw new Error("MetaMask is not installed");
      const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
      const address = accounts?.[0] || walletAddress || (await connectWallet());
      if (!address) throw new Error("No wallet address returned");
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;
      return signature;
    },
    [walletAddress, connectWallet],
  );

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    localStorage.removeItem(WALLET_KEY);
    toast.info("Wallet disconnected");
  }, []);

  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[] | undefined) || [];
      const address = (accounts[0] || "").toLowerCase();
      setWalletAddress(address || null);
      if (address) localStorage.setItem(WALLET_KEY, address);
      else localStorage.removeItem(WALLET_KEY);
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
  }, []);

  const shortenedAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "";

  return (
    <WalletContext.Provider value={{ walletAddress, isConnecting, connectWallet, switchWallet, disconnectWallet, signMessage, shortenedAddress }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
