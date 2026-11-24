import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { IconButton } from "@/components/ui/icon-button-tooltip"
import { format } from "date-fns"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ptBR } from "date-fns/locale"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardAction,
  CardTitle,
} from "@/components/ui/card"
import { CalendarIcon, Save, Broom } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { SeletorSearchBar } from "../seletor-search-bar"

export type DataType = {
  id: string
  nome: string
  projetoId?: string
  clienteId?: string
  limiteAtingido: boolean
}

export type PropType = {
  data: DataType[]
  showInfo?: boolean
}
export interface LancamentoForm {
  lancamento_id?: string
  atividade_id?: string
  projeto_id?: string
  cliente_id?: string
  data_lancamento?: Date
  hora_inicio?: string
  hora_fim?: string
  descricao?: string
}

export type lancamentoDataType = { id: string; reuseOrEdit: "edit" | "reuse" }
interface LancamentoCardProps {
  lancamentoId?: lancamentoDataType
  projetosProp?: PropType
  atividadesProp?: PropType
  clientesProp?: PropType
  blocked?: boolean
  onSaved?: () => void
  onClear?: () => void
}

// Constante de módulo: o default dos props mantém a mesma referência entre
// renders, então os useMemo/useCallback abaixo não são invalidados à toa.
const EMPTY: PropType = { data: [], showInfo: false }

const emptyForm = () => ({
  atividade_id: "",
  projeto_id: "",
  cliente_id: "",
  data_lancamento: new Date(),
  hora_inicio: "",
  hora_fim: "",
  descricao: "",
})
type FormState = ReturnType<typeof emptyForm>

const HORARIOS = [
  ["hora_inicio", "Hora de Início"],
  ["hora_fim", "Hora de Término"],
] as const

export function LancamentoCard({
  lancamentoId,
  projetosProp = EMPTY,
  atividadesProp = EMPTY,
  clientesProp = EMPTY,
  blocked,
  onSaved,
  onClear,
}: LancamentoCardProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const projetos = projetosProp.data ?? EMPTY.data
  const todasAtividades = atividadesProp.data ?? EMPTY.data

  const projetosFiltrados = useMemo(
    () =>
      form.cliente_id
        ? projetos.filter((p) => p.clienteId === form.cliente_id)
        : projetos,
    [form.cliente_id, projetos]
  )

  const atividades = useMemo(
    () =>
      form.projeto_id
        ? todasAtividades.filter((a) => a.projetoId === form.projeto_id)
        : todasAtividades,
    [form.projeto_id, todasAtividades]
  )

  const dataFormatada = useMemo(
    () => format(form.data_lancamento, "PPP", { locale: ptBR }),
    [form.data_lancamento]
  )

  const [lancamentoData, setLancamentoData] = useState<any>()
  useEffect(() => {
    if (lancamentoId?.id) {
      apiFetch(`/lancamentos/list/${lancamentoId?.id}`).then(
        ({ data, error, message }) => {
          if (!error) return setLancamentoData(data)
          toast.error(message)
        }
      )
    }
  }, [lancamentoId])

  useEffect(() => {
    if (!lancamentoId?.id) return

    if (lancamentoData) {
      if (lancamentoId?.reuseOrEdit === "reuse") {
        setForm((prev) => ({
          data_lancamento: new Date(),
          hora_inicio: "",
          hora_fim: "",
          atividade_id: lancamentoData?.atividadeId,
          projeto_id: lancamentoData?.projetoId,
          cliente_id: lancamentoData?.clienteId,
          descricao: String(lancamentoData?.descricao),
        }))
        return
      }

      setForm({
        atividade_id: lancamentoData.atividadeId,
        projeto_id: lancamentoData.projetoId,
        cliente_id: lancamentoData.clienteId,
        data_lancamento: new Date(lancamentoData.dataLancamento),
        hora_inicio: lancamentoData.horaInicio?.slice(11, 16),
        hora_fim: lancamentoData.horaFim?.slice(11, 16),
        descricao: String(lancamentoData.descricao),
      })
    }
  }, [lancamentoData, lancamentoId?.id, lancamentoId?.reuseOrEdit])

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleClienteChange = useCallback(
    (id: string) =>
      setForm((prev) => ({
        ...prev,
        cliente_id: id,
        projeto_id: "",
        atividade_id: "",
      })),
    []
  )

  const handleProjetoChange = useCallback(
    (id: string) => {
      const clienteId = projetos.find((p) => p.id === id)?.clienteId
      setForm((prev) => ({
        ...prev,
        projeto_id: id,
        atividade_id: "",
        cliente_id: clienteId || prev.cliente_id,
      }))
    },
    [projetos]
  )

  const handleAtividadeChange = useCallback(
    (id: string) => {
      const projetoId = todasAtividades.find((a) => a.id === id)?.projetoId
      const projeto = projetos.find((p) => p.id === projetoId)
      setForm((prev) => ({
        ...prev,
        atividade_id: id,
        projeto_id: projeto?.id || prev.projeto_id,
        cliente_id: projeto?.clienteId || prev.cliente_id,
      }))
    },
    [projetos, todasAtividades]
  )

  const handleSubmit = async () => {
    const { projeto_id, atividade_id, hora_inicio, hora_fim, descricao } = form

    if (!(projeto_id && atividade_id && hora_inicio && hora_fim && descricao)) {
      return toast.warning("Preencha os campos obrigatórios")
    }
    if (hora_inicio >= hora_fim) return toast.error("Hora inválida")

    setIsLoading(true)
    const isEdit = lancamentoId?.reuseOrEdit === "edit" && lancamentoId.id
    const response = await apiFetch(
      isEdit ? `/lancamentos/edit/${lancamentoId.id}` : "/lancamentos/create",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(form) }
    ).finally(() => setIsLoading(false))

    if (response.error) {
      return toast.error(response.message || "Erro ao lançar atividade")
    }

    const excedidos = [
      atividades.find((a) => a.id === atividade_id)?.limiteAtingido &&
        "Atividade",
      projetosFiltrados.find((p) => p.id === projeto_id)?.limiteAtingido &&
        "Projeto",
    ]
      .filter(Boolean)
      .join(" e ")

    if (excedidos) {
      toast.warning(
        `${excedidos} com prazo ou horas excedidas! Lançamento criado`
      )
    } else {
      toast.success(
        lancamentoId ? "Lançamento Atualizado" : "Lançamento Concluído"
      )
    }

    if (isEdit) setForm((prev) => ({ ...prev, hora_inicio: "", hora_fim: "" }))
    onSaved?.()
  }

  const limparFiltros = () => {
    setForm(emptyForm())
    onClear?.()
  }

  return (
    <Card className={blocked ? "text-muted-foreground" : ""}>
      {blocked && (
        <div className="absolute inset-0 z-10 rounded-md bg-muted/40 backdrop-blur-[0.5px]"></div>
      )}
      <CardHeader>
        <CardTitle>
          {lancamentoId?.reuseOrEdit === "edit"
            ? "Editando lançamento"
            : "Novo lançamento"}
        </CardTitle>

        <CardAction className="flex gap-1">
          <IconButton
            variant="destructive"
            icon={<Broom className="size-4.5" />}
            onClick={limparFiltros}
            label="Limpar Filtros"
          />
          <IconButton
            variant="default"
            icon={<Save className="size-4.5" />}
            onClick={handleSubmit}
            disabled={isLoading}
            label="Salvar"
          />
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full">
                  {dataFormatada}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2" align="start">
                <Calendar
                  required
                  fixedWeeks
                  mode="single"
                  selected={form.data_lancamento}
                  locale={ptBR}
                  onSelect={(date) => {
                    updateField("data_lancamento", date)
                    setIsCalendarOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-between gap-2">
            {HORARIOS.map(([campo, label]) => (
              <div key={campo} className="flex-1 space-y-2">
                <Label htmlFor={campo}>{label}</Label>
                <Input
                  id={campo}
                  type="time"
                  value={form[campo]}
                  onChange={(e) => updateField(campo, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {clientesProp.showInfo && (
              <SeletorSearchBar
                label="Parceiro"
                items={clientesProp.data}
                value={form.cliente_id}
                onValueChange={handleClienteChange}
                placeholder="Selecione um parceiro"
                searchPlaceholder="Buscar parceiro..."
                emptyMessage="Nenhum parceiro encontrado"
              />
            )}
            {projetosProp.showInfo && (
              <SeletorSearchBar
                label="Projeto"
                items={projetosFiltrados}
                value={form.projeto_id}
                onValueChange={handleProjetoChange}
                placeholder="Selecione um projeto"
                searchPlaceholder="Buscar Projeto..."
                emptyMessage="Nenhum Projeto encontrado"
              />
            )}
          </div>

          <div className="space-y-2">
            {atividadesProp.showInfo && (
              <SeletorSearchBar
                label="Atividade"
                items={atividades}
                value={form.atividade_id}
                onValueChange={handleAtividadeChange}
                placeholder="Selecione uma atividade"
                searchPlaceholder="Buscar Atividade..."
                emptyMessage={
                  form.projeto_id
                    ? "Nenhuma atividade para este projeto."
                    : "Selecione um projeto primeiro."
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Descrição"
              value={form.descricao}
              onChange={(e) => updateField("descricao", e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
