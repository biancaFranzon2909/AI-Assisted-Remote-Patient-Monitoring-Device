import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/ui/icon-button-tooltip"
import {
  BriefcaseBusiness,
  Check,
  LoaderCircle,
  Plus,
  SendHorizontal,
} from "lucide-react"
import { useWorkspace } from "@/contexts/workspace-context"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "./ui/button"
import { apiFetch } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const criarFormSchema = z.object({
  nomeEmpresa: z
    .string()
    .trim()
    .min(1, "Informe o nome da empresa."),
  identificador: z.string().trim(),
})

type CriarFormValues = z.infer<typeof criarFormSchema>

type PendingWorkspaceSelection =
  | { status: "none" }
  | { status: "created-without-id" }
  | { status: "select"; workspaceId: string }

export function WorkSpaceMenu() {
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace()
  const { refetchUser } = useAuth()
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [pendingSelection, setPendingSelection] =
    useState<PendingWorkspaceSelection>({ status: "none" })

  const criarForm = useForm<CriarFormValues>({
    resolver: zodResolver(criarFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      nomeEmpresa: "",
      identificador: "",
    },
  })
  const isSubmitting = criarForm.formState.isSubmitting
  const isCreatedWithoutId = pendingSelection.status === "created-without-id"
  const isSelectionPending = pendingSelection.status !== "none"

  const handleAddWorkspace = async (values: CriarFormValues) => {
    setSubmitError("")
    try {
      if (pendingSelection.status === "created-without-id") {
        setSubmitError(
          "A empresa foi criada, mas a resposta não trouxe seu identificador. Atualize a página antes de tentar novamente.",
        )
        return
      }

      let newWorkspaceId: string
      if (pendingSelection.status === "select") {
        newWorkspaceId = pendingSelection.workspaceId
      } else {
        const createResponse = await apiFetch("/empresas/create", {
          method: "POST",
          body: JSON.stringify({
            nomeEmpresa: values.nomeEmpresa,
            identificador: values.identificador || undefined,
          }),
        })

        if (createResponse.error) {
          setSubmitError(
            createResponse.message || "Não foi possível criar a empresa.",
          )
          return
        }

        setPendingSelection({ status: "created-without-id" })
        const responseData: unknown = createResponse.data
        const receivedWorkspaceId =
          typeof responseData === "object" &&
          responseData !== null &&
          "identificador" in responseData &&
          typeof responseData.identificador === "string"
            ? responseData.identificador.trim()
            : ""

        if (!receivedWorkspaceId) {
          setSubmitError(
            "A empresa foi criada, mas a resposta não trouxe seu identificador. Atualize a página para carregar a nova empresa.",
          )
          return
        }
        newWorkspaceId = receivedWorkspaceId
        setPendingSelection({
          status: "select",
          workspaceId: newWorkspaceId,
        })
      }

      const refreshedUser = await refetchUser()
      if (!refreshedUser) {
        setSubmitError(
          "A empresa foi criada, mas não foi possível atualizar a lista de empresas. Tente novamente.",
        )
        return
      }

      const refreshedWorkspaces = (refreshedUser.empresas ?? []).map(
        (empresa) => ({
          id: empresa.identificador,
          name: empresa.nomeEmpresa,
          isAdmin: empresa.cargo === "ADMIN",
          isOwner: empresa.cargo === "OWNER",
        }),
      )

      if (!switchWorkspace(newWorkspaceId, refreshedWorkspaces)) {
        setSubmitError(
          "A empresa foi criada, mas não apareceu na lista atualizada. Tente novamente.",
        )
        return
      }

      criarForm.reset()
      setPendingSelection({ status: "none" })
      setAddWorkspaceOpen(false)
    } catch {
      setSubmitError(
        "Não foi possível concluir a criação da empresa. Verifique sua conexão e tente novamente.",
      )
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            className="ml-auto"
            variant="ghost"
            icon={<BriefcaseBusiness />}
            label="Alterar empresa"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-40 p-1.5"
          align="end"
          alignOffset={40}
          sideOffset={-30}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Empresas</DropdownMenuLabel>
            {workspaces.length > 0 ? (
              workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.id)}
                  className="flex items-center justify-between"
                >
                  {ws.name}
                  {currentWorkspace?.id === ws.id && <Check />}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem key="no-workspace" disabled>
                Nenhuma empresa disponível
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => setAddWorkspaceOpen(true)}
              className="flex items-center justify-between font-bold"
            >
              Criar Empresa
              <Plus />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={addWorkspaceOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setAddWorkspaceOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Empresa</DialogTitle>
            <DialogDescription>
              Digite o nome da nova empresa que deseja criar.
            </DialogDescription>
          </DialogHeader>
          <Form {...criarForm}>
            <form
              onSubmit={criarForm.handleSubmit(handleAddWorkspace)}
              className="space-y-4"
            >
              <FormField
                control={criarForm.control}
                name="nomeEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome da empresa"
                        autoComplete="organization"
                        disabled={isSubmitting || isSelectionPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={criarForm.control}
                name="identificador"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identificador (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Identificador"
                        disabled={isSubmitting || isSelectionPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {submitError && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {submitError}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting || isCreatedWithoutId}
                >
                  {isSubmitting ? (
                    <>
                      {pendingSelection.status === "select"
                        ? "Selecionando..."
                        : "Criando..."}
                      <LoaderCircle className="size-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      {pendingSelection.status === "select"
                        ? "Tentar selecionar empresa"
                        : isCreatedWithoutId
                          ? "Empresa criada"
                          : "Criar Empresa"}
                      <SendHorizontal className="size-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
