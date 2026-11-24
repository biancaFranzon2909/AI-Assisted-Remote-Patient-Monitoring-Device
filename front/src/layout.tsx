import { AppSidebar } from "./components/app-sidebar"
import { SiteHeader } from "./components/site-header"
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar"
import { getCookie } from "./lib/utils"
import { Outlet } from "react-router-dom"

export function Layout() {
  return (
    <SidebarProvider defaultOpen={getCookie("sidebar_state") !== "false"}>
      <AppSidebar />
      <SidebarInset className="h-svh min-w-0 overflow-hidden md:h-[calc(100svh-1rem)]">
        <SiteHeader />
        <div className="min-h-0 flex-1 overflow-y-auto pl-4 pb-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
