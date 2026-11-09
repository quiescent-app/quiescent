import { createContext } from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextType {
  status: AuthStatus;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
