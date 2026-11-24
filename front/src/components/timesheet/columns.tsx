import type { ColumnDef } from "@tanstack/react-table"
import type { DataTableFeatures } from "../data-table"
import { Trash, Share2, RefreshCw, Pencil } from "lucide-react"

import { IconButton } from "../ui/icon-button-tooltip"

export const columns = (
  mostrarColunaUsuario: boolean = false,
  onEditClick?: (lancamentoId: {id: string, reuseOrEdit: "edit" | "reuse"}) => void,
  onReuseClick?: (lancamentoId: {id: string, reuseOrEdit: "edit" | "reuse"}) => void,
  onDeleteClick?: (lancamentoId: string) => void
): ColumnDef<DataTableFeatures, any>[] => {
  const cols: ColumnDef<DataTableFeatures, any>[] = [
    {
      accessorKey: "dataLancamento",
      header: "Data",
      cell: ({ row }) => {
        const data = new Date(row.original?.dataLancamento)
        return (
          <div className="flex w-full items-center justify-between gap-2">
            <span>{data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
            {row.original.compartilhado && <Share2 className="h-4 w-4" />}
          </div>
        )
      },
    },
    {
      accessorKey: "periodo",
      header: "Período",
      cell: ({ row }) => {
        const inicio = row.original.horaInicio
        const fim = row.original.horaFim

        const format = (v: string) => {
          if (!v) return "--:--"
          const d = new Date(v)
          return `${d.getUTCHours().toString().padStart(2, "0")}:${d
            .getUTCMinutes()
            .toString()
            .padStart(2, "0")}`
        }

        return (
          <div className="max-w-xl font-mono text-sm">
            {format(inicio)} - {format(fim)}
          </div>
        )
      },
    },
    ...(mostrarColunaUsuario
      ? [
          {
            accessorKey: "nomeUsuario",
            header: "Usuário",
            cell: ({ row }: any) => (
              <span className="font-medium">{row.original?.nomeUsuario}</span>
            ),
          },
        ]
      : []),
    {
      accessorKey: "nomeProjeto",
      header: "Projeto",
      cell: ({ row }) => (
        <div className="truncate sm:max-w-37 md:max-w-37">
          <div className="flex items-center gap-2 truncate">
            <div className="flex max-w-44 truncate">
              {row.original?.nomeProjeto || "Undefined"}
            </div>
            {row.original.compartilhado && <Share2 className="size-3" />}
          </div>
          <span className="text-xs text-muted-foreground">
            Parceiro: {row.original.nomeFantasia || row.original.razaoSocial}
          </span>
        </div>
      ),
    },

    {
      accessorKey: "nomeAtividade",
      header: "Atividade",
      cell: ({ row }) => (
        <div className="truncate sm:max-w-37 md:max-w-37">
          {row.original?.nomeAtividade || "Undefined"}
        </div>
      ),
    },
    {
      accessorKey: "razaoSocial",
      header: "Duração",
      cell: ({ row }) => {
        const inicio = new Date(row.original.horaInicio)
        const final = new Date(row.original.horaFim)
        const diff = final.getTime() - inicio.getTime()
        if (diff <= 0) return "0h"

        const hora = Math.floor(diff / 36e5)
        const minuto = Math.round((diff % 36e5) / 6e4)

        return (
          <div className="text-sm">
            {`${hora}h${minuto > 0 ? ` ${minuto}min` : ""}`}
          </div>
        )
      },
    },
    {
      id: "edit",
      cell: ({ row }) => {
        // if (ChecarUsuario(row.original?.nomeUsuario)) {
          return (
            <IconButton
            variant="ghost"
            icon={<Pencil className="size-4" />}
            label="Editar"
            onClick={() => onEditClick?.({id: row.original.lancamentoId, reuseOrEdit: "edit"})}
          />
          )
        // } 
      }
    },
    {
      id: "reuse",
      cell: ({ row }) => {
        // if (ChecarUsuario(row.original?.nomeUsuario)) {
          return (
            <IconButton
              variant="ghost"
              icon={<RefreshCw className="size-4" />}
              label="Reutilizar"
              onClick={() => onReuseClick?.({id: row.original.lancamentoId, reuseOrEdit: "reuse"})}
            />
          )
        // }
      }
    },
    {
      id: "excluir",
      cell: ({ row }) => {
        // if (ChecarUsuario(row.original?.nomeUsuario)) {
          return (
            <IconButton
              variant="destructive"
              icon={<Trash className="size-4" />}
              label="Excluir"
              onClick={() => onDeleteClick?.(row.original.lancamentoId)}
            />
          )
        // }       
      }
    }
  ]

  return cols
}

