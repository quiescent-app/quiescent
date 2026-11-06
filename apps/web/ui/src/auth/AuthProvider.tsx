import { useState, type ReactNode } from "react";

import { AuthContext, type AuthStatus } from "./AuthContext";

export default function AuthProvider({ children }: { children: ReactNode }) {
  // TODO: Initialize as "loading" and restore the session using refresh tokens.
  const [status, setStatus] = useState<AuthStatus>("authenticated");

  // TODO: Integrate login API and token management before updating the status.
  function login() {
    setStatus("authenticated");
  }

  // TODO: Integrate logout API, revoke refresh tokens, and clear the session.
  function logout() {
    setStatus("unauthenticated");
  }

  return (
    <AuthContext.Provider value={{ status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
