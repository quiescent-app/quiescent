import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    return <main className="min-h-screen p-8 text-sm text-muted-foreground" role="status">Restoring your session…</main>;
  }

  if (status === "authenticated") {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}
