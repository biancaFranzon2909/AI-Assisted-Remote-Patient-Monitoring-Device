import { Link } from "react-router-dom"
import { EllipsisVertical, LogOut, Sun, Moon, User as UserIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "./theme-provider"

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function UserIdentity({ name, email }: { name: string; email: string }) {
  return (
    <>
      <Avatar className="size-8">
        <AvatarImage src={import.meta.env.VITE_ICHIGO} alt="" />
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        {email && (
          <span className="truncate text-xs text-muted-foreground">
            {email}
          </span>
        )}
      </div>
    </>
  )
}

export function NavUser() {
  const { user, logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const { resolvedTheme, setTheme } = useTheme()

  if (!user) return null

  const name = user.nomeCompleto || user.nomeUsuario
  const email = user.email
  
  const handleMudancaTema = () => {
    if (resolvedTheme === "dark") {
      setTheme("light")
    } else {
      setTheme("dark")
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={`Abrir menu de ${name}`}
              className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserIdentity name={name} email={email} />
              <EllipsisVertical className="ml-auto" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                <UserIdentity name={name} email={email} />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link
                  to="/profile"
                  onClick={() => {
                    if (isMobile) setOpenMobile(false)
                  }}
                >
                  <UserIcon aria-hidden="true" />
                  Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <DropdownMenuItem onClick={handleMudancaTema}>
                  {resolvedTheme === "dark" ? (
                    <Moon aria-hidden="true"  />
                  ) : (
                    <Sun aria-hidden="true"  />
                  )}
                  <span>Tema</span>
                </DropdownMenuItem>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
