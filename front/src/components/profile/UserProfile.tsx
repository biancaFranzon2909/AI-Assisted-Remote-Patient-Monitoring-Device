import { useNavigate } from "react-router-dom"
import { LogOut, User, EllipsisVertical, Sun, Moon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useWorkspace } from "@/contexts/workspace-context"
import { useTheme } from "../theme-provider"
import { useState, useEffect } from "react"

export function UserProfile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const nome_completo = user?.nomeCompleto ?? ""
  const { currentWorkspace } = useWorkspace()
  const cargo = currentWorkspace?.isOwner 
    ? "Dono" 
    : currentWorkspace?.isAdmin 
      ? "Administrador"
      : "Colaborador"


  const { resolvedTheme, setTheme } = useTheme()

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

  const Iniciais = () => {
    if (!nome_completo) return "?"

    try {
      const [nome1, nome2] = nome_completo.trim().split(" ").slice(0, 2)
      if (nome1 && nome2) {
        return (nome1[0] + nome2[0]).toUpperCase()
      }
    } catch (e) {
      console.log(e)
      return nome_completo.slice(0, 2).toUpperCase()
    }
  }

  return (
    <>
      {nome_completo && (
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Avatar>
            <AvatarImage src={import.meta.env.VITE_ICHIGO} />
            <AvatarFallback>{Iniciais()}</AvatarFallback>
          </Avatar>
          {/* Informações de texto truncadas para não quebrar o layout */}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="line-clamp-3 truncate text-[11px] font-semibold text-sidebar-foreground">
              {nome_completo}
            </span>
            <span className="line-clamp-3 truncate text-[11px] text-muted-foreground capitalize">
              {cargo}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full" variant="ghost" size="icon-lg">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              alignOffset={200}
              sideOffset={-20}
              className="w-54 p-1.5"
            >
              {/* Configurações */}
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="size-3.5 text-muted-foreground" />
                <span>Perfil</span>
              </DropdownMenuItem>

              {/* Mudança de tema darkmode e lightmode */}
              <DropdownMenuItem onClick={handleMudancaTema}>
                {resolvedTheme === "dark" ? (<Moon className="size-3.5 text-muted-foreground" />) : (<Sun className="size-3.5 text-muted-foreground" />)}
                <span>Tema</span>
              </DropdownMenuItem>

              {/* Logout */}
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-3.5" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  )
}
