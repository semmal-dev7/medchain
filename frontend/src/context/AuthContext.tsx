import React, { createContext, useCallback, useContext, useState } from "react";
import { authenticateWallet, clearAuthTokens, fetchMe } from "@/services/api";
import { registerOnChain } from "@/services/api";

export type UserRole = "patient" | "doctor" | "admin" | "emergency_approver";

export interface User {
  wallet: string;
  fullName: string;
  role: UserRole;
  status: "active" | "pending" | "suspended";
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (wallet: string, signMessage: (message: string) => Promise<string>) => Promise<void>;
  register: (
    fullName: string,
    role: UserRole,
    wallet: string,
    signMessage: (message: string) => Promise<string>,
  ) => Promise<void>;
  logout: () => void;
}

const SESSION_KEY = "healthchain_user";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toUser = (profile: any): User => ({
  wallet: profile.wallet,
  fullName: profile.full_name || "",
  role: profile.role,
  status: profile.status,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  });

  const login = useCallback(async (wallet: string, signMessage: (message: string) => Promise<string>) => {
    await authenticateWallet(wallet, signMessage);
    const profile = await fetchMe();
    const userData = toUser(profile);
    setUser(userData);
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
  }, []);

  const register = useCallback(
    async (
      fullName: string,
      role: UserRole,
      wallet: string,
      signMessage: (message: string) => Promise<string>,
    ) => {
      if (role === "patient" || role === "doctor") {
        await registerOnChain(role);
      }
      const profile = await authenticateWallet(wallet, signMessage, role, fullName);
      const userData = toUser(profile);
      setUser(userData);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuthTokens();
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
