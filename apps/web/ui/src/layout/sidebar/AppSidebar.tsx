import { NavLink, useLocation } from "react-router-dom";
import { BookOpen, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { mainNavigation, bottomNavigation } from "./navigation";

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();

  const { pathname } = useLocation();

  const collapsed = state === "collapsed";

  const renderNavigation = (items: typeof mainNavigation) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.path}>
          <SidebarMenuButton
            render={
              <NavLink
                to={item.path}
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              />
            }
            isActive={pathname === item.path}
            tooltip={item.label}
            className="h-10 rounded-lg px-3 text-sm"
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-[#dce5d8]">
      {/* Branding */}
      <SidebarHeader className="p-3">
        <div className="flex h-11 items-center gap-3 px-2 group-data-[collapsible=icon]:px-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#dce8d4]">
            <BookOpen className="size-4 text-[#304b42]" />
          </div>

          <span className="truncate font-serif text-lg text-[#233d35] group-data-[collapsible=icon]:hidden">
            Quiescent
          </span>
        </div>
      </SidebarHeader>

      {/* Main navigation */}
      <SidebarContent>
        <SidebarGroup className="px-3 py-2 group-data-[collapsible=icon]:px-2">
          {renderNavigation(mainNavigation)}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 pb-4 group-data-[collapsible=icon]:px-2">
        {/* Bottom navigation */}
        {renderNavigation(bottomNavigation)}

        {/* Log out */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Log out"
              className="h-10 rounded-lg px-3 text-sm"
              onClick={() => {
                // Implement logout functionality here
              }}
            >
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Collapse / Expand */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={collapsed ? "Expand" : "Collapse"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="h-10 rounded-lg px-3 text-sm"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              <span>{collapsed ? "Expand" : "Collapse"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
