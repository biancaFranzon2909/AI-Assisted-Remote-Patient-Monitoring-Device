import {
  Building2,
  Clock,
  DollarSign,
  FileText,
  Home,
  ListChecks,
  Rocket,
  Calendar,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavGroup = "Lançamentos" | "Parceiros" | "Usuários"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  group: NavGroup
}

export const navGroupOrder: NavGroup[] = ["Lançamentos", "Parceiros", "Usuários"]

export const navItems: NavItem[] = [
  { label: "Início", href: "/", icon: Home, group: "Lançamentos" },
  { label: "Lançamentos", href: "/timesheet", icon: Clock, group: "Lançamentos" },
  { label: "Despesas", href: "/expenses", icon: DollarSign, group: "Lançamentos" },
  { label: "Parceiros", href: "/clients", icon: Building2, group: "Parceiros" },
  { label: "Projetos", href: "/projects", icon: Rocket, group: "Parceiros" },
  { label: "Atividades", href: "/activities", icon: ListChecks, group: "Parceiros" },
  { label: "Colaboradores", href: "/employees", icon: Users, group: "Usuários" },
  { label: "Administrativo", href: "/administrativo", icon: Calendar, group: "Usuários" },
  { label: "Relatórios", href: "/reports", icon: FileText, group: "Usuários" },
]

export const HOME_LABEL = "Início"

// Rotas fora do menu, mas exibidas no breadcrumb.
const extraRouteLabels: Record<string, string> = {
  profile: "Perfil",
}

export const routeLabels: Record<string, string> = {
  ...Object.fromEntries(
    navItems
      .filter((item) => item.href !== "/")
      .map((item) => [item.href.slice(1), item.label])
  ),
  ...extraRouteLabels,
}

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
