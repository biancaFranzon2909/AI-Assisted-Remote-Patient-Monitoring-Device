import { useState, useEffect } from "react"
import {
  SelectTrigger,
  SelectItem,
  SelectContent,
  Select,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { DataTable } from "@/components/data-table"
import { columns } from "../components/timesheet/columns"
import { Clock, Loader2, RefreshCw, Users, User, X } from "lucide-react"
import { apiFetch } from "@/lib/utils"
import { useSearchParams } from "react-router-dom"
import { useWorkspace } from "@/contexts/workspace-context"
import {
  LancamentoCard,
  type DataType,
  type lancamentoDataType,
} from "@/components/timesheet/lancamentoCard"
import { IconButton } from "@/components/ui/icon-button-tooltip"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ptBR } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

export function TimesheetPage() {
  const { currentWorkspace } = useWorkspace()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const isPermited = currentWorkspace?.isOwner || currentWorkspace?.isAdmin
  const cargoOwner = Boolean(
    currentWorkspace?.isOwner || currentWorkspace?.isAdmin
  )
  const [data, setData] = useState<any[]>([])
  const [lancamentoIdToEdit, setLancamentoIdToEdit] = useState<{id?: string, reuseOrEdit: "edit" | "reuse"} | null>(
    null
  )
  const [total, setTotal] = useState()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(false)

  // Filtros de data e projeto
  const [projectsFilter, setProjectsFilter] = useState<any[]>([])
  const [projetos, setProjetos] = useState<DataType[]>([])
  const [atividades, setAtividades] = useState<DataType[]>([])
  const [clientes, setClientes] = useState<DataType[]>([])

  const anoAtual = new Date().getFullYear().toString()
  const mesAtual = (new Date().getMonth() + 1).toString().padStart(2, "0")

  const filterProject = searchParams.get("projeto") || "all"
  const filtroAno = searchParams.get("ano") || anoAtual
  const filtroMes = searchParams.get("mes") || mesAtual
  const escopoFiltro = (searchParams.get("escopo") as "all" | "me") || "me"

  const dataInicioParam = searchParams.get("dataInicio")
  const dataFimParam = searchParams.get("dataFim")

  const [dateRange, setDateRange] = useState<any | undefined>(() => {
    if (dataInicioParam && dataFimParam) {
      return {
        from: new Date(`${dataInicioParam}T00:00:00`),
        to: new Date(`${dataFimParam}T00:00:00`),
      }
    }
    return undefined
  })

  useEffect(() => {
    if (dataInicioParam && dataFimParam) {
      setDateRange({
        from: new Date(`${dataInicioParam}T00:00:00`),
        to: new Date(`${dataFimParam}T00:00:00`),
      })
    } else {
      setDateRange(undefined)
    }
  }, [dataInicioParam, dataFimParam])

  const updateFiltros = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const atualizado = new URLSearchParams(prev)
        atualizado.set(key, value)
        return atualizado
      },
      { replace: true }
    )
  }

  const handleDeleteLancamento = async (lancamentoId: string) => {
    try {
      const resp = await apiFetch(`/lancamentos/delete/${lancamentoId}`, {method: "DELETE"})
      setReload((previous) => !previous)
      
      if(resp.error) {
        throw new Error(resp.message || "Erro ao deletar lançamento")
      }
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível deletar o lançamento."
      )
    }
  }

  const toggleEscopo = () => {
    updateFiltros("escopo", escopoFiltro === "all" ? "me" : "all")
  }

  const anos = [
    String(parseInt(anoAtual) + 2),
    String(parseInt(anoAtual) + 1),
    anoAtual,
    String(parseInt(anoAtual) - 1),
    String(parseInt(anoAtual) - 2),
  ]

  const meses = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ]

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setLoadError(null)
      const params = new URLSearchParams()

      if (currentWorkspace?.isAdmin || currentWorkspace?.isOwner) {
        params.append(
          "role",
          currentWorkspace?.isAdmin
            ? "ADMIN"
            : currentWorkspace?.isOwner
              ? "OWNER"
              : "COLAB"
        )
      }
      if (filterProject && filterProject !== "all") {
        params.append("projeto_id", filterProject)
      }
      if (filtroAno && filtroAno !== "all") {
        params.append("ano", filtroAno)
      }
      if (filtroMes && filtroMes !== "all") {
        params.append("mes", filtroMes)
      }

      if (dataInicioParam && dataFimParam) {
        params.append("dataInicio", dataInicioParam)
        params.append("dataFim", dataFimParam)
      }

      params.append("cargoOwner", cargoOwner ? "true" : "false")

      if (!isPermited || escopoFiltro === "me") {
        if (user?.id) {
          params.append("from", user?.id)
        }
      } else if (escopoFiltro === "all") {
        params.append("from", "all")
      }
      try {
        const response = await apiFetch(
          `/lancamentos/list/?${params.toString()}`
        )

        if (response.error) {
          throw new Error(response.message || "Erro na requisição")
        }

        setData(Array.isArray(response.data.data) ? response.data.data : [])
        setTotal(response.data.total)
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os lançamentos."
        )
      } finally {
        setLoading(false)
      }
    }

    const fetchProjects = async () => {
      try {
        const projetos = await apiFetch("/projetos/list")
        if (projetos.error) {
          throw new Error(projetos.message || "Erro ao carregar projetos")
        }
        setProjectsFilter(Array.isArray(projetos.data) ? projetos.data : [])
      } catch (err) {
        console.error(err)
      }
    }
    fetchProjects()
    fetchData()

    const LancamentoCardData = async () => {
      const response = await apiFetch("/lancamentos/new-info")
      if (!response.error) {
        setAtividades(response.data.atividades)
        setProjetos(response.data.projetos)
        setClientes(response.data.clientes)
      }
    }

    LancamentoCardData()
  }, [
    filterProject,
    filtroAno,
    filtroMes,
    user,
    isPermited,
    cargoOwner,
    escopoFiltro,
    reload,
    currentWorkspace,
    dataInicioParam,
    dataFimParam,
  ])

  const mostrarColunaUsuario = isPermited && escopoFiltro === "all"

  return (
    <>
      <PageHeader
        title="Lançamentos"
        subtitle="Acompanhe e registre as horas dos seus projetos."
        buttons={
          <div className="flex items-center gap-2 rounded-lg border bg-muted/95 p-2">
            <Clock
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs text-muted-foreground">Horas totais</p>
              <p className="font-semibold tabular-nums">
                {loading ? "Carregando..." : (total ?? "—")}
              </p>
            </div>
          </div>
        }
      />
      <main className="flex min-w-0 flex-col gap-4 pr-4 pb-4 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)] 2xl:gap-4">
        <section
          className="order-2 w-full min-w-0 xl:order-1"
          aria-labelledby="timesheet-list-title"
        >
          <Card className="min-w-0">
            <CardHeader className="flex justify-between gap-4 sm:items-center">
              <CardTitle id="timesheet-list-title" className="text-lg">
                Histórico de lançamentos
              </CardTitle>
            </CardHeader>

            <CardContent className="min-w-0" aria-busy={loading}>
              {loading ? (
                <div
                  className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2
                    className="size-8 animate-spin text-primary"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground">
                    Carregando lançamentos...
                  </p>
                </div>
              ) : loadError ? (
                <div
                  className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
                  role="alert"
                >
                  <p className="text-sm text-foreground">{loadError}</p>
                  <Button
                    variant="outline"
                    onClick={() => setReload((previous) => !previous)}
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="max-w-full pb-2">
                  <DataTable
                    columns={columns(
                      mostrarColunaUsuario,
                      setLancamentoIdToEdit,
                      setLancamentoIdToEdit,
                      handleDeleteLancamento,
                    )}
                    data={data}
                    filterColumn={[
                      "dataLancamento",
                      "razaoSocial",
                      "nomeFantasia",
                      "nomeProjeto",
                      "nomeAtividade",
                      "nomeUsuario",
                    ]}
                    clickable
                    filterPlaceholder="Filtrar lançamentos..."
                    extraFilters={
                      <div className="flex flex-wrap items-end gap-3">
                        {isPermited && (
                          <div className="flex flex-col gap-1">
                            {escopoFiltro === "all" ? (
                              <IconButton
                                icon={<Users className="size-4" />}
                                label="Todos os lançamentos"
                                onClick={toggleEscopo}
                              />
                            ) : (
                              <IconButton
                                icon={<User className="size-4" />}
                                label="Meus lançamentos"
                                onClick={toggleEscopo}
                              />
                            )}
                          </div>
                        )}
                        <div className="flex max-w-20 min-w-20 flex-1 flex-col gap-1">
                          <Label
                            htmlFor="timesheet-year"
                            className="px-1 text-xs text-muted-foreground"
                          >
                            Ano
                          </Label>
                          <Select
                            value={filtroAno}
                            onValueChange={(value) =>
                              updateFiltros("ano", value)
                            }
                          >
                            <SelectTrigger
                              id="timesheet-year"
                              className="w-full"
                            >
                              <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                            <SelectContent>
                              {anos.map((ano) => (
                                <SelectItem key={ano} value={ano}>
                                  {ano}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex max-w-28 min-w-28 flex-1 flex-col gap-1">
                          <Label
                            htmlFor="timesheet-month"
                            className="px-1 text-xs text-muted-foreground"
                          >
                            Mês
                          </Label>
                          <Select
                            value={filtroMes}
                            onValueChange={(value) =>
                              updateFiltros("mes", value)
                            }
                            disabled={filtroAno === "all"}
                          >
                            <SelectTrigger
                              id="timesheet-month"
                              className="w-full"
                            >
                              <SelectValue placeholder="Mês" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {meses.map((mes) => (
                                  <SelectItem key={mes.value} value={mes.value}>
                                    {mes.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="px-1 text-xs text-muted-foreground">
                            Período
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-30 justify-start truncate px-2.5 font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                  dateRange.to ? (
                                    <>
                                      {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                                      {format(dateRange.to, "dd/MM/yyyy")}
                                    </>
                                  ) : (
                                    format(dateRange.from, "dd/MM/yyyy")
                                  )
                                ) : (
                                  "Período"
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-full min-w-116 p-0"
                              align="start"
                            >
                              <Calendar
                                className="w-full"
                                mode="range"
                                numberOfMonths={1}
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                locale={ptBR}
                                onSelect={(range) => {
                                  setDateRange(range)
                                  setSearchParams(
                                    (prev) => {
                                      const atualizado = new URLSearchParams(
                                        prev
                                      )
                                      if (range?.from && range?.to) {
                                        atualizado.set(
                                          "dataInicio",
                                          format(range.from, "yyyy-MM-dd")
                                        )
                                        atualizado.set(
                                          "dataFim",
                                          format(range.to, "yyyy-MM-dd")
                                        )
                                      } else {
                                        atualizado.delete("dataInicio")
                                        atualizado.delete("dataFim")
                                      }
                                      return atualizado
                                    },
                                    { replace: true }
                                  )
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="flex max-w-40 min-w-40 flex-col gap-1">
                          <Label
                            htmlFor="timesheet-project"
                            className="px-1 text-xs text-muted-foreground"
                          >
                            Projeto
                          </Label>
                          <Select
                            value={filterProject}
                            onValueChange={(value) =>
                              updateFiltros("projeto", value)
                            }
                          >
                            <SelectTrigger
                              id="timesheet-project"
                              className="w-full"
                            >
                              <SelectValue placeholder="Projeto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Projetos</SelectLabel>
                                <SelectItem value="all">
                                  Todos os projetos
                                </SelectItem>
                                {projectsFilter.map((project: any) => (
                                  <SelectItem
                                    key={project.projetoId}
                                    value={String(project.projetoId)}
                                  >
                                    {project.nomeProjeto}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section
          className="order-1 w-full max-w-xl min-w-0 xl:sticky xl:top-4 xl:order-2 xl:max-w-none"
          aria-label="Novo lançamento"
        >
          <LancamentoCard
            projetosProp={{ data: projetos, showInfo: true }}
            atividadesProp={{ data: atividades, showInfo: true }}
            clientesProp={{ data: clientes, showInfo: true }}
            lancamentoId={lancamentoIdToEdit as lancamentoDataType}
            onSaved={() => {
              setLancamentoIdToEdit(null)
              setReload((previous) => !previous)
            }}
            onClear={() => {
              setLancamentoIdToEdit(null)
            }}
          />
        </section>
      </main>
    </>
  )
}
