import { useCallback, useRef } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import { AppSidebar } from "./sidebar/AppSidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type LogoutGuard = () => boolean;
export type RegisterLogoutGuard = (guard: LogoutGuard) => () => void;

export default function AppLayout() {
  const { logout } = useAuth();
  const logoutGuard = useRef<LogoutGuard | null>(null);
  const loggingOut = useRef(false);
  const registerLogoutGuard = useCallback<RegisterLogoutGuard>((guard) => {
    logoutGuard.current = guard;
    return () => {
      if (logoutGuard.current === guard) logoutGuard.current = null;
    };
  }, []);

  async function handleLogout() {
    // 1. Prevent multiple simultaneous logout attempts
    // 2. If the logout guard returns false, prevent the logout.
    if (loggingOut.current || logoutGuard.current?.() === false) return;
    loggingOut.current = true;
    try {
      await logout();
    } finally {
      loggingOut.current = false;
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar onLogout={handleLogout} />

      <SidebarInset>
        <SidebarTrigger className="m-2 md:hidden" />
        <Outlet context={registerLogoutGuard} />
      </SidebarInset>
    </SidebarProvider>
  );
}
