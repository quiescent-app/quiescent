import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";

import type { LoginLocationState } from "./ProtectedRoute";
import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();

  if (status === "loading") {
    return <main className="min-h-screen p-8 text-sm text-muted-foreground" role="status">Restoring your session…</main>;
  }

  if (status === "authenticated" && !params.has("extensionId")) {
    const returnTo = (location.state as LoginLocationState | null)?.from;
    return <Navigate to={returnTo ?? "/library"} replace />;
  }

  return <Outlet />;
}
