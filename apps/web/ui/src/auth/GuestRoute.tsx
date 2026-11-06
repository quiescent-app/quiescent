import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "authenticated") {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}
