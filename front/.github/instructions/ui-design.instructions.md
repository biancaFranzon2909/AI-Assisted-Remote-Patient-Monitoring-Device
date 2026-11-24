---
applyTo: "src/**/*.tsx,src/**/*.css"
---

# Design de interface

O ChronoTracker é uma ferramenta de trabalho usada todos os dias. Priorize clareza, densidade confortável e consistência em vez de novidade visual.

## Tokens e tema
- Use as variáveis semânticas definidas em `src/index.css` (`background`, `foreground`, `muted`, `primary`, `destructive`, `border`, `ring` e tokens da sidebar) via classes Tailwind (`bg-background`, `text-muted-foreground`). Prefira tokens; evite valores hex/RGB e cores fixas em novos componentes.
- Se faltar um token, proponha um novo no tema em vez de criar exceção local.
- Tudo precisa funcionar em claro e escuro; teste os dois.

## Tipografia
- Escala consistente (ex.: 12/14/16/20/24/30). Corpo 14–16 px, `leading` de 1.4–1.6.
- No máximo 2–3 pesos. Hierarquia por tamanho, peso e contraste, não por cor.
- Números que se comparam ou somam (horas, valores) usam `tabular-nums` e alinham à direita.
- Texto corrido com 45–75 caracteres por linha.

## Espaçamento e layout
- Base de 4 px (escala do Tailwind). Espaço interno de um grupo menor que o espaço entre grupos (proximidade).
- Alinhe a uma grade; evite larguras e alturas fixas em px quando `min-`/`max-` ou `flex`/`grid` resolvem.
- Um ponto focal por tela e uma ação primária por contexto. Ações secundárias usam `outline` ou `ghost`.
- Raio de borda use a escala derivada de `--radius` em `src/index.css`; mantenha sombras e bordas consistentes com os componentes vizinhos.

## Cor e contraste
- Texto normal ≥ 4.5:1; texto grande, ícones, bordas de campo e anéis de foco ≥ 3:1 (WCAG 2.2 AA).
- Nunca comunique estado só por cor: some ícone e texto (ex.: "Rejeitada" com ícone, não só vermelho).
- Cor semântica tem um só significado em todo o app (destrutivo, sucesso, aviso).

## Estados de todo elemento interativo
`default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`.
Para blocos de dados: `carregando` (skeleton quando passar de ~300 ms), `vazio` (com explicação e próxima ação), `erro` (com "tentar de novo") e `sem resultado de filtro` (diferente de vazio, com "limpar filtros").

## Movimento
- Anime `transform` e `opacity` (aceleradas por GPU); evite animar `width`, `height`, `top`, `left`.
- Microinterações de 150–250 ms; entrada com `ease-out`, saída com `ease-in`; stagger curto (30–60 ms por item).
- Toda animação tem propósito (feedback, continuidade, hierarquia). Respeite `prefers-reduced-motion` (`motion-reduce:`).

## Responsivo
- Mobile-first com breakpoints do Tailwind. Teste 320, 375, 768, 1024 e 1440 px; sem scroll horizontal (WCAG 1.4.10).
- Alvos de toque ≥ 44×44 px no mobile (mínimo absoluto do WCAG 2.5.8: 24×24 px).
- Tabelas largas: priorize colunas, esconda as secundárias ou use scroll horizontal contido no próprio componente.
- Use `min-h-dvh` em vez de `h-screen` para telas cheias no mobile.

## Acessibilidade
- Elemento nativo antes de ARIA: `button` para ação, `a`/`Link` para navegação, `label` ligado ao campo.
- Botão só com ícone tem `aria-label` em pt-BR; ícone decorativo tem `aria-hidden`.
- Foco sempre visível (`focus-visible:ring`); ordem de Tab segue a ordem visual.
- Mensagem dinâmica (toast, erro) em região `aria-live` ou em componente que já faça isso.
- Imagem informativa tem `alt`; decorativa tem `alt=""`.

## Microcopy (pt-BR)
- Botão com verbo + objeto ("Salvar projeto", "Enviar despesa"), não "OK" ou "Enviar".
- Erro diz o que houve e como resolver, sem culpar o usuário e sem jargão técnico.
- Tom direto e consistente; mesma palavra para o mesmo conceito em todo o app (sempre "projeto", "cliente", "lançamento").
- Datas, números e moeda com `Intl` em `pt-BR` (nunca montar formato à mão); prefira reaproveitar utilitários existentes, como `formatVhc` em `src/components/administrative/types.ts`.
