import { useMemo, useState } from "react"
import { Check, ChevronDown, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export interface SeletorItem {
  id: string
  nome: string
  compartilhado?: boolean
  refCliente?: string
  [key: string]: any
}

interface SeletorProps {
  label?: string
  items: SeletorItem[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  clearOptionLabel?: string
  small?: boolean
  className?: string
}

/**
 * Normalizar o texto para aumentar precisao
 * @param texto "  JOÃO Açaí "
 * @returns "joao acai"
 */
function normalizar(texto?: string) {
  return (texto ?? "") //valida input
    .normalize("NFD") //separa "é" = "e" + "´"
    .replace(/[\u0300-\u036f]/g, "") //retirar os acentos
    .toLowerCase()//minúsculo
    .trim()//sem espaços nas pontas
}

// 0 = não bate. Todos os termos precisam bater em nome OU refCliente. 
// Serve para criar um escore dos items mais compativeis por termos
function pontuar(item: SeletorItem, termos: string[]) {
  const nome = normalizar(item.nome)
  const ref = normalizar(item.refCliente)
  let total = 0

  for (const termo of termos) {
    let pontos = 0
    if (nome === termo || ref === termo) pontos = 3
    else if (nome.startsWith(termo) || ref.startsWith(termo)) pontos = 2
    else if (nome.includes(termo) || ref.includes(termo)) pontos = 1

    if (pontos === 0) return 0 // um termo sem correspondência descarta o item
    total += pontos
  }
  return total
}

export function SeletorSearchBar({
  label,
  items = [],
  value,
  onValueChange,
  placeholder = "Selecionar",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled = false,
  small = false,
  className,
}: SeletorProps) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState("")

  const itemSelecionado = items.find((item) => item.id === value)

  const itensFiltrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean) // limpar os termos e retornar o um array apenas de palavras
    if (termos.length === 0) return items

    return items
      .map((item) => ({ item, score: pontuar(item, termos) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score) // empate mantem a ordem original
      .map(({ item }) => item)
  }, [items, busca])

  function handleOpenChange(aberto: boolean) {
    setOpen(aberto)
    if (!aberto) setBusca("") // limpa a busca ao fechar
  }

  return (
    <div className={`w-full space-y-2 ${className ?? ""}`}>
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className={`truncate ${small ? "text-xs" : ""}`}>
              {itemSelecionado ? itemSelecionado.nome : placeholder}
            </span>
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          sideOffset={-31.6}
          align="start"
          className="flex p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          {/* shouldFilter={false}: o filtro é nosso (itensFiltrados) */}
          <Command className="p-0" shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={busca}
              onValueChange={setBusca}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {itensFiltrados.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id} // único, não depende mais do nome
                    className="w-full flex justify-between"
                    onSelect={() => {
                      onValueChange(String(item.id))
                      handleOpenChange(false)
                    }}
                  >
                    <div className={`w-full flex items-center justify-between ${small ? "text-xs" : ""}`}>
                      <div className="flex gap-3 items-center">
                        {item.nome}
                        {item.refCliente && (
                          <span className="text-xs text-muted-foreground">
                            {item.refCliente}
                          </span>
                        )}
                      </div>
                      {item.compartilhado && <Share2 />}
                      {value === item.id ? <Check className="ml-auto" /> : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}