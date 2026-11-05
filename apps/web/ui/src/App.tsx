import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/auth/ProtectedRoute";
import GuestRoute from "@/auth/GuestRoute";
import AppLayout from "@/layout";

import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import LibraryPage from "@/pages/LibraryPage";
import AccountPage from "@/pages/AccountPage";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  );
}
