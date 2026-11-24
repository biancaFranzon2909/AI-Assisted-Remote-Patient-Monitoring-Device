import type { ColumnDef } from "@tanstack/react-table"
import type { DataTableFeatures } from "../data-table"
import { ArrowUpDown, ChevronRight, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const formatarHorasDecimais = (
  totalDecimal: number | null | undefined
): string => {
  const valor = totalDecimal || 0
  const horas = Math.floor(valor)
  const minutos = Math.round((valor - horas) * 60)

  const horasPad = String(horas).padStart(2, "0")
  const minutosPad = String(minutos).padStart(2, "0")

  return `${horasPad}:${minutosPad}`
}

const AtividadePrioridade = {
  BAIXA: { label: "Baixa", color: "bg-slate-500 hover:bg-slate-600" },
  NORMAL: { label: "Normal", color: "bg-blue-500 hover:bg-blue-600" },
  ALTA: { label: "Alta", color: "bg-orange-500 hover:bg-orange-600" },
  CRITICA: { label: "Crítica", color: "bg-red-600 hover:bg-red-700" },
}

// --- Definição das Colunas ---
export const columns = (): ColumnDef<DataTableFeatures, any>[] => [
  // Nome da Atividade
  {
    accessorKey: "nomeAtividade",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-auto px-0 py-0"
      >
        Atividade
        <ArrowUpDown className="size-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const nome = row.original.nomeAtividade
      return (
        <>
          <div className="flex items-center gap-2 truncate">
            <div className="flex max-w-44 truncate">{nome}</div>
            {row.original.compartilhado && <Share2 className="size-3" />}
          </div>
          <span className="text-xs text-muted-foreground">
            Parceiro: {row.original.nomeFantasia || row.original.razaoSocial}
          </span>
        </>
      )
    },
  },
  // Projeto Vinculado
  {
    accessorKey: "nomeProjeto",
    enableGlobalFilter: true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-auto px-0 py-0"
      >
        Projeto
        <ArrowUpDown className="size-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const nome = row.original.nomeProjeto
      return (
        <div className="group hover: flex items-center gap-2 truncate">
          <div aria-placeholder={nome} className="max-w-32 truncate">
            {nome}
          </div>
          {row.original.compartilhado && <Share2 className="size-4" />}
        </div>
        // return
      )
    },
  },
  //ref externo
  {
    accessorKey: "refCliente",
    header: "Ref. Externa",
    cell: ({ row }) => {
      return (
        <span>
          {row.original.refCliente && row.original.refCliente.length > 0
            ? row.original.refCliente
            : "-"}
        </span>
      )
    },
  },
  // Prazo
  {
    accessorKey: "dataPrevisao",
    header: "Prazo",
    cell: ({ row }) => {
      let data_inicio_ = row.original.previsaoInicio as string
      let data_fim_ = row.original.previsaoFim as string
      data_inicio_ = new Date(data_inicio_).toLocaleDateString("pt-BR")
      data_fim_ = new Date(data_fim_).toLocaleDateString("pt-BR")

      return (
        <span>
          {data_inicio_} - {data_fim_}
        </span>
      )
    },
  },

  //horas
  {
    accessorKey: "nomeFantasia",
    header: "Horas Previstas",
    cell: ({ row }) => {
      const previsto = row.original.horasPrevistas || 0
      return <div className="text-center">{previsto}h</div>
    },
  },
  {
    accessorKey: "horas_gastas",
    header: "Horas Gastas",
    cell: ({ row }) => {
      const horasGastas = (row.original.horasGastas as number) || 0
      const horasPrevistas = row.original.horasPrevistas || 0
      const ultrapassou = horasGastas > horasPrevistas && horasPrevistas > 0
      return (
        <div
          className={`font-medium ${ultrapassou ? "font-bold text-red-600" : "text-blue-800"}`}
        >
          {formatarHorasDecimais(horasGastas)}h
        </div>
      )
    },
  },
  {
    accessorKey: "centroCusto",
    header: "Centro de custo",
    cell: ({ row }) => {
      return <span>{row.original.centroCusto || "-"}</span>
    },
  },
  {
    accessorKey: "solicitante",
    header: "Solicitante",
    cell: ({ row }) => {
      return <span>{row.original.solicitante ?? "-"}</span>
    },
  },
  {
    accessorKey: "prioridade",
    header: "Prioridade",
    cell: ({ row }) => {
      const prioridade = row.original
        .prioridade as keyof typeof AtividadePrioridade
      return (
        <Badge
          className={`${AtividadePrioridade[prioridade].color} w-fit items-center gap-1 border-none text-white shadow-sm`}
        >
          <span className="capitalize">
            {AtividadePrioridade[prioridade].label}
          </span>
        </Badge>
      )
    },
  },
  {
    accessorKey: "isActive",
    header: "Ativo",
    cell: ({ row }) => {
      const status = row.original?.isActive
      return (
        <Badge
          className={
            status
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 text-white hover:bg-red-700"
          }
        >
          {status ? "Ativo" : "Inativo"}
        </Badge>
      )
    },
  },

  {
    accessorKey: "actions",
    header: "",
    cell: ({ row }) => {
      return (
        <Button variant={"ghost"}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      )
    },
  },
]
