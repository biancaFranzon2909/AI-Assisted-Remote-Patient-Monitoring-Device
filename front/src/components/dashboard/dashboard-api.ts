import { apiFetch } from "@/lib/api-client"
import type { CalendarEntryType } from "@/components/administrative/types"

export type DashboardApprovalType = "HOURS" | "EXPENSE"
export type DashboardApprovalStatus = "PENDING" | "APPROVED" | "REJECTED"
export type DashboardExpenseStatus =
  | DashboardApprovalStatus
  | "PAID"
  | "DRAFT"

export interface DashboardTimeEntry {
  id: string
  employeeId: string
  employeeName: string
  clientId: string
  clientName: string
  projectId: string
  projectName: string
  activityName: string | null
  date: string
  durationMinutes: number
  billable: boolean
  approvalStatus: DashboardApprovalStatus | null
}

export interface DashboardProject {
  id: string
  name: string
  clientId: string
  clientName: string
  status: string
  deadline: string | null
  budgetMinutes: number | null
  actualMinutes: number
  memberIds: string[]
}

export interface DashboardEmployee {
  id: string
  name: string
  role: "OWNER" | "ADMIN" | "COLAB"
  weeklyCapacityMinutes: number | null
}

export interface DashboardApproval {
  id: string
  type: DashboardApprovalType
  employeeId: string
  employeeName: string
  submittedAt: string
  summary: string
  durationMinutes: number | null
  amountCents: number | null
}

export interface DashboardExpense {
  id: string
  employeeId: string
  employeeName: string
  name: string
  description: string | null
  clientId: string | null
  clientName: string | null
  date: string
  amountCents: number
  status: DashboardExpenseStatus
}

export interface DashboardPeriodClosure {
  id: string
  startsOn: string
  endsOn: string
  status: "OPEN" | "CLOSED"
  closedAt: string | null
}

export interface DashboardClientReport {
  clientId: string
  clientName: string
  period: string
  templateConfigured: boolean
}

export interface DashboardCalendarEntry {
  id: string
  type: CalendarEntryType
  title: string
  startsOn: string
  endsOn: string
  employeeId: string | null
}

export interface DashboardStatsResponse {
  contractVersion: 1
  generatedAt: string
  workspaceId: string
  timeEntries: DashboardTimeEntry[]
  projects: DashboardProject[]
  employees: DashboardEmployee[]
  pendingApprovals: DashboardApproval[]
  expenses: DashboardExpense[]
  periodClosures: DashboardPeriodClosure[]
  clientReports: DashboardClientReport[]
  calendarEntries: DashboardCalendarEntry[]
}

export type DashboardStatsResult =
  | { ok: true; data: DashboardStatsResponse }
  | { ok: false; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
}

function isNullableNonNegativeInteger(
  value: unknown
): value is number | null {
  return value === null || isNonNegativeInteger(value)
}

function isDate(value: unknown): value is string {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

function isMonth(value: unknown): value is string {
  if (!isString(value) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false
  return !Number.isNaN(new Date(`${value}-01T00:00:00.000Z`).getTime())
}

function isIsoDateTime(value: unknown): value is string {
  return (
    isString(value) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) &&
    Number.isFinite(Date.parse(value))
  )
}

function isRole(value: unknown): value is DashboardEmployee["role"] {
  return value === "OWNER" || value === "ADMIN" || value === "COLAB"
}

function isCalendarEntryType(value: unknown): value is CalendarEntryType {
  return value === "FERIAS" || value === "FALTA" || value === "EVENTO"
}

function isApprovalType(value: unknown): value is DashboardApprovalType {
  return value === "HOURS" || value === "EXPENSE"
}

function isApprovalStatus(
  value: unknown
): value is DashboardApprovalStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED"
}

function isExpenseStatus(value: unknown): value is DashboardExpenseStatus {
  return (
    isApprovalStatus(value) ||
    value === "PAID" ||
    value === "DRAFT"
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isTimeEntry(value: unknown): value is DashboardTimeEntry {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.employeeId) &&
    isString(value.employeeName) &&
    isString(value.clientId) &&
    isString(value.clientName) &&
    isString(value.projectId) &&
    isString(value.projectName) &&
    isNullableString(value.activityName) &&
    isDate(value.date) &&
    isNonNegativeInteger(value.durationMinutes) &&
    typeof value.billable === "boolean" &&
    (value.approvalStatus === null || isApprovalStatus(value.approvalStatus))
  )
}

function isProject(value: unknown): value is DashboardProject {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.clientId) &&
    isString(value.clientName) &&
    isString(value.status) &&
    isNullableDate(value.deadline) &&
    isNullableNonNegativeInteger(value.budgetMinutes) &&
    isNonNegativeInteger(value.actualMinutes) &&
    isStringArray(value.memberIds)
  )
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDate(value)
}

function isEmployee(value: unknown): value is DashboardEmployee {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.name) &&
    isRole(value.role) &&
    isNullableNonNegativeInteger(value.weeklyCapacityMinutes)
  )
}

function isPendingApproval(value: unknown): value is DashboardApproval {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isApprovalType(value.type) &&
    isString(value.employeeId) &&
    isString(value.employeeName) &&
    isIsoDateTime(value.submittedAt) &&
    isString(value.summary) &&
    isNullableNonNegativeInteger(value.durationMinutes) &&
    isNullableNonNegativeInteger(value.amountCents)
  )
}

function isExpense(value: unknown): value is DashboardExpense {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.employeeId) &&
    isString(value.employeeName) &&
    isString(value.name) &&
    isNullableString(value.description) &&
    isNullableString(value.clientId) &&
    isNullableString(value.clientName) &&
    isDate(value.date) &&
    isNonNegativeInteger(value.amountCents) &&
    isExpenseStatus(value.status)
  )
}

function isPeriodClosure(value: unknown): value is DashboardPeriodClosure {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isDate(value.startsOn) &&
    isDate(value.endsOn) &&
    (value.status === "OPEN" || value.status === "CLOSED") &&
    isNullableString(value.closedAt) &&
    (value.closedAt === null || isIsoDateTime(value.closedAt))
  )
}

function isClientReport(value: unknown): value is DashboardClientReport {
  if (!isRecord(value)) return false
  return (
    isString(value.clientId) &&
    isString(value.clientName) &&
    isMonth(value.period) &&
    typeof value.templateConfigured === "boolean"
  )
}

function isCalendarEntry(value: unknown): value is DashboardCalendarEntry {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isCalendarEntryType(value.type) &&
    isString(value.title) &&
    isDate(value.startsOn) &&
    isDate(value.endsOn) &&
    isNullableString(value.employeeId)
  )
}

export function parseDashboardStats(
  value: unknown
): DashboardStatsResult {
  if (!isRecord(value)) {
    return { ok: false, message: "A API retornou um dashboard inválido." }
  }

  if (
    value.contractVersion !== 1 ||
    !isIsoDateTime(value.generatedAt) ||
    !isString(value.workspaceId) ||
    !Array.isArray(value.timeEntries) ||
    !value.timeEntries.every(isTimeEntry) ||
    !Array.isArray(value.projects) ||
    !value.projects.every(isProject) ||
    !Array.isArray(value.employees) ||
    !value.employees.every(isEmployee) ||
    !Array.isArray(value.pendingApprovals) ||
    !value.pendingApprovals.every(isPendingApproval) ||
    !Array.isArray(value.expenses) ||
    !value.expenses.every(isExpense) ||
    !Array.isArray(value.periodClosures) ||
    !value.periodClosures.every(isPeriodClosure) ||
    !Array.isArray(value.clientReports) ||
    !value.clientReports.every(isClientReport) ||
    !Array.isArray(value.calendarEntries) ||
    !value.calendarEntries.every(isCalendarEntry)
  ) {
    return {
      ok: false,
      message:
        "A resposta do dashboard não segue o contrato esperado. Verifique a versão da API.",
    }
  }

  return {
    ok: true,
    data: {
      contractVersion: 1,
      generatedAt: value.generatedAt,
      workspaceId: value.workspaceId,
      timeEntries: value.timeEntries,
      projects: value.projects,
      employees: value.employees,
      pendingApprovals: value.pendingApprovals,
      expenses: value.expenses,
      periodClosures: value.periodClosures,
      clientReports: value.clientReports,
      calendarEntries: value.calendarEntries,
    },
  }
}

export async function getDashboardStats(): Promise<DashboardStatsResult> {
  const response = await apiFetch("/dashboard/stats")
  if (response.error) {
    return {
      ok: false,
      message: response.message || "Não foi possível carregar o dashboard.",
    }
  }

  return parseDashboardStats(response.data)
}
