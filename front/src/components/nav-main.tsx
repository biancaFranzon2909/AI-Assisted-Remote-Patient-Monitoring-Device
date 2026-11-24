import { NavLink, useLocation } from "react-router-dom"

import {
  isNavItemActive,
  navGroupOrder,
  type NavItem,
} from "@/components/navigation/nav-config"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      {navGroupOrder.map((group) => {
        const groupItems = items.filter((item) => item.group === group)
        if (groupItems.length === 0) return null

        return (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {groupItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isNavItemActive(pathname, item.href)}
                        tooltip={item.label}
                        className="relative h-11 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:font-semibold data-active:before:opacity-100 md:h-8 motion-reduce:before:transition-none"
                      >
                        <NavLink
                          to={item.href}
                          end={item.href === "/"}
                          onClick={closeMobile}
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}
