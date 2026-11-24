---
applyTo: "src/components/**/*.tsx,src/pages/**/*.tsx,src/components/**/*Utils.ts"
---

# Formulários, diálogos e tabelas

## Formulários (react-hook-form + Zod)
- Schema Zod em arquivo ao lado do formulário (ex.: `addProjectUtils.ts`); `zodResolver`; tipos por `z.infer`.
- Use os componentes de formulário existentes em `src/components/ui/` quando aplicável. Todo campo tem rótulo visível; placeholder nunca substitui label.
- Valide ao sair do campo (`onBlur`/`onTouched`) e no envio, não a cada tecla. Depois do primeiro erro, revalide ao digitar.
- Erro junto ao campo, específico e em pt-BR; ligue com `aria-invalid` e `aria-describedby`. No envio inválido, leve o foco ao primeiro campo com erro.
- Marque obrigatórios de forma consistente e use `autoComplete`, `inputMode` e `type` corretos (e-mail, número, telefone).
- Desabilite o botão de envio só enquanto envia (evita duplo clique) e mostre estado de carregamento. Nunca limpe os campos quando o servidor devolver erro.
- Erro vindo do back-end é mapeado ao campo (`setError`) quando for de um campo; senão, aparece em um alerta no topo do formulário.
- Alterações não salvas: avise ao fechar ou navegar se o formulário estiver sujo (`formState.isDirty`).

### Formulário dentro de Dialog com Tabs
- Erros em uma aba escondida passam despercebidos: marque a aba com indicador de erro e, no envio inválido, abra a primeira aba com erro e foque o campo.
- Mantenha o botão de salvar visível (rodapé fixo do Dialog) e o conteúdo rolável dentro do Dialog, não da página.
- Divida em abas só quando houver grupos realmente independentes; campos essenciais ficam na primeira.

## Diálogos
- Foco inicial no primeiro campo (ou no botão seguro, em confirmações); `Esc` fecha; ao fechar, o foco volta ao gatilho.
- Evite diálogo dentro de diálogo. Ação destrutiva pede confirmação específica ("Excluir o projeto Alfa?") e, quando reversível, prefira "Desfazer" em toast.
- **Armadilha conhecida:** Combobox, Select ou Popover renderizados em portal dentro de um `Dialog` modal podem ficar sem clique, porque o Dialog modal bloqueia `pointer-events` fora dele. No projeto isso foi resolvido com `modal={false}` no `Dialog`; ao usar essa saída, confira foco e fechamento por clique fora.
- Multi-select com chips: use o anchor do componente (`useComboboxAnchor`) para posicionar o popup no contêiner dos chips.

## Tabelas de dados (DataTable)
- Números alinhados à direita com `tabular-nums`; texto à esquerda; cabeçalho `sticky` em listas longas.
- Ordenação com indicação visual e `aria-sort`. Filtros por coluna combináveis, com chips dos filtros ativos, contador e "Limpar filtros".
- Estado de filtros, ordenação e página em search params.
- Estados distintos: carregando (skeleton com as colunas), vazio ("Nenhum lançamento ainda" + ação) e sem resultado de filtro.
- Ações por linha em menu (`DropdownMenu`) com `aria-label` descrevendo a linha ("Ações do projeto Alfa").
- Seleção em massa mostra barra de ações com a contagem selecionada.
- Linha clicável precisa de um controle acessível por teclado (link ou botão), não só `onClick` na `tr`.

## Tailwind v4 (armadilhas)
- O Tailwind detecta classes por texto estático: escreva nomes completos, nunca monte com interpolação (`` `group-hover:${x}` ``). Use mapa de variantes (`cva`) ou condicionais com strings completas.
- `group-hover:` e `group-focus-within:` só funcionam se um ancestral tiver `group`. Ao colocar overlay sobre `Avatar` ou card, confira o `group` e o `relative` do contêiner.
- Para sobrescrever classes de componentes shadcn, use `cn()` (tailwind-merge) e confira a ordem.
