import { useState, type ReactNode } from "react";

import { AuthContext, type AuthStatus } from "./AuthContext";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => localStorage.getItem("quiescent.auth") ? "authenticated" : "unauthenticated");
  const api = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const store = (result: { accessToken: string; refreshToken: string; user: { email: string } }) => {
    localStorage.setItem("quiescent.auth", JSON.stringify(result));
    setStatus("authenticated");
  };

  async function authenticate(path: string, userEmail: string, password: string) {
    const response = await fetch(new URL(path, api), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: userEmail, password }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Authentication failed.");
    store(body);
  }

  async function login(userEmail: string, password: string) { await authenticate("/auth/login", userEmail, password); }
  async function signup(userEmail: string, password: string) { await authenticate("/auth/sign-up", userEmail, password); }
  async function logout() {
    const raw = localStorage.getItem("quiescent.auth");
    if (raw) {
      try {
        const session = JSON.parse(raw) as { refreshToken: string };
        await fetch(new URL("/auth/logout", api), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
      } catch { /* Clear the local session even if the API is offline. */ }
    }
    localStorage.removeItem("quiescent.auth");
    setStatus("unauthenticated");
  }

  return (
    <AuthContext.Provider value={{ status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
