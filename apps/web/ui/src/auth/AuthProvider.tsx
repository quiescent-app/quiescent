import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AuthContext, type AuthStatus } from "./AuthContext";
import {
  clearAccessToken,
  login as requestLogin,
  logout as requestLogout,
  refreshSession,
  signUp as requestSignUp,
  subscribeToAuthLoss,
  type AuthUser,
  type Credentials,
} from "./authApi";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToAuthLoss(() => {
      if (!active) return;
      setUser(null);
      setStatus("unauthenticated");
    });

    void refreshSession().then((session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setStatus(session ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    const session = await requestLogin(credentials);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const signUp = useCallback(async (credentials: Credentials) => {
    const session = await requestSignUp(credentials);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await requestLogout();
    } catch {
      // A failed revocation request must not leave the local UI authenticated.
    } finally {
      clearAccessToken();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
