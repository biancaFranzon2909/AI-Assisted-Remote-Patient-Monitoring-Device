---
description: Explora o repositório da API e adequa AGENTS.md, instruções, agentes e skills ao contexto real do back-end do ChronoTracker (stack, pastas, comandos, padrões, schema e deploy)
agent: agent
tools: ['read', 'search', 'edit', 'todo']
---

# Adequar o contexto de IA ao back-end real

Você vai ler este repositório e ajustar os arquivos de contexto de IA (`AGENTS.md`, `.github/instructions/`, `.github/agents/` e skills) para refletirem o que o código realmente faz. O objetivo é que qualquer agente, ao receber uma tarefa de API, já saiba onde as coisas ficam, quais padrões seguir e quais comandos rodar, sem adivinhar.

Foco opcional do usuário: ${input:foco:Opcional — ex.: só autenticação, ou uma entidade específica}

## Regras
1. **Só registre o que verificou no código.** Para cada fato novo, confirme em um arquivo real e anote o caminho. Se não conseguir confirmar, não escreva: coloque em "Dúvidas em aberto" no relatório final.
2. **Não altere código da aplicação.** Você só edita `AGENTS.md`, arquivos em `.github/` (exceto `.github/workflows/`, que você só lê) e, se criar, `docs/ai/`.
3. **Não leia nem copie `.env` ou arquivos com valores reais.** Para variáveis de ambiente, leia só `.env.example` ou o módulo de configuração e registre apenas os **nomes**. Se encontrar segredo no repositório, avise sem reproduzi-lo.
4. **Somente leitura.** Não execute nada além de ler arquivos e buscar. Não rode migration, seed, `prisma` (nenhum subcomando), testes nem acesse banco algum.
5. **Preserve o que já está certo.** Não apague regras existentes: ajuste o que divergir e, quando uma regra parecer errada para este projeto, aponte no relatório em vez de remover em silêncio.
6. **Seja enxuto.** O `AGENTS.md` é carregado em toda conversa: até ~120 linhas. Catálogos e mapas longos vão para uma skill, carregada sob demanda.
7. Escreva em português do Brasil; nomes de arquivos, comandos e identificadores ficam como estão no código.

## Etapa 1 — Inventário (somente leitura)
Monte uma lista de tarefas e levante os itens abaixo, anotando o caminho de cada evidência.

**Estrutura**
- Repositório só da API ou monorepo com o front? Gerenciador de pacotes (lockfile).
- Árvore de pastas até 3 níveis: entidades, rotas, middlewares, configuração, utilitários, integrações (e-mail, storage), testes e `prisma/`.
- Ponto de entrada (montagem do app, ordem dos middlewares) e convenções de nome.

**Stack e versões**
- Versões reais de Node, Express, TypeScript, Prisma, biblioteca de validação usada nos DTOs, logger, biblioteca de planilha, cliente do Resend e framework de teste.
- Scripts exatos do `package.json` (dev, build, start, lint, typecheck, test, prisma).

**Autenticação e segurança**
- Mecanismo de sessão (cookie, JWT, store), flags do cookie, expiração e logout; como `GET /auth/me` funciona.
- Middlewares de autenticação e autorização, perfis existentes e como o escopo por usuário, cliente e espaço de parceiro é aplicado nas consultas.
- Configuração de CORS (origens por ambiente), `helmet`, rate limit, limite de corpo e `trust proxy`.

**Dados**
- Modelos, enums e relações do `schema.prisma`; máquinas de estado (status) existentes; uso de exclusão lógica; tipos usados para dinheiro, duração e datas.
- Migrations: quantidade, convenção de nomes, SQL manual existente (índices parciais, constraints) e se há divergência entre `schema.prisma` e `prisma/migrations/`.
- Como o Prisma se conecta ao Neon (URL com pooler e conexão direta).

**Padrões de código a imitar** — um bom exemplo de cada, com caminho:
- entidade completa (DTO/Service/Controller/rotas); listagem paginada com filtros; mutação com transação; transição de estado; envio de e-mail; teste de rota; teste de serviço.
- Formato de erro, mapeamento de erros do Prisma, geração de `requestId` e padrão de log.

**Operação e deploy**
- `ecosystem.config.*` do PM2 (modo fork ou cluster, `kill_timeout`), health check, encerramento gracioso.
- Workflows em `.github/workflows/`: gatilhos, branches (`dev`, `hom`, `prod`), etapas de deploy e onde roda `prisma migrate deploy`.
- Lista de variáveis de ambiente (só nomes) e o que muda entre hom e prod.

## Etapa 2 — Comparar com os arquivos de contexto atuais
Leia `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/*`, `.github/agents/*` e `.github/skills/*`. Para cada suposição que não bate com o repositório (versão, pasta, biblioteca, comando, convenção, fluxo de deploy), registre: **o que está escrito → o que o código mostra (caminho)**.

## Etapa 3 — Aplicar ajustes
1. **`AGENTS.md`:** stack e versões reais, mapa de pastas (só o essencial), comandos exatos, fluxo de deploy e migrations, e os "exemplos de referência" (um caminho por tipo de padrão). Mantenha princípios e definição de pronto; ajuste o que divergir.
2. **`.github/instructions/*.instructions.md`:** troque os `applyTo` genéricos pelos globs reais (se for monorepo, com o prefixo da pasta da API) e confirme que cada glob casa com arquivos existentes. Substitua orientações genéricas por referências concretas: nomes de middlewares, utilitários, enums e do formato de erro que o projeto já tem.
3. **`.github/agents/*.agent.md`:** corrija o que citar ferramenta, biblioteca ou pasta que não existe aqui. Se o projeto não tiver testes, deixe o `testes-back` propondo a infraestrutura mínima em vez de assumir uma.
4. **Skill `mapa-da-api`:** crie `.github/skills/mapa-da-api/SKILL.md`, com `name` igual ao da pasta e `description` dizendo quando usar. Conteúdo: catálogo de entidades (o que cada uma faz), rotas por entidade, middlewares e ordem, modelos e status do Prisma, códigos de erro, utilitários, integrações e exemplos de referência com caminhos. Se ficar longo, divida em `references/`.
5. Mantenha `.github/copilot-instructions.md` curto e apontando para o `AGENTS.md`.

## Etapa 4 — Verificar
- Frontmatter válido nos arquivos que você tocou; `name` do agente igual ao nome do arquivo; `name` da skill igual ao nome da pasta.
- Todo caminho, comando e glob citado existe de fato (confira por busca ou leitura).
- `AGENTS.md` dentro do limite de tamanho e sem duplicar o que já está nas instruções.

## Entrega final
Responda em português, de forma curta e organizada:
1. **O que mudou**, por arquivo, em uma linha cada.
2. **Divergências encontradas** (antes → depois, com caminho), inclusive qualquer diferença entre `schema.prisma` e as migrations.
3. **Dúvidas em aberto:** até 5 perguntas objetivas sobre o que não dá para inferir do código (regra de negócio, decisão pendente).
4. **Lacunas do projeto** que atrapalham a qualidade (ex.: sem testes, rota sem verificação de escopo, sem formato de erro padrão, sem `requestId`) e o que você sugere, sem implementar.
