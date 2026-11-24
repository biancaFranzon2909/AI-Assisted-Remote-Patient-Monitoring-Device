import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { apiFetch } from "@/lib/utils"
import { toast } from "sonner"
import { IconButton } from "./ui/icon-button-tooltip"

interface DeleteDialogProps {
  endpoint: string
  onSuccess?: () => void
}

export function DeleteDialogGeral({
  endpoint,
  onSuccess,
}: DeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDeleting(true)
    // setError(null);
    try {
      const response = await apiFetch(endpoint, {
        method: "DELETE",
      })

      if (!response.error) {
        toast.success(`Excluido com sucesso!`)
        setOpen(false)
        if (onSuccess) onSuccess()
      } else {
        const errorMsg = response.message || "Não foi possível excluir."
        toast.error(errorMsg)
      }
    } catch (e: any) {
      // console.error("Erro ao deletar:", e);
      toast.error("Erro de conexão com o servidor.")
      // setError(e.message);
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <IconButton
          variant="destructive"
          icon={<Trash2 className="size-4" />}
          label="Excluir"
        />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Essa ação é irreversível.</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Esta acao exclui os dados relacionados, por exemplo: Lancamentos, Projetos, Despesas e etc...
        </AlertDialogDescription>
        <AlertDialogFooter className="flex justify-between">
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            variant="destructive"
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="size-4 animate-spin" />}
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
