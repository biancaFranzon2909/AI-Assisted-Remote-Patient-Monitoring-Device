import * as React from "react"
import { Link } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { HOME_LABEL, navItems } from "@/components/navigation/nav-config"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={HOME_LABEL}>
              <Link
                to="/"
                onClick={() => {
                  if (isMobile) setOpenMobile(false)
                }}
              >
                <img
                  src="/ChronosAzulFundoRemovido.png"
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 object-cover"
                />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-base font-bold text-sidebar-primary">
                    CHRONO
                  </span>
                  <span className="truncate text-xs font-semibold text-sidebar-foreground/70">
                    TRACKER
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Navegação principal">
          <NavMain items={navItems} />
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
