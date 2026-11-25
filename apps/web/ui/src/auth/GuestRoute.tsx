import { Navigate, Outlet, useSearchParams } from "react-router-dom";

import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { status } = useAuth();
  const [params] = useSearchParams();

  if (status === "loading") {
    return <main className="min-h-screen p-8 text-sm text-muted-foreground" role="status">Restoring your session…</main>;
  }

  if (status === "authenticated" && !params.has("extensionId")) {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}
