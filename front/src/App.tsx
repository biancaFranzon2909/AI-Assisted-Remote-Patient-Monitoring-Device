import { Layout } from "./layout"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./contexts/auth-context"
import { WorkspaceProvider } from "./contexts/workspace-context"
import { ThemeProvider } from "./components/theme-provider.tsx"

import { Login } from "./pages/Login.tsx"
// Paginas principais
import { DashboardPage } from "./pages/Dashboard.tsx"
import { ClientsPage } from "./pages/Clients.tsx"
import { ProjectsPage } from "./pages/Projects.tsx"
import { TimesheetPage } from "./pages/Timesheet.tsx"
import { EmployeePage } from "./pages/Employees.tsx"
import { ActivitiesPage } from "./pages/Activities.tsx"
import { ExpensesPage } from "./pages/Expenses.tsx"
import { ReportsPage } from "./pages/Reports.tsx"
import { AdministrativePage } from "./pages/Administrativo.tsx"
import { PasswordReset } from "./pages/PasswordReset.tsx"
import { UserProfilePage } from "./components/profile/UserProfilePage.tsx"

// Detalhes
import { EmployeeDetail } from "./components/employees/employeeDetail.tsx"
import { ProjectDetail } from "./components/projects/projectDetail.tsx"
import { ActivityDetail } from "./components/activities/activityDetail.tsx"
import { ClientDetail } from "./components/clients/clientDetail.tsx"
import { TimesheetDetail } from "./components/timesheet/timesheetDetail.tsx"

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <WorkspaceProvider>
            <Routes>
              <Route path="/password_reset" element={<PasswordReset />} />
              <Route path="/login" element={<Login />} />
              {/* <Route path="/companies" element={<TenantPage />} /> */}

              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/timesheet" element={<TimesheetPage />} />
                <Route path="/timesheet/:id" element={<TimesheetDetail />} />
                <Route path="/employees" element={<EmployeePage />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/activities/:id" element={<ActivityDetail />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route
                  path="/administrativo"
                  element={<AdministrativePage />}
                />
                <Route path="/profile" element={<UserProfilePage />} />
              </Route>
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
