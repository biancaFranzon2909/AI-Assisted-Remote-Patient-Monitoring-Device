import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Info, Loader2, Plus, Settings, Users } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { type DateRange } from "react-day-picker"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Calendar,
} from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch } from "@/lib/utils"
import {
  checkVariantBack,
  getDefaultDateRange,
  navigateTab,
  ProjectFormSchema,
  statusProjeto,
  tipoProjeto,
  type TypeProjectFormData,
} from "./addProjectUtils"

type Colaborador = {
  value: string
  label: string
}

type ClientOption = {
  clienteId: string
  nomeFantasia: string
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  "aria-invalid": ariaInvalid,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  "aria-invalid"?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = "auto"
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder || ""}
      aria-invalid={ariaInvalid}
      className="w-full rounded-md border border-input p-2 text-sm"
      style={{ overflow: "hidden", resize: "none" }}
    />
  )
}

function defaultValues(initialClientId = ""): TypeProjectFormData {
  const range = getDefaultDateRange()

  return {
    nome_projeto: "",
    cliente_id: initialClientId,
    ref_cliente: "",
    descricao: "",
    data_inicio: range.from ? range.from.toISOString() : "",
    data_fim: range.to ? range.to.toISOString() : "",
    horas_previstas: "Em Aberto",
    status: "EmAndamento",
    centro_custo: "",
    solicitante: "",
    tipo: "SCC",
    equipe: [],
  }
}

interface AddProjectDialogProps {
  onSuccess: () => void
  initialClientId?: string
}

export function AddProjectModal({
  onSuccess,
  initialClientId,
}: AddProjectDialogProps) {
  const anchor = useComboboxAnchor()

  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [tabValue, setTabValue] = useState("essencial")
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [clientes, setClientes] = useState<ClientOption[]>([])
  const [selectedColaboradores, setSelectedColaboradores] = useState<
    Colaborador[]
  >([])
  const [, setDate] = useState<DateRange | undefined>(getDefaultDateRange())

  const formProjects = useForm<TypeProjectFormData>({
    resolver: zodResolver(ProjectFormSchema),
    defaultValues: defaultValues(initialClientId),
  })

  const resetFormState = useCallback(() => {
    const range = getDefaultDateRange()
    formProjects.reset(defaultValues(initialClientId))
    setSelectedColaboradores([])
    setDate(range)
    setTabValue("essencial")
  }, [formProjects, initialClientId])

  const closeAndReset = useCallback(() => {
    setOpen(false)
    resetFormState()
  }, [resetFormState])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      closeAndReset()
      return
    }

    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    async function getFiltersData() {
      try {
        const [clientesResponse, colabsResponse] = await Promise.all([
          apiFetch("/clientes/list"),
          apiFetch("/usuarios/list"),
        ])

        if (!clientesResponse.error) {
          setClientes((clientesResponse.data || []) as ClientOption[])
        }

        if (colabsResponse.error) {
          toast.error("Falha ao carregar dados do formulário")
          return
        }

        setColaboradores(
          ((colabsResponse.data || []) as Array<{ usuarioId: string; nomeCompleto: string }>).map(
            (colab) => ({
              label: colab.nomeCompleto,
              value: colab.usuarioId,
            })
          )
        )
      } catch {
        toast.error("Erro ao conectar com o servidor.")
      }
    }

    void getFiltersData()
  }, [open])

  async function onSubmit(values: TypeProjectFormData) {
    setIsLoading(true)

    try {
      const body = {
        ...values,
        equipe: selectedColaboradores.map((item) => item.value),
        horas_previstas:
          values.horas_previstas === "Em Aberto"
            ? "Em Aberto"
            : Number(values.horas_previstas),
      }

      const response = await apiFetch("/projetos/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (response.error) {
        toast.error(response.message || "Falha ao salvar projeto")
        return
      }

      toast.success(response.message || "Projeto criado com sucesso!")
      closeAndReset()
      onSuccess()
    } catch {
      toast.error("Erro ao conectar com o servidor.")
    } finally {
      setIsLoading(false)
    }
  }

  const tabs = [
    { icon: Info, label: "essencial" },
    { icon: Users, label: "equipe" },
    { icon: Settings, label: "configs" },
  ] as const

  function handleForward(): void {
    if (tabValue === tabs[tabs.length - 1].label) {
      formProjects.handleSubmit(onSubmit)()
      return
    }

    navigateTab(
      tabs.map((tab) => ({ label: tab.label })),
      tabValue,
      1,
      setTabValue
    )
  }

  function handleBack(): void {
    if (tabValue === tabs[0].label) {
      closeAndReset()
      return
    }

    navigateTab(
      tabs.map((tab) => ({ label: tab.label })),
      tabValue,
      -1,
      setTabValue
    )
  }

  return (
    <Dialog modal={false} open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Adicionar Projeto
        </Button>
      </DialogTrigger>

      {open && <div aria-hidden className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs" />}

      <DialogContent className="min-h-128 min-w-2.5 grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader className="gap-3">
          <DialogTitle>Novo Projeto</DialogTitle>
          <DialogDescription>
            <Tabs value={tabValue} onValueChange={setTabValue}>
              <TabsList className="w-full">
                {tabs.map((item) => (
                  <TabsTrigger
                    key={item.label}
                    className="cursor-pointer px-2"
                    value={item.label}
                  >
                    <item.icon />
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tabValue}>
          <TabsContent value="essencial">
            <form>
              <FieldGroup>
                <Controller
                  control={formProjects.control}
                  name="nome_projeto"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Nome do Projeto</FieldLabel>
                      <Input
                        {...field}
                        placeholder="Ex: Sistema ERP"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={formProjects.control}
                  name="horas_previstas"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Horas Previstas</FieldLabel>
                      <Input
                        type="number"
                        placeholder="Em Aberto (Campo vazio)"
                        value={field.value === "Em Aberto" ? "" : Number(field.value) || ""}
                        aria-invalid={fieldState.invalid}
                        onChange={(event) => {
                          const value = event.target.value
                          field.onChange(value === "" ? "Em Aberto" : Number(value))
                        }}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={formProjects.control}
                  name="ref_cliente"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Ticket de referência</FieldLabel>
                      <Input
                        placeholder="Ex: TIC-389045"
                        {...field}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={formProjects.control}
                  name="descricao"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Descrição</FieldLabel>
                      <AutoResizeTextarea
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Descreva brevemente o projeto"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>
          </TabsContent>

          <TabsContent value="equipe">
            <form>
              <FieldGroup>
                <Controller
                  control={formProjects.control}
                  name="solicitante"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Solicitante</FieldLabel>
                      <Input
                        placeholder="Ex: Equipe financeira"
                        {...field}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={formProjects.control}
                  name="centro_custo"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Centro de custo</FieldLabel>
                      <Input
                        placeholder="Ex: Compras, RH"
                        {...field}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={formProjects.control}
                  name="equipe"
                  render={({ field, fieldState }) => (
                    <Field ref={anchor} data-invalid={fieldState.invalid}>
                      <FieldLabel>Equipe</FieldLabel>
                      <Combobox
                        multiple
                        items={colaboradores}
                        itemToStringValue={(item: Colaborador) => item.label}
                        value={selectedColaboradores}
                        onValueChange={(novosColaboradores) => {
                          setSelectedColaboradores(novosColaboradores)
                          field.onChange(novosColaboradores.map((item) => item.value))
                        }}
                      >
                        <ComboboxChips>
                          <ComboboxValue>
                            {selectedColaboradores.map((item) => (
                              <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                            ))}
                          </ComboboxValue>
                          <ComboboxChipsInput placeholder="Adicionar colaborador" />
                        </ComboboxChips>
                        <ComboboxContent anchor={anchor}>
                          <ComboboxEmpty>Nenhum colaborador encontrado.</ComboboxEmpty>
                          <ComboboxList>
                            {(item: Colaborador) => (
                              <ComboboxItem key={item.value} value={item}>
                                {item.label}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

              </FieldGroup>
            </form>
          </TabsContent>

          <TabsContent value="configs">
            <form>
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    control={formProjects.control}
                    name="data_inicio"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Data de Início</FieldLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              locale={ptBR}
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(value) =>
                                field.onChange(value ? value.toISOString() : "")
                              }
                            />
                          </PopoverContent>
                        </Popover>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    control={formProjects.control}
                    name="data_fim"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Data de Fim</FieldLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              locale={ptBR}
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(value) =>
                                field.onChange(value ? value.toISOString() : "")
                              }
                            />
                          </PopoverContent>
                        </Popover>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>

                <Controller
                  control={formProjects.control}
                  name="cliente_id"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Parceiro</FieldLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o parceiro" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((client) => (
                            <SelectItem
                              key={client.clienteId}
                              value={String(client.clienteId)}
                            >
                              {client.nomeFantasia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={formProjects.control}
                  name="tipo"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Tipo</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipoProjeto.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={formProjects.control}
                  name="status"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Status do Projeto</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusProjeto.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            onClick={handleBack}
            variant={checkVariantBack(["configs", "equipe"], tabValue)}
          >
            {["configs", "equipe"].includes(tabValue) ? "Voltar" : "Cancelar"}
          </Button>
          <Button className="cursor-pointer" onClick={handleForward}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : ["essencial", "equipe"].includes(tabValue) ? (
              "Próximo"
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
