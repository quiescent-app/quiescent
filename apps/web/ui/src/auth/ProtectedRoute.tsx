import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./useAuth";

export default function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
