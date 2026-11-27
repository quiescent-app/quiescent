import { Navigate, Outlet, useLocation, type Path } from "react-router-dom";

import { useAuth } from "./useAuth";

export type LoginLocationState = { from?: Path };

export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <main className="min-h-screen p-8 text-sm text-muted-foreground" role="status">Restoring your session…</main>;
  }

  if (status === "unauthenticated") {
    const state = { from: location };
    return <Navigate to="/login" replace state={state} />;
  }

  return <Outlet />;
}
