import { Navigate, Outlet, useSearchParams } from "react-router-dom";

import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { status } = useAuth();
  const [params] = useSearchParams();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "authenticated" && !params.has("extensionId")) {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}
