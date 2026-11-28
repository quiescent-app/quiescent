import { Navigate, Outlet, useLocation, type Location } from "react-router-dom";

import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();
  const extensionId = new URLSearchParams(location.search).get("extensionId");
  const from = (location.state as { from?: Location } | null)?.from;

  if (status === "loading") {
    return <main className="min-h-screen p-8 text-sm text-muted-foreground" role="status">Restoring your session…</main>;
  }

  if (status === "authenticated" && !extensionId) {
    return <Navigate to={from ?? "/library"} replace />;
  }

  return <Outlet />;
}
