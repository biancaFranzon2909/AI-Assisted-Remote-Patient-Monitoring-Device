export interface DashboardStats {
  contractVersion: 1;
  generatedAt: string;
  workspaceId: string;
  timeEntries: DashboardTimeEntry[];
  projects: DashboardProject[];
  employees: DashboardEmployee[];
  pendingApprovals: DashboardApproval[];
  expenses: DashboardExpense[];
  periodClosures: DashboardPeriodClosure[];
  clientReports: DashboardClientReport[];
  calendarEntries: DashboardCalendarEntry[];
}

export interface DashboardTimeEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  activityName: string | null;
  date: string;
  durationMinutes: number;
  billable: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
}

export interface DashboardProject {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  deadline: string | null;
  budgetMinutes: number | null;
  actualMinutes: number;
  memberIds: string[];
}

export interface DashboardEmployee {
  id: string;
  name: string;
  role: "OWNER" | "ADMIN" | "COLAB";
  weeklyCapacityMinutes: number | null;
}

export interface DashboardApproval {
  id: string;
  type: "HOURS" | "EXPENSE";
  employeeId: string;
  employeeName: string;
  submittedAt: string;
  summary: string;
  durationMinutes: number | null;
  amountCents: number | null;
}

export interface DashboardExpense {
  id: string;
  employeeId: string;
  employeeName: string;
  name: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  date: string;
  amountCents: number;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID";
}

export interface DashboardPeriodClosure {
  id: string;
  startsOn: string;
  endsOn: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
}

export interface DashboardClientReport {
  clientId: string;
  clientName: string;
  period: string;
  templateConfigured: boolean;
}

export interface DashboardCalendarEntry {
  id: string;
  type: "FERIAS" | "FALTA" | "EVENTO";
  title: string;
  startsOn: string;
  endsOn: string;
  employeeId: string | null;
}
