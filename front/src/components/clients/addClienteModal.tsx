import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/utils"
import { useForm, type FieldErrors } from "react-hook-form"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Building2, Loader2, MapPin, NotebookPen, Plus } from "lucide-react"
import { navigateTab } from "../projects/addProjectUtils"
import { normalizarWebsite, textoOuNulo } from "./clientUtils"

interface Cliente {
  cliente_id: number
  cnpj: string
  nome_fantasia: string
  razao_social: string
  inscricao_estadual: string
  website: string
  email: string
  cep: string
  endereco: string
  cidade: string
  estado: string
  pais: string
  nota_interna: string
  status: boolean
}

const clienteVazio: Cliente = {
  cliente_id: 0,
  cnpj: "",
  nome_fantasia: "",
  razao_social: "",
  inscricao_estadual: "",
  website: "",
  email: "",
  cep: "",
  endereco: "",
  cidade: "",
  estado: "",
  pais: "",
  nota_interna: "",
  status: true,
}

/* FORMATADORES */
const formatarCNPJ = (valor: string) => {
  const v = valor.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  return v
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, "$1.$2")
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, "$1.$2.$3")
    .replace(/\.([A-Z0-9]{3})([A-Z0-9])/, ".$1/$2")
    .replace(/([A-Z0-9]{4})([A-Z0-9])/, "$1-$2")
    .substring(0, 18)
}

const formatarCEP = (valor: string) => {
  const v = valor.replace(/\D/g, "")
  return v.replace(/(\d{5})(\d)/, "$1-$2").substring(0, 9)
}

const tabs = [
  { icon: Building2, label: "essencial", titulo: "Dados do parceiro" },
  { icon: MapPin, label: "endereco", titulo: "Endereço" },
  { icon: NotebookPen, label: "notas", titulo: "Notas internas" },
] as const

type Aba = (typeof tabs)[number]["label"]
type CampoDoFormulario = Exclude<keyof Cliente, "cliente_id" | "status">

// Em ordem de exibição: o primeiro campo com erro é o que recebe foco.
const abaDoCampo: Record<CampoDoFormulario, Aba> = {
  nome_fantasia: "essencial",
  razao_social: "essencial",
  cnpj: "essencial",
  inscricao_estadual: "essencial",
  website: "essencial",
  email: "essencial",
  cep: "endereco",
  endereco: "endereco",
  cidade: "endereco",
  estado: "endereco",
  pais: "endereco",
  nota_interna: "notas",
}
const camposEmOrdem = Object.keys(abaDoCampo) as CampoDoFormulario[]
const camposDaAba = (aba: string) =>
  camposEmOrdem.filter((campo) => abaDoCampo[campo] === aba)

export function AddClientModal({
  onClientAdded,
}: {
  onClientAdded?: () => void | Promise<void>
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [tabValue, setTabValue] = useState("essencial")

  const form = useForm<Cliente>({
    defaultValues: clienteVazio,
    mode: "onTouched",
  })

  const abasComErro = new Set(
    camposEmOrdem
      .filter((campo) => form.formState.errors[campo])
      .map((campo) => abaDoCampo[campo])
  )

  function focarCampo(campo: CampoDoFormulario) {
    setTabValue(abaDoCampo[campo])
    // Espera a aba ficar visível antes de focar.
    setTimeout(() => form.setFocus(campo), 0)
  }

  function erroNoCampo(campo: CampoDoFormulario, message: string) {
    form.setError(campo, { message })
    focarCampo(campo)
  }

  function onInvalid(errors: FieldErrors<Cliente>) {
    const primeiro = camposEmOrdem.find((campo) => errors[campo])
    if (primeiro) focarCampo(primeiro)
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (!newOpen) {
      form.reset(clienteVazio)
      setTabValue("essencial")
    }
  }

  async function handleForward() {
    if (tabValue === tabs[tabs.length - 1].label) {
      form.handleSubmit(onSubmit, onInvalid)()
      return
    }
    const abaValida = await form.trigger(camposDaAba(tabValue), {
      shouldFocus: true,
    })
    if (!abaValida) return
    navigateTab(
      tabs.map((tab) => ({ label: tab.label })),
      tabValue,
      1,
      setTabValue
    )
  }

  function handleBack() {
    if (tabValue === tabs[0].label) {
      setOpen(false)
      return
    }
    navigateTab(
      tabs.map((tab) => ({ label: tab.label })),
      tabValue,
      -1,
      setTabValue
    )
  }

  const onSubmit = async (values: Cliente) => {
    const cnpjLimpo = values.cnpj.replace(/[^A-Z0-9]/gi, "")
    const cepLimpo = values.cep.replace(/\D/g, "")

    if (cnpjLimpo.length !== 14) {
      erroNoCampo("cnpj", "O CNPJ deve ter 14 dígitos.")
      return
    }
    if (cepLimpo.length !== 8) {
      erroNoCampo("cep", "O CEP deve ter 8 dígitos.")
      return
    }
    if (values.estado.trim().length !== 2) {
      erroNoCampo("estado", "Use 2 letras (ex: SP).")
      return
    }

    const payload = {
      ...values,
      cnpj: cnpjLimpo,
      cep: cepLimpo,
      estado: values.estado.toUpperCase(),
      razao_social: textoOuNulo(values.razao_social),
      inscricao_estadual: textoOuNulo(values.inscricao_estadual),
      website: textoOuNulo(values.website),
      pais: textoOuNulo(values.pais),
      nota_interna: textoOuNulo(values.nota_interna),
    }

    const isEdit = values.cliente_id !== 0
    const endpoint = isEdit
      ? `/clientes/edit/${values.cliente_id}`
      : `/clientes/create/`
    const method = isEdit ? "PUT" : "POST"

    try {
      setIsLoading(true)
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      })

      if (response.error) {
        const msg = response.message || "Erro inesperado."
        if (msg.toLowerCase().includes("cnpj")) {
          erroNoCampo("cnpj", msg)
          toast.error("CNPJ duplicado", { description: msg })
          return
        }

        toast.error("Erro ao salvar", { description: msg })
        return
      }

      toast.success(isEdit ? "Cliente atualizado!" : "Cliente cadastrado!")
      form.reset(clienteVazio)
      await onClientAdded?.()
      setOpen(false)
    } catch (err) {
      console.error("Erro inesperado:", err)
      toast.error("Erro no servidor")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog modal open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Adicionar Parceiro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-h-[min(32rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] sm:min-w-md">
        <DialogHeader className="gap-3">
          <DialogTitle> Novo Parceiro </DialogTitle>
          <DialogDescription>
            <Tabs value={tabValue} onValueChange={setTabValue}>
              <TabsList className="w-full">
                {tabs.map((tab) => {
                  const comErro = abasComErro.has(tab.label)
                  return (
                    <TabsTrigger
                      key={tab.label}
                      className="relative cursor-pointer px-2"
                      value={tab.label}
                      aria-label={comErro ? `${tab.titulo} (com erro)` : tab.titulo}
                      title={tab.titulo}
                    >
                      <tab.icon aria-hidden="true" />
                      {comErro && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive"
                        />
                      )}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* Abas sempre montadas (só ocultas) para que todos os campos sejam
              validados no envio, inclusive os das abas não visíveis. */}
          <Tabs value={tabValue} className="-mx-1 min-h-0 overflow-y-auto px-1">
            <TabsContent
              value="essencial"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <form>
                <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome_fantasia"
                  rules={{ required: "Nome fantasia é obrigatório" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome fantasia</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Parceiro"
                          autoComplete="organization"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="razao_social"
                  rules={{ required: "Razão social é obrigatório" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão social</FormLabel>
                      <FormControl>
                        <Input placeholder="Parceiro LTDA." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="12.3L5.A78/0001-90"
                          maxLength={18}
                          name={field.name}
                          ref={field.ref}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(e) =>
                            field.onChange(formatarCNPJ(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inscricao_estadual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição estadual</FormLabel>
                      <FormControl>
                        <Input placeholder="Isento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  rules={{
                    validate: (valor) =>
                      !valor.trim() ||
                      normalizarWebsite(valor) !== null ||
                      "Informe um website válido, ex.: https://exemplo.com.br",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          inputMode="url"
                          autoComplete="url"
                          placeholder="https://exemplo.com.br"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  rules={{
                    required: "O e-mail corporativo é obrigatório",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "E-mail inválido",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail corporativo</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="empresa@contato.com.br"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </form>
            </TabsContent>

            <TabsContent
              value="endereco"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <form>
                <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="12345-123"
                          maxLength={9}
                          inputMode="numeric"
                          autoComplete="postal-code"
                          name={field.name}
                          ref={field.ref}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(e) =>
                            field.onChange(formatarCEP(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endereco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Rua dos Testes, 123"
                          autoComplete="address-line1"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Porto Alegre"
                            autoComplete="address-level2"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estado"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Estado (UF)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="UF"
                            maxLength={2}
                            autoComplete="address-level1"
                            name={field.name}
                            ref={field.ref}
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value.toUpperCase().slice(0, 2)
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="pais"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brasil"
                          autoComplete="country-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </form>
            </TabsContent>

            <TabsContent
              value="notas"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <form>
                <FormField
                  control={form.control}
                  name="nota_interna"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nota interna</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="Observações sobre o parceiro"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              onClick={handleBack}
              variant={tabValue === "essencial" ? "destructive" : "outline"}
              disabled={isLoading}
            >
              {tabValue === "essencial" ? "Cancelar" : "Voltar"}
            </Button>
            <Button
              onClick={handleForward}
              className="cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : tabValue === tabs[tabs.length - 1].label ? (
                "Salvar"
              ) : (
                "Próximo"
              )}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
