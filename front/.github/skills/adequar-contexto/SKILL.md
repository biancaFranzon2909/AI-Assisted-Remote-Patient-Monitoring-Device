---
name: adequar-contexto
description: "Explora o repositório e adequa AGENTS.md, instruções, agentes e skills ao contexto real do ChronoTracker (stack, pastas, comandos, padrões e design system)"
disable-model-invocation: true
---
# Adequar o contexto de IA ao projeto real

Você vai ler este repositório e ajustar os arquivos de contexto de IA (`AGENTS.md`, `.github/instructions/`, `.github/agents/` e skills) para refletirem o que o código realmente faz. O objetivo é que qualquer agente, ao receber uma tarefa de front ou design, já saiba onde as coisas ficam, quais padrões seguir e quais comandos rodar, sem adivinhar.

Foco opcional do usuário: ${input:foco:Opcional — ex.: só o front, ou uma área específica}

## Regras
1. **Só registre o que verificou no código.** Para cada fato novo, confirme em um arquivo real e anote o caminho. Se não conseguir confirmar, não escreva: coloque em "Dúvidas em aberto" no relatório final.
2. **Não altere código da aplicação.** Você só edita `AGENTS.md`, arquivos em `.github/` e, se criar, `docs/ai/`.
3. **Não leia nem copie** `.env*`, chaves, tokens, dados de usuários ou saídas de banco. Se encontrar um segredo no repositório, avise sem reproduzi-lo.
4. **Não execute** instalação, build, migração, deploy nem qualquer comando que altere estado. Para listar arquivos e confirmar scripts, leia `package.json`, use a busca e `git ls-files`.
5. **Preserve o que já está certo.** Não apague regras existentes: ajuste o que divergir e, quando uma regra parecer errada para este projeto, aponte no relatório em vez de remover em silêncio.
6. **Seja enxuto.** O `AGENTS.md` é carregado em toda conversa: mantenha até ~120 linhas. Detalhes longos (catálogos, mapas) vão para uma skill, que só é carregada sob demanda.
7. Escreva em português do Brasil; nomes de arquivos, comandos e identificadores ficam como estão no código.

## Etapa 1 — Inventário (somente leitura)
Monte uma lista de tarefas e levante os itens abaixo, anotando o caminho de cada evidência.

**Estrutura**
- É monorepo, dois repositórios ou só um lado (front ou back)? Qual gerenciador de pacotes (lockfile) e se há workspaces.
- Árvore de pastas até 3 níveis nas áreas de front e back: onde ficam páginas/rotas, componentes, componentes de UI base, hooks, utilitários, serviços de API, tipos, estilos globais e testes.
- Aliases de import (`tsconfig`, bundler) e convenções de nome de arquivo.

**Stack e versões**
- Versões reais de React, React Router, TypeScript, Tailwind, shadcn/ui (e se a base é Radix ou Base UI, via `components.json`), react-hook-form, Zod, bundler, biblioteca de dados/requisição, toasts, ícones, animação, datas e tabelas.
- Lint, formatador, typecheck e framework de teste (unitário e e2e), com os scripts exatos do `package.json` para dev, build, lint, typecheck e test em cada pacote.

**Design system**
- Onde ficam o tema e os tokens (CSS com variáveis / `@theme`); lista dos tokens semânticos existentes, fontes, escala de raio e sombras; como o modo escuro é ativado.
- Lista dos componentes de UI base instalados (pasta `ui`) e dos componentes compartilhados do app (ex.: DataTable, AppSidebar, wrappers de formulário).
- Padrões de layout das páginas (cabeçalho, contêiner, espaçamentos recorrentes).

**Padrões de código a imitar** — escolha um bom exemplo de cada, com caminho:
- tela de listagem com tabela e filtros; formulário (inclusive dentro de Dialog); rota protegida; chamada à API; hook de dados; teste de componente.
- Como o projeto trata: carregando, vazio, erro, toast, validação, permissões e formatação de data, moeda e duração.

**Domínio e API**
- Entidades e enums principais (ex.: schema do Prisma) e fluxos de status; rotas da API que o front consome; formato padrão de erro; como funcionam autenticação e sessão.
- Estrutura de `src/entities/<entidade>/` (DTO, Service, Controller) e uma entidade de referência.

**Operação**
- Workflows de CI, ambientes (produção e homologação), hospedagem e requisitos de deploy que afetem o front (ex.: fallback de SPA).

## Etapa 2 — Comparar com os arquivos de contexto atuais
Leia `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/*`, `.github/agents/*` e `.github/skills/*`. Para cada suposição que não bate com o repositório (versão, pasta, componente, comando, biblioteca, convenção), registre: **o que está escrito → o que o código mostra (caminho)**.

## Etapa 3 — Aplicar ajustes
1. **`AGENTS.md`:** stack e versões reais, mapa de pastas (só o essencial), comandos exatos por pacote, aliases de import e os "exemplos de referência" (um caminho por tipo de padrão). Mantenha princípios e definição de pronto; ajuste o que divergir.
2. **`.github/instructions/*.instructions.md`:** troque o `applyTo` genérico pelos globs reais das pastas (ex.: a de páginas, a de componentes) e confirme que cada glob casa com arquivos existentes. Substitua orientações genéricas por referências concretas: nomes de tokens, componentes, hooks e utilitários de formatação que o projeto já tem.
3. **`.github/agents/*.agent.md`:** se algum agente citar ferramenta, biblioteca ou pasta que não existe neste projeto, corrija. Se o projeto não tiver testes, deixe o `testes-front` propondo a infraestrutura mínima em vez de assumir uma.
4. **Skill `mapa-do-projeto`:** crie `.github/skills/mapa-do-projeto/SKILL.md`, com `name` igual ao da pasta e `description` dizendo quando usar. Conteúdo: catálogo dos componentes de UI e compartilhados e quando usar cada um, hooks e utilitários úteis, rotas e telas, camada de API, entidades e status do domínio e os exemplos de referência com caminhos. Se ficar longo, divida em arquivos dentro de `references/`.
5. Mantenha `.github/copilot-instructions.md` curto e apontando para o `AGENTS.md`.

## Etapa 4 — Verificar
- Frontmatter válido em todos os arquivos que você tocou; `name` do agente igual ao nome do arquivo; `name` da skill igual ao nome da pasta.
- Todo caminho, comando e glob citado existe de fato (confira por busca ou leitura).
- `AGENTS.md` dentro do limite de tamanho e sem duplicar o que já está nas instruções.

## Entrega final
Responda em português, de forma curta e organizada:
1. **O que mudou**, por arquivo, em uma linha cada.
2. **Divergências encontradas** (antes → depois, com caminho).
3. **Dúvidas em aberto:** até 5 perguntas objetivas sobre o que não dá para inferir do código (regra de negócio, preferência de design, decisão pendente).
4. **Lacunas do projeto** que atrapalham a qualidade (ex.: sem testes, sem tokens de espaçamento, componentes duplicados, sem tratamento de erro padrão) e o que você sugere, sem implementar.