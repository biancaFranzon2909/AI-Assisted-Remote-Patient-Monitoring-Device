import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { apiFetch, isDisabledStyle } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PartnershipModal } from "./partnershipModal"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  Clock,
  Edit2,
  FolderKanban,
  Loader2,
  Receipt,
  Save,
  Globe,
  Share2,
  ChevronDownIcon,
  OctagonX,
  CircleCheck,
  Info,
  MapPin,
  NotebookPen,
  ExternalLink,
} from "lucide-react"
import { IconButton } from "@/components/ui/icon-button-tooltip"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { AddProjectModal } from "../projects/addProjectModal"
import { DeleteDialogGeral } from "../delete-dialog-geral"
import { EmptyStyled } from "../empty-comp"
import { useWorkspace } from "@/contexts/workspace-context"
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
import { normalizarWebsite, textoOuNulo } from "./clientUtils"

const formatarCNPJ = (valor: string) => {
  const v = valor.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  return v
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, "$1.$2")
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, "$1.$2.$3")
    .replace(/\.([A-Z0-9]{3})([A-Z0-9])/, ".$1/$2")
    .replace(/([A-Z0-9]{4})([A-Z0-9])/, "$1-$2")
    .substring(0, 18)
}

const labelClass =
  "text-xs font-semibold tracking-wide text-muted-foreground uppercase"

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState("detalhe")
  const [cliente, setCliente] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [reload, setReload] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [editavel, setEditavel] = useState(false)
  const [confirmarInativacao, setConfirmarInativacao] = useState(false)
  const [alterandoStatus, setAlterandoStatus] = useState(false)
  const [identificadorInput, setIdentificadorInput] = useState("")
  // Cópia do website/CNPJ salvos ao entrar em edição, para o header não
  // refletir o que ainda está sendo digitado.
  const [dadosSalvos, setDadosSalvos] = useState<{
    website: unknown
    cnpj: unknown
  } | null>(null)
  const [idCarregado, setIdCarregado] = useState(id)
  const { currentWorkspace } = useWorkspace()

  // Ao trocar de parceiro (/clients/A → /clients/B), descarta os dados do
  // anterior antes de pintar, para não exibi-los sob o id novo.
  if (id !== idCarregado) {
    setIdCarregado(id)
    setCliente(null)
    setDadosSalvos(null)
    setLoading(true)
  }
  const isOwner = currentWorkspace?.isOwner || currentWorkspace?.isAdmin

  const handleSave = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (cliente.email && !emailRegex.test(cliente.email)) {
      toast.error("Por favor, insira um e-mail válido.")
      return
    }
    if (textoOuNulo(cliente.website) && !normalizarWebsite(cliente.website)) {
      toast.error(
        "Informe um website válido, por exemplo https://exemplo.com.br."
      )
      return
    }

    const payload = {
      nome_fantasia: cliente.nomeFantasia,
      email: cliente.email,
      cnpj: cliente.cnpj.replace(/[^A-Z0-9]/gi, ""),
      cep: cliente.cep,
      endereco: cliente.endereco,
      cidade: cliente.cidade,
      estado: cliente.estado,
      razao_social: textoOuNulo(cliente.razaoSocial),
      inscricao_estadual: textoOuNulo(cliente.inscricaoEstadual),
      website: textoOuNulo(cliente.website),
      pais: textoOuNulo(cliente.pais),
      nota_interna: textoOuNulo(cliente.notaInterna),
      cliente_id: cliente.clienteId ?? id,
      status: isActive,
      identificador_parceiro: identificadorInput.trim() || null,
    }

    const response = await apiFetch(`/clientes/edit/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })

    if (response.error) {
      toast.error(response.message || "Erro ao salvar.")
      return
    }
    setIsEditing(false)
    setReload(!reload)
  }

  useEffect(() => {
    const fetchCliente = async () => {
      if (!id) return
      try {
        setLoading(true)
        const res = await apiFetch(`/clientes/list/${id}`)
        if (res.error) {
          setCliente(null)
        } else {
          setCliente(res.data)
          setIsActive(res.data.status)
          setEditavel(res.data.compartilhado === false)
          setIdentificadorInput(res.data.identificadorParceiro || "")
        }
      } catch (err) {
        setCliente(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCliente()
  }, [id, reload])

  const handleInactivate = async () => {
    setAlterandoStatus(true)
    try {
      const res = await apiFetch(`/clientes/edit/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: !isActive }),
      })
      if (!res.error) {
        toast.success(isActive ? "Parceiro inativado." : "Parceiro ativado.")
        setConfirmarInativacao(false)
        setReload(!reload)
      } else {
        toast.error(
          res?.message || (isActive ? "Erro ao inativar." : "Erro ao ativar.")
        )
      }
    } finally {
      setAlterandoStatus(false)
    }
  }

  const projetos = useMemo(() => {
    const list = cliente?.projetos
    return Array.isArray(list) ? list : []
  }, [cliente?.projetos])

  if (!loading && !cliente) {
    return <EmptyStyled />
  }

  if (loading && !cliente)
    return (
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    )

  const tabsConfig = [
    { name: "detalhe", label: "Informações gerais", icon: Edit2 },
    {
      name: "projetos",
      label: `Projetos (${projetos.length})`,
      icon: FolderKanban,
    },
  ]

  const resumo = [
    {
      icon: FolderKanban,
      label: "Projetos",
      value: cliente.projetosNumero ?? 0,
    },
    {
      icon: Clock,
      label: "Total de horas gastas",
      value: cliente.totalHorasGastas ?? "—",
    },
    {
      icon: Receipt,
      label: "Despesas totais",
      value: formatadorMoeda.format(cliente.totalDespesas ?? 0),
    },
  ]

  const headerFonte = isEditing && dadosSalvos ? dadosSalvos : cliente
  const websiteHeader = normalizarWebsite(headerFonte?.website)
  const cnpjHeader =
    typeof headerFonte?.cnpj === "string" ? formatarCNPJ(headerFonte.cnpj) : ""

  const subtitle =
    websiteHeader || cnpjHeader ? (
      <span className="mb-2 flex flex-wrap items-center gap-x-3 text-sm">
        {cnpjHeader && (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            CNPJ - {cnpjHeader}
          </span>
        )}
        {websiteHeader && (
          <div className="flex flex-1 items-center gap-1">
            <Globe className="size-4 shrink-0" />
            <a
              href={websiteHeader.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm text-primary underline underline-offset-4 outline-none dark:text-foreground"
            >
              {websiteHeader.rotulo}
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
              {/* <span className="sr-only">(abre em nova aba)</span> */}
            </a>
          </div>
        )}
      </span>
    ) : undefined

  const notaInterna = textoOuNulo(cliente.notaInterna)

  const apiCompartilhar = (projectId: string) => {
    apiFetch(`/partner/${projectId}/${id}`, {
      method: "POST",
    })
  }

  return (
    <>
      <PageHeader
        title={`Parceiro: ${cliente?.nomeFantasia || "Sem Nome"}`}
        subtitle={subtitle}
        tabs={tabsConfig}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        buttons={
          <>
            {cliente?.identificadorParceiro && (
              <PartnershipModal
                identificadorParceiro={cliente.identificadorParceiro}
              />
            )}
            {editavel &&
              (!isEditing ? (
                <IconButton
                  icon={<Edit2 className="size-4" />}
                  label="Editar"
                  onClick={() => {
                    setDadosSalvos({
                      website: cliente?.website,
                      cnpj: cliente?.cnpj,
                    })
                    setIsEditing(true)
                  }}
                />
              ) : (
                <IconButton
                  icon={<Save className="size-4" />}
                  label="Salvar"
                  onClick={handleSave}
                />
              ))}
            {isOwner &&
              editavel &&
              (isActive ? (
                <AlertDialog
                  open={confirmarInativacao}
                  onOpenChange={(aberto) => {
                    if (!alterandoStatus) setConfirmarInativacao(aberto)
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <IconButton
                      icon={<OctagonX className="h-4 w-4" />}
                      variant={"destructive"}
                      label="Inativar"
                    />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Inativar o parceiro{" "}
                        {cliente?.nomeFantasia
                          ? `"${cliente.nomeFantasia}"`
                          : "selecionado"}
                        ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Você poderá ativá-lo novamente depois.
                        {isEditing &&
                          " As alterações não salvas serão descartadas."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={alterandoStatus}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={alterandoStatus}
                        onClick={(e) => {
                          e.preventDefault()
                          handleInactivate()
                        }}
                      >
                        {alterandoStatus && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        {alterandoStatus ? "Inativando..." : "Inativar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <IconButton
                  icon={<CircleCheck className="h-4 w-4" />}
                  variant={"default"}
                  label="Ativar"
                  disabled={alterandoStatus}
                  onClick={handleInactivate}
                />
              ))}
            {editavel && (
              <DeleteDialogGeral
                endpoint={`/clientes/delete/${id}`}
                onSuccess={() => navigate("/clients")}
              />
            )}
          </>
        }
      />

      <main className="min-h-0 w-full pr-4 pl-1">
        <Tabs value={activeTab}>
          <TabsContent value="detalhe" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-semibold">
                      <Info
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      Dados do parceiro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel
                          htmlFor="cliente-nome"
                          className={labelClass}
                        >
                          Nome fantasia
                        </FieldLabel>
                        <Input
                          id="cliente-nome"
                          autoComplete="organization"
                          disabled={!isEditing}
                          value={cliente?.nomeFantasia ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({
                              ...cliente,
                              nomeFantasia: e.target.value,
                            })
                          }
                        />
                        <FieldDescription className="text-xs">
                          Sera exibido no restante da plataforma e relatorios
                        </FieldDescription>
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-razao-social"
                          className={labelClass}
                        >
                          Razão social
                        </FieldLabel>
                        <Input
                          id="cliente-razao-social"
                          disabled={!isEditing}
                          value={cliente?.razaoSocial ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({
                              ...cliente,
                              razaoSocial: e.target.value,
                            })
                          }
                        />
                       
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-cnpj"
                          className={labelClass}
                        >
                          CNPJ
                        </FieldLabel>
                        <Input
                          id="cliente-cnpj"
                          disabled={!isEditing}
                          value={cliente?.cnpj ?? ""}
                          className={isDisabledStyle(isEditing)}
                          maxLength={18}
                          onChange={(e) =>
                            setCliente({
                              ...cliente,
                              cnpj: formatarCNPJ(e.target.value),
                            })
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-inscricao-estadual"
                          className={labelClass}
                        >
                          Inscrição estadual
                        </FieldLabel>
                        <Input
                          id="cliente-inscricao-estadual"
                          disabled={!isEditing}
                          value={cliente?.inscricaoEstadual ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({
                              ...cliente,
                              inscricaoEstadual: e.target.value,
                            })
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="cliente-identificador" className={labelClass}>
                          Identificador de empresa
                        </FieldLabel>
                        <Input
                          id="cliente-identificador"
                          disabled={!isEditing}
                          value={identificadorInput}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setIdentificadorInput(e.target.value)
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-website"
                          className={labelClass}
                        >
                          Website
                        </FieldLabel>
                        <Input
                          id="cliente-website"
                          type="url"
                          inputMode="url"
                          autoComplete="url"
                          placeholder="https://exemplo.com.br"
                          disabled={!isEditing}
                          value={cliente?.website ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({ ...cliente, website: e.target.value })
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-email"
                          className={labelClass}
                        >
                          E-mail corporativo
                        </FieldLabel>
                        <Input
                          id="cliente-email"
                          autoComplete="email"
                          disabled={!isEditing}
                          value={cliente?.email ?? ""}
                          type="email"
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({ ...cliente, email: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-semibold">
                      <MapPin
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      Endereço
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field className="sm:col-span-2">
                        <FieldLabel
                          htmlFor="cliente-endereco"
                          className={labelClass}
                        >
                          Logradouro
                        </FieldLabel>
                        <Input
                          id="cliente-endereco"
                          autoComplete="address-line1"
                          disabled={!isEditing}
                          value={cliente?.endereco ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({ ...cliente, endereco: e.target.value })
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-cep"
                          className={labelClass}
                        >
                          CEP
                        </FieldLabel>
                        <Input
                          id="cliente-cep"
                          autoComplete="postal-code"
                          inputMode="numeric"
                          disabled={!isEditing}
                          value={cliente?.cep ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({ ...cliente, cep: e.target.value })
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-cidade"
                          className={labelClass}
                        >
                          Cidade
                        </FieldLabel>
                        <Input
                          id="cliente-cidade"
                          autoComplete="address-level2"
                          disabled={!isEditing}
                          value={cliente?.cidade ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({ ...cliente, cidade: e.target.value })
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-estado"
                          className={labelClass}
                        >
                          Estado (UF)
                        </FieldLabel>
                        <Input
                          id="cliente-estado"
                          autoComplete="address-level1"
                          maxLength={2}
                          disabled={!isEditing}
                          value={cliente?.estado ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({ ...cliente, estado: e.target.value })
                          }
                        />
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="cliente-pais"
                          className={labelClass}
                        >
                          País
                        </FieldLabel>
                        <Input
                          id="cliente-pais"
                          autoComplete="country-name"
                          disabled={!isEditing}
                          value={cliente?.pais ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({ ...cliente, pais: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-semibold">
                      <NotebookPen
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      Notas internas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <Field>
                        <FieldLabel
                          htmlFor="cliente-nota-interna"
                          className="sr-only"
                        >
                          Nota interna
                        </FieldLabel>
                        <Textarea
                          id="cliente-nota-interna"
                          rows={5}
                          value={cliente?.notaInterna ?? ""}
                          className={isDisabledStyle(isEditing)}
                          onChange={(e) =>
                            setCliente({
                              ...cliente,
                              notaInterna: e.target.value,
                            })
                          }
                        />
                      </Field>
                    ) : notaInterna ? (
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                        {notaInterna}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma nota interna.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-semibold">
                      <Receipt
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      Resumo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="flex flex-col gap-4 rounded-lg bg-primary/10 p-4">
                      {resumo.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                          <Icon
                            aria-hidden="true"
                            className="mt-0.5 size-5 shrink-0 text-primary"
                          />
                          <div className="flex min-w-0 flex-col gap-1">
                            <dt className="text-xs font-semibold tracking-wide text-foreground uppercase">
                              {label}
                            </dt>
                            <dd className="text-2xl font-bold break-words text-foreground tabular-nums">
                              {value}
                            </dd>
                          </div>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projetos" className="mt-4">
            <Card className="px-4">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="font-bold">Total: {projetos.length}</div>
                {editavel && (
                  <AddProjectModal
                    initialClientId={id}
                    onSuccess={() => setReload(!reload)}
                  />
                )}
              </div>
              <div
                className={`items-start gap-4 ${projetos.length > 0 ? "grid sm:grid-cols-2 lg:grid-cols-3" : ""}`}
              >
                {projetos.length > 0 ? (
                  projetos.map((proj: any) => {
                    const projectId = proj?.projetoId

                    return (
                      <Collapsible
                        disabled={
                          cliente.identificadorParceiro?.length > 1
                            ? false
                            : true
                        }
                        key={projectId}
                        className="rounded-2xl border bg-sidebar-accent data-[state=open]:bg-muted"
                      >
                        <div className="flex items-center px-3 py-1">
                          <Link
                            to={
                              projectId ? `/projects/${projectId}` : "/projects"
                            }
                            className="flex-1 truncate text-sm font-semibold text-blue-900 hover:underline"
                          >
                            {proj?.nomeProjeto || "Projeto"}
                          </Link>
                          <CollapsibleTrigger asChild>
                            {editavel && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="group h-8 w-8 shrink-0"
                              >
                                <ChevronDownIcon className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </Button>
                            )}
                          </CollapsibleTrigger>
                        </div>

                        <CollapsibleContent className="space-y-2">
                          <div className="p-1 px-2 pb-2">
                            <div className="flex w-full items-center gap-2 px-2">
                              <Share2 className="size-4 shrink-0 text-muted-foreground" />
                              <Label
                                htmlFor={`share-${projectId}`}
                                className="flex-1 cursor-pointer font-medium"
                              >
                                Compartilhar projeto
                              </Label>
                              <Switch
                                id={`share-${projectId}`}
                                checked={proj.compartilhado}
                                onChange={() => apiCompartilhar(projectId)}
                              />
                            </div>
                            <p className="mt-2 pl-2 text-xs text-muted-foreground">
                              As atividades vinculadas a este projeto serão
                              compartilhadas automaticamente.
                            </p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })
                ) : (
                  <div className="flex w-full items-center justify-center">
                    Sem projetos.
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
