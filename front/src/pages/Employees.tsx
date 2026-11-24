"use client"
import { useEffect, useMemo, useState } from "react"
// import SideBar from "@/components/componentes/SideBar";
import { PageHeader } from "@/components/page-header"
import { DataTable } from "@/components/data-table"
import { columns } from "@/components/employees/columns"
import { apiFetch } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useWorkspace } from "@/contexts/workspace-context"
import { InviteEmployeeModal } from "@/components/employees/inviteEmployee"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function EmployeePage() {
  const navigate = useNavigate()
  const { currentWorkspace } = useWorkspace()
  const { isAdmin, isOwner } = currentWorkspace ?? {
    isAdmin: false,
    isOwner: false,
  }

  const [statusFilter, setStatusFilter] = useState("all")
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await apiFetch("/usuarios/list/")
        if (response.error)
          throw new Error(response.message || "Erro ao buscar dados")

        const result = Array.isArray(response.data) ? response.data : []
        setData(result)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [refresh, currentWorkspace])

  const filteredData = useMemo(() => {
    if (statusFilter === "all") return data
    const isActive = statusFilter === "true"
    return data.filter((item) => item.isActive === isActive)
  }, [statusFilter, data])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Colaboradores"
        subtitle="Visualize os membros da sua equipe."
        buttons={
          <>
            {isOwner && isAdmin && (
              <InviteEmployeeModal onSuccess={() => setRefresh(!refresh)} />
            )}
          </>
        }
      />

      <main className="min-h-0 w-full pr-4">
        <DataTable
          columns={columns}
          data={filteredData}
          clickable
          filterPlaceholder="Pesquisar por nome, email ou cargo"
          onRowClick={(row: any) => navigate(`/employees/${row.usuarioId}`)} //rota pra detalhes colaborador
          filterColumn={["nomeCompleto", "nomeUsuario", "email"]}
          extraFilters={
            <>
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="all">Ativos e Inativos</SelectItem>
                    <SelectItem value="true">Ativos</SelectItem>
                    <SelectItem value="false">Inativos</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </>
          }
        />
      </main>
    </>
  )
}
