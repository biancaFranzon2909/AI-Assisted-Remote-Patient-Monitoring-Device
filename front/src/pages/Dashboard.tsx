import { useEffect, useMemo, useState } from "react"
import {
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FolderKanban,
  Receipt,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdministrativeCalendar } from "@/components/administrative/administrative-calendar"
import { CalendarEntryDialog } from "@/components/administrative/calendar-entry-dialog"
import {
  createAdministrativeEntry,
  deleteAdministrativeEntry,
  updateAdministrativeEntry,
} from "@/components/administrative/administrative-api"
import {
  calendarEntryLabels,
  isManager as isAdministrativeManager,
  type CalendarEntry,
  type TeamMember,
  type WorkspaceRole,
} from "@/components/administrative/types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getDashboardStats,
  type DashboardApproval,
  type DashboardCalendarEntry,
  type DashboardClientReport,
  type DashboardExpense,
  type DashboardPeriodClosure,
  type DashboardStatsResponse,
} from "@/components/dashboard/dashboard-api"
import { useAuth } from "@/contexts/auth-context"
import { useWorkspace } from "@/contexts/workspace-context"
import { toast } from "sonner"

type ViewMode = "self" | "team"
type PeriodPreset = "week" | "month" | "custom"

interface TimeEntry {
  id: string
  dateKey: string
  employeeId: string
  userName: string
  projectId: string
  projectName: string
  clientId: string
  clientName: string
  minutes: number
  billable: boolean
  statusApproval: string | null
}

interface DashboardRange {
  from: Date
  to: Date
}

interface GroupedHours {
  name: string
  minutes: number
  count: number
}

interface DashboardOption {
  id: string
  name: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function readString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" || typeof value === "number") {
      return String(value)
    }
  }

  return ""
}

function toDateKey(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, "yyyy-MM-dd")
  }
  if (typeof value !== "string") return ""

  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd")
}

function toDashboardTimeEntry(
  entry: DashboardStatsResponse["timeEntries"][number]
): TimeEntry {
  return {
    id: entry.id,
    dateKey: entry.date,
    employeeId: entry.employeeId,
    userName: entry.employeeName,
    projectId: entry.projectId,
    projectName: entry.projectName,
    clientId: entry.clientId,
    clientName: entry.clientName,
    minutes: entry.durationMinutes,
    billable: entry.billable,
    statusApproval: entry.approvalStatus,
  }
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`
}

function formatCurrencyCents(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100)
}

function expenseStatusLabel(status: DashboardExpense["status"]) {
  const labels: Record<DashboardExpense["status"], string> = {
    DRAFT: "Rascunho",
    PENDING: "Em análise",
    APPROVED: "Aprovada",
    REJECTED: "Rejeitada",
    PAID: "Paga",
  }
  return labels[status]
}

function groupByName(
  entries: TimeEntry[],
  getName: (entry: TimeEntry) => string
) {
  const groups = new Map<string, GroupedHours>()

  for (const entry of entries) {
    const name = getName(entry)
    const current = groups.get(name) ?? { name, minutes: 0, count: 0 }
    current.minutes += entry.minutes
    current.count += 1
    groups.set(name, current)
  }

  return [...groups.values()].sort(
    (first, second) => second.minutes - first.minutes
  )
}

function EmptyState({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  muted = false,
}: {
  title: string
  value: string
  description: string
  muted?: boolean
}) {
  return (
    <Card className="min-w-0 rounded-lg py-3 ring-border/80">
      <CardHeader className="gap-1 px-3 py-0">
        <CardTitle className="min-h-8 text-xs leading-tight font-normal text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        <p
          className={`text-xl font-semibold tracking-tight tabular-nums ${muted ? "text-muted-foreground" : ""}`}
        >
          {value}
        </p>
        <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-tight text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

function DashboardControls({
  isManager,
  view,
  onViewChange,
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  projects,
  selectedProject,
  onProjectChange,
  members,
  selectedMember,
  onMemberChange,
  clients,
  selectedClient,
  onClientChange,
}: {
  isManager: boolean
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  period: PeriodPreset
  onPeriodChange: (period: PeriodPreset) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  projects: DashboardOption[]
  selectedProject: string
  onProjectChange: (value: string) => void
  members: DashboardOption[]
  selectedMember: string
  onMemberChange: (value: string) => void
  clients: DashboardOption[]
  selectedClient: string
  onClientChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {isManager && (
          <div
            aria-label="Visão do dashboard"
            className="inline-flex rounded-lg border bg-background p-1"
            role="group"
          >
            <Button
              aria-pressed={view === "self"}
              onClick={() => onViewChange("self")}
              size="sm"
              variant={view === "self" ? "default" : "ghost"}
            >
              Minha visão
            </Button>
            <Button
              aria-pressed={view === "team"}
              onClick={() => onViewChange("team")}
              size="sm"
              variant={view === "team" ? "default" : "ghost"}
            >
              Equipe
            </Button>
          </div>
        )}

        <div
          aria-label="Período do dashboard"
          className="inline-flex rounded-lg border bg-background p-1"
          role="group"
        >
          {(
            [
              ["week", "Semana"],
              ["month", "Mês"],
              ["custom", "Personalizado"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              aria-pressed={period === value}
              onClick={() => onPeriodChange(value)}
              size="sm"
              variant={period === value ? "default" : "ghost"}
            >
              {label}
            </Button>
          ))}
        </div>

        {view === "team" && isManager ? (
          <>
            <Select value={selectedMember} onValueChange={onMemberChange}>
              <SelectTrigger
                aria-label="Filtrar por colaborador"
                className="w-full sm:w-48"
              >
                <SelectValue placeholder="Toda a equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda a equipe</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedClient} onValueChange={onClientChange}>
              <SelectTrigger
                aria-label="Filtrar por cliente"
                className="w-full sm:w-48"
              >
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <Select value={selectedProject} onValueChange={onProjectChange}>
            <SelectTrigger
              aria-label="Filtrar por projeto"
              className="w-full sm:w-48"
            >
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button asChild className="ml-auto">
          <Link to={isManager && view === "team" ? "/reports" : "/timesheet"}>
            {isManager && view === "team" ? (
              <FileCheck2 aria-hidden="true" className="size-4" />
            ) : (
              <Clock3 aria-hidden="true" className="size-4" />
            )}
            {isManager && view === "team"
              ? "Gerar relatório de cliente"
              : "Lançar horas"}
          </Link>
        </Button>
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            De
            <Input
              aria-label="Data inicial"
              className="w-40"
              onChange={(event) => onCustomFromChange(event.target.value)}
              type="date"
              value={customFrom}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Até
            <Input
              aria-label="Data final"
              className="w-40"
              onChange={(event) => onCustomToChange(event.target.value)}
              type="date"
              value={customTo}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function HoursByDayChart({ entries }: { entries: TimeEntry[] }) {
  const chartData = useMemo(() => {
    const days = new Map<string, number>()

    for (const entry of entries) {
      days.set(entry.dateKey, (days.get(entry.dateKey) ?? 0) + entry.minutes)
    }

    return [...days.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([dateKey, minutes]) => ({
        day: format(new Date(`${dateKey}T12:00:00`), "EEE d", { locale: ptBR }),
        hours: Number((minutes / 60).toFixed(2)),
        label: formatDuration(minutes),
      }))
  }, [entries])

  return (
    <Card className="min-w-0 rounded-lg py-3 ring-border/80">
      <CardHeader>
        <CardTitle className="text-base">Horas por dia</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <EmptyState>Nenhum lançamento de horas neste período.</EmptyState>
        ) : (
          <div
            aria-label="Gráfico de horas registradas por dia"
            className="h-64 w-full"
          >
            <ResponsiveContainer height="100%" width="100%">
              <BarChart
                data={chartData}
                margin={{ left: -16, right: 8, top: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  unit="h"
                  width={38}
                />
                <Tooltip
                  formatter={(_, __, item) => [item.payload.label, "Horas"]}
                  labelStyle={{ color: "var(--foreground)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar
                  dataKey="hours"
                  fill="var(--primary)"
                  maxBarSize={44}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GroupedHoursList({
  title,
  groups,
  emptyMessage,
  showCount = false,
}: {
  title: string
  groups: GroupedHours[]
  emptyMessage: string
  showCount?: boolean
}) {
  const maximum = Math.max(...groups.map((group) => group.minutes), 1)

  return (
    <Card className="min-w-0 rounded-lg py-3 ring-border/80">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {groups.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {groups.length} {showCount ? "colaboradores" : "itens"}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length === 0 ? (
          <EmptyState>{emptyMessage}</EmptyState>
        ) : (
          groups.map((group) => (
            <div className="space-y-1.5" key={group.name}>
              <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                <span className="truncate">{group.name}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatDuration(group.minutes)}
                </span>
              </div>
              <div
                aria-label={`${group.name}: ${formatDuration(group.minutes)}`}
                aria-valuemax={maximum}
                aria-valuemin={0}
                aria-valuenow={group.minutes}
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.max((group.minutes / maximum) * 100, 2)}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function TeamDashboard({
  entries,
  isLoading,
  loadError,
  onRetry,
  projects,
  approvals,
  clientReports,
}: {
  entries: TimeEntry[]
  isLoading: boolean
  loadError: string | null
  onRetry: () => void
  projects: GroupedHours[]
  approvals: DashboardApproval[]
  clientReports: DashboardClientReport[]
}) {
  const teamHours = entries.reduce((sum, entry) => sum + entry.minutes, 0)
  const billableMinutes = entries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.minutes, 0)
  const collaborators = new Set(entries.map((entry) => entry.userName)).size
  const clients = groupByName(entries, (entry) => entry.clientName)
  const members = groupByName(entries, (entry) => entry.userName)

  return (
    <div className="space-y-4">
      {loadError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          <span>{loadError}</span>
          <Button onClick={onRetry} size="sm" variant="outline">
            Tentar novamente
          </Button>
        </div>
      )}

      <section
        aria-label="Indicadores da equipe"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
      >
        <MetricCard
          description="Soma dos lançamentos encontrados"
          title="Horas da equipe"
          value={isLoading ? "…" : formatDuration(teamHours)}
        />
        <MetricCard
          description={`${collaborators} com horas registradas no período`}
          title="Colaboradores com lançamento"
          value={isLoading ? "…" : String(collaborators)}
        />
        <MetricCard
          description="Solicitações pendentes no período e nos filtros atuais"
          title="Aprovações pendentes"
          value={isLoading ? "…" : String(approvals.length)}
        />
        <MetricCard
          description="Soma dos lançamentos marcados como faturáveis"
          title="Horas faturáveis"
          value={isLoading ? "…" : formatDuration(billableMinutes)}
        />
        <MetricCard
          description="Projetos com lançamentos neste período"
          title="Projetos com atividade"
          value={isLoading ? "…" : String(projects.length)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
        <GroupedHoursList
          emptyMessage={
            loadError
              ? "Os dados da equipe não foram carregados."
              : "Nenhum lançamento de equipe neste período."
          }
          groups={members}
          showCount
          title="Carga por colaborador"
        />

        <Card className="min-w-0 rounded-lg py-3 ring-border/80">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Fila de aprovações</CardTitle>
            <Badge variant="outline">{approvals.length} pendente(s)</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvals.length === 0 ? (
              <EmptyState>Nenhuma aprovação pendente neste período.</EmptyState>
            ) : (
              <div className="divide-y">
                {approvals.slice(0, 4).map((approval) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    key={approval.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {approval.employeeName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {approval.summary}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">
                        {approval.type === "HOURS" ? "Horas" : "Despesa"}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(approval.submittedAt), "d MMM", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to="/timesheet?escopo=all">
                Abrir lançamentos
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
        <GroupedHoursList
          emptyMessage={
            loadError
              ? "Os dados de clientes não foram carregados."
              : "Nenhum lançamento associado a cliente neste período."
          }
          groups={clients}
          title="Horas por cliente"
        />

        <Card className="min-w-0 rounded-lg py-3 ring-border/80">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Relatórios de clientes</CardTitle>
            <Badge variant="outline">
              {clientReports.length} disponível(is)
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {clientReports.length === 0 ? (
              <EmptyState>
                Nenhum relatório disponível para os filtros atuais.
              </EmptyState>
            ) : (
              <div className="divide-y">
                {clientReports.slice(0, 4).map((report) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    key={`${report.clientId}-${report.period}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {report.clientName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Competência {report.period}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {report.templateConfigured
                        ? "Template configurado"
                        : "Sem template"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="outline">
              <Link to="/reports">
                Ir para relatórios
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function DashboardCalendar({
  currentUserId,
  role,
  employees,
  calendarEntries,
  isDashboardLoading,
}: {
  currentUserId: string
  role: WorkspaceRole
  employees: DashboardStatsResponse["employees"]
  calendarEntries: DashboardCalendarEntry[]
  isDashboardLoading: boolean
}) {
  const [entryOverride, setEntryOverride] = useState<{
    source: DashboardCalendarEntry[]
    entries: CalendarEntry[]
  } | null>(null)
  const members: TeamMember[] = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    role: employee.role,
    vh: "",
    responsible: "",
    projetoPrincipal: "",
  }))
  const [selectedDay, setSelectedDay] = useState<Date>()
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CalendarEntry>()

  const sourceEntries = useMemo(
    () =>
      calendarEntries.map((entry) => ({
        id: entry.id,
        tipo: entry.type,
        titulo: entry.title,
        data_inicio: entry.startsOn,
        data_fim: entry.endsOn,
        usuarioId: entry.employeeId ?? undefined,
      })),
    [calendarEntries]
  )
  const entries =
    entryOverride?.source === calendarEntries
      ? entryOverride.entries
      : sourceEntries

  function updateEntries(
    update: (currentEntries: CalendarEntry[]) => CalendarEntry[]
  ) {
    setEntryOverride({
      source: calendarEntries,
      entries: update(entries),
    })
  }

  const canManageTeam = isAdministrativeManager(role)
  const manageableMembers =
    role === "OWNER"
      ? members.filter((member) => member.id !== currentUserId)
      : []
  const entryMemberOptions =
    role === "OWNER"
      ? members.filter(
          (member) => member.role === "COLAB" || member.id === currentUserId
        )
      : members.filter((member) => member.id === currentUserId)
  const defaultEntryEmployeeId = canManageTeam
    ? manageableMembers[0]?.id
    : currentUserId
  const allowedEntryTypes = !canManageTeam
    ? (["FERIAS", "FALTA"] as const)
    : manageableMembers.length === 0
      ? (["FERIAS", "EVENTO"] as const)
      : (["FERIAS", "FALTA", "EVENTO"] as const)
  const upcomingEntries = entries
    .filter((entry) => {
      const endKey = toDateKey(entry.data_fim)
      return endKey && endKey >= format(new Date(), "yyyy-MM-dd")
    })
    .sort((first, second) =>
      toDateKey(first.data_inicio).localeCompare(toDateKey(second.data_inicio))
    )
    .slice(0, 4)

  function canManageEmployee(employeeId?: string) {
    if (!employeeId || !canManageTeam) return false
    const employee = members.find((member) => member.id === employeeId)
    if (employee?.role !== "COLAB") return false
    return role === "OWNER"
  }

  function canEditEntry(entry: CalendarEntry) {
    if (entry.tipo === "EVENTO") return canManageTeam
    if (role === "OWNER") return true
    if (entry.usuarioId === currentUserId) return true
    return role === "ADMIN" && canManageEmployee(entry.usuarioId)
  }

  async function handleSaveEntry(entry: CalendarEntry) {
    const existingEntry = entries.find(
      (currentEntry) => currentEntry.id === entry.id
    )
    if (existingEntry && !canEditEntry(existingEntry)) {
      toast.error("Você não tem permissão para alterar este registro.")
      return false
    }

    const response = existingEntry
      ? await updateAdministrativeEntry(entry)
      : await createAdministrativeEntry(entry)

    if (response.error) {
      toast.error(response.message || "Erro ao salvar registro.")
      return false
    }

    const returnedRecord = asRecord(response.data)
    const returnedId = returnedRecord
      ? readString(
          returnedRecord,
          "id",
          "administrativoId",
          "administrativo_id",
          "entradaId",
          "entrada_id"
        )
      : ""
    const savedEntry = { ...entry, id: returnedId || entry.id }
    updateEntries((currentEntries) =>
      existingEntry
        ? currentEntries.map((currentEntry) =>
            currentEntry.id === existingEntry.id ? savedEntry : currentEntry
          )
        : [...currentEntries, savedEntry]
    )
    toast.success(existingEntry ? "Registro atualizado" : "Registro adicionado")
    return true
  }

  async function handleDeleteEntry(entryId: string) {
    const entry = entries.find((currentEntry) => currentEntry.id === entryId)
    if (!entry || !canEditEntry(entry)) {
      toast.error("Você não tem permissão para excluir este registro.")
      return false
    }

    const response = await deleteAdministrativeEntry(entryId)
    if (response.error) {
      toast.error(response.message || "Erro ao excluir registro.")
      return false
    }

    updateEntries((currentEntries) =>
      currentEntries.filter((currentEntry) => currentEntry.id !== entryId)
    )
    toast.success("Registro excluído")
    return true
  }

  return (
    <div className="min-w-0 space-y-3">
      <AdministrativeCalendar
        canCreateEntry
        canEditEntry={canEditEntry}
        entries={entries}
        members={members}
        onCreateEntry={() => {
          setEditingEntry(undefined)
          setIsEntryDialogOpen(true)
        }}
        onEditEntry={(entry) => {
          setEditingEntry(entry)
          setIsEntryDialogOpen(true)
        }}
        onSelectedDayChange={setSelectedDay}
        selectedDay={selectedDay}
      />

      <CalendarEntryDialog
        allowedTypes={[...allowedEntryTypes]}
        defaultDate={selectedDay}
        defaultEmployeeId={defaultEntryEmployeeId}
        entry={editingEntry}
        memberOptions={entryMemberOptions}
        onDelete={handleDeleteEntry}
        onOpenChange={(open) => {
          setIsEntryDialogOpen(open)
          if (!open) setEditingEntry(undefined)
        }}
        onSave={handleSaveEntry}
        open={isEntryDialogOpen}
      />
    </div>
  )
}

function PersonalDashboard({
  entries,
  isLoading,
  loadError,
  onRetry,
  projects,
  expenses,
  periodClosure,
  employees,
  calendarEntries,
  calendarRole,
  currentUserId,
}: {
  entries: TimeEntry[]
  isLoading: boolean
  loadError: string | null
  onRetry: () => void
  projects: GroupedHours[]
  expenses: DashboardExpense[]
  periodClosure: DashboardPeriodClosure | null
  employees: DashboardStatsResponse["employees"]
  calendarEntries: DashboardCalendarEntry[]
  calendarRole: WorkspaceRole
  currentUserId: string
}) {
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0)
  const billableMinutes = entries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.minutes, 0)
  const pendingExpenses = expenses.filter(
    (expense) => expense.status === "PENDING"
  ).length

  return (
    <div className="space-y-4">
      {loadError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          <span>{loadError}</span>
          <Button onClick={onRetry} size="sm" variant="outline">
            Tentar novamente
          </Button>
        </div>
      )}

      <section
        aria-label="Indicadores pessoais"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
      >
        <MetricCard
          description="Soma dos lançamentos no período"
          title="Horas registradas"
          value={isLoading ? "…" : formatDuration(totalMinutes)}
        />
        <MetricCard
          description="Soma dos lançamentos marcados como faturáveis"
          title="Horas faturáveis"
          value={isLoading ? "…" : formatDuration(billableMinutes)}
        />
        <MetricCard
          description={`${entries.length} lançamento(s) listado(s) no período`}
          title="Lançamentos"
          value={isLoading ? "…" : String(entries.length)}
        />
        <MetricCard
          description="Despesas com aprovação pendente no período"
          title="Despesas em análise"
          value={isLoading ? "…" : String(pendingExpenses)}
        />
        <MetricCard
          description={
            periodClosure
              ? `${format(new Date(`${periodClosure.startsOn}T12:00:00`), "d MMM", { locale: ptBR })} – ${format(new Date(`${periodClosure.endsOn}T12:00:00`), "d MMM yyyy", { locale: ptBR })}`
              : "Nenhum período de fechamento associado"
          }
          title="Fechamento do período"
          value={
            isLoading
              ? "…"
              : periodClosure
                ? periodClosure.status === "CLOSED"
                  ? "Fechado"
                  : "Aberto"
                : "—"
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)]">
        <HoursByDayChart entries={entries} />
        <GroupedHoursList
          emptyMessage={
            loadError
              ? "Os projetos não foram carregados."
              : "Nenhum projeto com horas registradas neste período."
          }
          groups={projects}
          title="Distribuição por projeto"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <Card className="min-w-0 rounded-lg py-3 ring-border/80">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Meus projetos</CardTitle>
            <Button asChild size="sm" variant="link">
              <Link to="/projects">
                Ver todos
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState>
                {loadError
                  ? "Não foi possível carregar os projetos neste período."
                  : "Nenhum projeto tem lançamentos neste período."}
              </EmptyState>
            ) : (
              <div className="divide-y">
                {projects.slice(0, 6).map((project) => {
                  const rows = entries.filter(
                    (entry) => entry.projectName === project.name
                  )
                  const client = rows[0]?.clientName ?? "Cliente não informado"

                  return (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      key={project.name}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {project.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {client}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {formatDuration(project.minutes)}
                        </span>
                        <Badge variant="outline">Horas registradas</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-lg py-3 ring-border/80">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Pendências e alertas</CardTitle>
            <Badge variant="outline">
              <CircleAlert aria-hidden="true" className="size-3" />
              Verifique as áreas
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 border-b pb-3">
              <Clock3
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Lançamentos de horas</p>
                <p className="text-xs text-muted-foreground">
                  Consulte ou complete seus lançamentos.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/timesheet">Ver</Link>
              </Button>
            </div>
            <div className="flex items-start gap-3 border-b pb-3">
              <Receipt
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Despesas</p>
                <p className="text-xs text-muted-foreground">
                  Acompanhe suas despesas na tela dedicada.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/expenses">Ver</Link>
              </Button>
            </div>
            <div className="flex items-start gap-3">
              <FolderKanban
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Projetos</p>
                <p className="text-xs text-muted-foreground">
                  Confira prazos e informações dos projetos.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/projects">Ver</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <DashboardCalendar
          calendarEntries={calendarEntries}
          currentUserId={currentUserId}
          employees={employees}
          isDashboardLoading={isLoading}
          role={calendarRole}
        />
        <Card className="min-w-0 rounded-lg py-3 ring-border/80">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base">Despesas</CardTitle>
            <Button asChild size="sm" variant="link">
              <Link to="/expenses">
                Ver todas
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {expenses.length} despesa(s) no período
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrencyCents(
                  expenses.reduce(
                    (sum, expense) => sum + expense.amountCents,
                    0
                  )
                )}
              </span>
            </div>
            {expenses.length === 0 ? (
              <EmptyState>Nenhuma despesa neste período.</EmptyState>
            ) : (
              <div className="divide-y">
                {expenses.slice(0, 3).map((expense) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    key={expense.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {expense.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(`${expense.date}T12:00:00`),
                          "dd/MM/yyyy",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm tabular-nums">
                        {formatCurrencyCents(expense.amountCents)}
                      </span>
                      <Badge variant="outline">
                        {expenseStatusLabel(expense.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace()
  const isManager = Boolean(
    currentWorkspace?.isAdmin || currentWorkspace?.isOwner
  )
  const [view, setView] = useState<ViewMode>("team")
  const [period, setPeriod] = useState<PeriodPreset>("week")
  const [customFrom, setCustomFrom] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd")
  )
  const [customTo, setCustomTo] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  )
  const [selectedProject, setSelectedProject] = useState("all")
  const [selectedMember, setSelectedMember] = useState("all")
  const [selectedClient, setSelectedClient] = useState("all")
  const [dashboardStats, setDashboardStats] =
    useState<DashboardStatsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const activeView: ViewMode = isManager ? view : "self"

  const range = useMemo<DashboardRange>(() => {
    const today = new Date()
    if (period === "month") {
      return { from: startOfMonth(today), to: endOfMonth(today) }
    }
    if (period === "custom") {
      const from = new Date(`${customFrom}T00:00:00`)
      const to = new Date(`${customTo}T23:59:59`)
      return { from, to }
    }
    return {
      from: startOfWeek(today, { weekStartsOn: 0 }),
      to: endOfWeek(today, { weekStartsOn: 0 }),
    }
  }, [customFrom, customTo, period])

  const isRangeValid =
    !Number.isNaN(range.from.getTime()) &&
    !Number.isNaN(range.to.getTime()) &&
    !isAfter(range.from, range.to)

  useEffect(() => {
    if (isAuthLoading || isWorkspaceLoading) return
    let cancelled = false

    async function loadDashboard() {
      if (!user?.id || !currentWorkspace?.id) {
        setDashboardStats(null)
        setLoadError(
          "Não foi possível identificar o usuário ou o workspace atual."
        )
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError(null)
      setDashboardStats(null)
      try {
        const result = await getDashboardStats()
        if (cancelled) return
        if (!result.ok) {
          setDashboardStats(null)
          setLoadError(result.message)
          return
        }
        if (result.data.workspaceId !== currentWorkspace.id) {
          setDashboardStats(null)
          setLoadError(
            "A resposta do dashboard não corresponde ao workspace selecionado."
          )
          return
        }
        setDashboardStats(result.data)
      } catch (error) {
        if (cancelled) return
        setDashboardStats(null)
        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o dashboard."
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadDashboard()
    return () => {
      cancelled = true
    }
  }, [
    currentWorkspace?.id,
    isAuthLoading,
    isWorkspaceLoading,
    reloadKey,
    user?.id,
  ])

  const entries = useMemo(
    () => dashboardStats?.timeEntries.map(toDashboardTimeEntry) ?? [],
    [dashboardStats]
  )

  const periodEntries = useMemo(
    () =>
      isRangeValid
        ? entries.filter((entry) => {
            const date = new Date(`${entry.dateKey}T12:00:00`)
            return (
              !isBefore(date, range.from) &&
              !isAfter(date, range.to) &&
              (activeView !== "self" ||
                entry.employeeId === String(user?.id ?? "")) &&
              (activeView !== "self" ||
                selectedProject === "all" ||
                entry.projectId === selectedProject) &&
              (activeView !== "team" ||
                selectedClient === "all" ||
                entry.clientId === selectedClient) &&
              (activeView !== "team" ||
                selectedMember === "all" ||
                entry.employeeId === selectedMember)
            )
          })
        : [],
    [
      activeView,
      entries,
      isRangeValid,
      range,
      selectedClient,
      selectedMember,
      selectedProject,
      user?.id,
    ]
  )

  const projectGroups = useMemo(
    () => groupByName(periodEntries, (entry) => entry.projectName),
    [periodEntries]
  )
  const projectOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const project of dashboardStats?.projects ?? []) {
      options.set(project.id, project.name)
    }
    for (const entry of entries) options.set(entry.projectId, entry.projectName)
    return [...options]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [dashboardStats, entries])
  const memberOptions = useMemo(
    () =>
      (dashboardStats?.employees ?? [])
        .map((employee) => ({ id: employee.id, name: employee.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [dashboardStats]
  )
  const clientOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const project of dashboardStats?.projects ?? []) {
      options.set(project.clientId, project.clientName)
    }
    for (const report of dashboardStats?.clientReports ?? []) {
      options.set(report.clientId, report.clientName)
    }
    for (const expense of dashboardStats?.expenses ?? []) {
      if (expense.clientId && expense.clientName) {
        options.set(expense.clientId, expense.clientName)
      }
    }
    for (const entry of entries) options.set(entry.clientId, entry.clientName)
    return [...options]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [dashboardStats, entries])

  const periodApprovals = useMemo(() => {
    if (!isRangeValid) return []
    return (dashboardStats?.pendingApprovals ?? []).filter((approval) => {
      const submittedAt = new Date(approval.submittedAt)
      return (
        !isBefore(submittedAt, range.from) &&
        !isAfter(submittedAt, range.to) &&
        (selectedMember === "all" || approval.employeeId === selectedMember)
      )
    })
  }, [dashboardStats, isRangeValid, range, selectedMember])
  const periodExpenses = useMemo(() => {
    if (!isRangeValid) return []
    return (dashboardStats?.expenses ?? []).filter((expense) => {
      const date = new Date(`${expense.date}T12:00:00`)
      return (
        !isBefore(date, range.from) &&
        !isAfter(date, range.to) &&
        (activeView !== "self" ||
          expense.employeeId === String(user?.id ?? "")) &&
        (activeView !== "team" ||
          selectedClient === "all" ||
          expense.clientId === selectedClient) &&
        (activeView !== "team" ||
          selectedMember === "all" ||
          expense.employeeId === selectedMember)
      )
    })
  }, [
    activeView,
    dashboardStats,
    isRangeValid,
    range,
    selectedClient,
    selectedMember,
    user?.id,
  ])
  const periodClosure = useMemo(() => {
    if (!isRangeValid) return null
    return (
      (dashboardStats?.periodClosures ?? [])
        .filter((closure) => {
          const startsOn = new Date(`${closure.startsOn}T12:00:00`)
          const endsOn = new Date(`${closure.endsOn}T12:00:00`)
          return !isBefore(endsOn, range.from) && !isAfter(startsOn, range.to)
        })
        .sort((first, second) =>
          second.endsOn.localeCompare(first.endsOn)
        )[0] ?? null
    )
  }, [dashboardStats, isRangeValid, range])
  const filteredClientReports = useMemo(() => {
    if (!isRangeValid) return []
    return (dashboardStats?.clientReports ?? []).filter((report) => {
      const monthStart = new Date(`${report.period}-01T12:00:00`)
      const monthEnd = endOfMonth(monthStart)
      return (
        !isBefore(monthEnd, range.from) &&
        !isAfter(monthStart, range.to) &&
        (selectedClient === "all" || report.clientId === selectedClient)
      )
    })
  }, [dashboardStats, isRangeValid, range, selectedClient])
  const calendarEntries = useMemo(
    () => dashboardStats?.calendarEntries ?? [],
    [dashboardStats]
  )

  const retry = () => setReloadKey((key) => key + 1)
  const subtitle = isRangeValid
    ? `${format(range.from, "d 'de' MMM", { locale: ptBR })} – ${format(range.to, "d 'de' MMM yyyy", { locale: ptBR })}`
    : "Período inválido"

  if (isAuthLoading || isWorkspaceLoading) {
    return (
      <div className="flex min-h-64 w-full items-center justify-center">
        <span className="text-sm text-muted-foreground">
          Carregando dashboard…
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-0 w-full space-y-4 pr-4 pb-6">
      <header className="flex flex-col gap-4 py-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {activeView === "team" ? "Dashboard da equipe" : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <DashboardControls
          clients={clientOptions}
          customFrom={customFrom}
          customTo={customTo}
          isManager={isManager}
          members={memberOptions}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onMemberChange={setSelectedMember}
          onPeriodChange={setPeriod}
          onProjectChange={setSelectedProject}
          onViewChange={setView}
          onClientChange={setSelectedClient}
          period={period}
          projects={projectOptions}
          selectedClient={selectedClient}
          selectedMember={selectedMember}
          selectedProject={selectedProject}
          view={activeView}
        />
      </header>

      {activeView === "team" ? (
        <TeamDashboard
          entries={periodEntries}
          isLoading={isLoading}
          loadError={loadError}
          onRetry={retry}
          projects={projectGroups}
          approvals={periodApprovals}
          clientReports={filteredClientReports}
        />
      ) : (
        <PersonalDashboard
          calendarRole={
            currentWorkspace?.isOwner
              ? "OWNER"
              : currentWorkspace?.isAdmin
                ? "ADMIN"
                : "COLAB"
          }
          currentUserId={String(user?.id ?? "")}
          entries={periodEntries}
          isLoading={isLoading}
          loadError={loadError}
          onRetry={retry}
          projects={projectGroups}
          expenses={periodExpenses}
          periodClosure={periodClosure}
          employees={dashboardStats?.employees ?? []}
          calendarEntries={calendarEntries}
        />
      )}
    </div>
  )
}
