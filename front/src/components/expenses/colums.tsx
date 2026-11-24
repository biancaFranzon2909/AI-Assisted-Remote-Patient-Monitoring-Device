import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteDialogGeral } from "../delete-dialog-geral"
import { AddExpenseModal } from "./addExpenseModal"
import type { DataTableFeatures } from "../data-table"

export const colums = (onRefresh: () => void): ColumnDef<DataTableFeatures, any>[] => [
  
  {
    accessorKey: "nomeDespesa",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="cursor-pointer"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Nome
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => row.original.nomeDespesa,
  },
  {
    accessorKey: "dataDespesa",
    header: "Data de Despesa",
    cell: ({ row }) => {
      const data = new Date(row.original.dataDespesa).toLocaleString().split(",")[0]
      return data;
    },
  },
  {
    accessorKey: "cliente",
    header: "Cliente",
    cell: ({ row }) => {
      return row.original.nomeFantasia || row.original.razaoSocial || "Sem cliente";
    },
  },
  {
    accessorKey: "descricao",
    header: "Descrição",
    cell: ({ row }) => row.original.descricao ?? "Sem descrição",
  },
  {
    accessorKey: "valor",
    header: "Valor",
    cell: ({ row }) => {
      const valor = Number(row.original.valor)
      return isNaN(valor) ? "R$ 0.00" : `R$ ${valor.toFixed(2)}`
    },
  },
  {
    id: "reuse",
    header: "",
    cell: ({ row }) => (
      <AddExpenseModal
        reuse={{
          nome: row.original.nomeDespesa,
          valor: row.original.valor, 
          descricao: row.original.descricao
        }}
        // endpoint={`/despesas/delete/${row.original.despesaId}`}
        onRefresh ={onRefresh}
      />
    ),
  },
  {
    id: "delete",
    header: "",
    cell: ({ row }) => (
      <DeleteDialogGeral
        endpoint={`/despesas/delete/${row.original.despesaId}`}
        onSuccess={onRefresh}
        />
    ),
  },
]
