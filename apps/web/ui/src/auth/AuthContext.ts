import { createContext } from "react";
import type { AuthUser, Credentials } from "../types/auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  login: (credentials: Credentials) => Promise<void>;
  signUp: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
