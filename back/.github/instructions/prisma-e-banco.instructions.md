---
applyTo: "**/src/schema_db/**,**/src/prisma/**,**/prisma.config.ts,**/src/entities/**/*.ts"
---

# Prisma e PostgreSQL

## Onde fica cada coisa neste repositório
- **Prisma 7.10** com `prisma.config.ts` (carrega `.env.local`/`.env`, `schema: ./src/schema_db`, `migrations.path: ./src/schema_db/migrations`, `datasource.url = DATABASE_URL`). Não existe pasta `prisma/` na raiz.
- Schema **multi-arquivo**: `src/schema_db/*.prisma` (um por domínio: `lancamentos.prisma`, `projetos.prisma`…). Generator `prisma-client-js`, import de `@prisma/client`.
- Migrations em `src/schema_db/migrations/` (baseline `00000000000000_baseline` + incrementais). Há `migration_lock.toml` em `src/schema_db/` e em `src/schema_db/migrations/`.
- Cliente único em `src/prisma/index.ts` com `PrismaNeon` (adapter) e `DATABASE_URL`; `$disconnect()` em `src/server.ts`.
- Comandos seguros localmente: `npx prisma validate`, `npx prisma generate`, `npx prisma migrate dev --create-only --name <nome>` (só com banco local). Nunca contra hom/prod.

## Como está hoje (convenções reais)
- Modelos em minúsculas (`lancamento`, `empresaUsuarios`), campos snake_case, `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`, `criado_em` e `is_active` (desativação lógica). **Não há `createdAt`/`updatedAt` nem `deletedAt`** — modelo novo segue a regra abaixo só se o time decidir; ao estender modelo existente, siga o padrão dele.
- Horas e dinheiro são `Float` (`duracao_total`, `horas_previstas`, `horas_gastas`, `despesa.valor`); `lancamento.hora_inicio`/`hora_fim` são `@db.Time`. Mudar para `Int`/`Decimal` é migration com plano (expandir → migrar → contrair) e impacto no front.
- `projeto.horas_gastas`/`atividade.horas_gastas` são desnormalizados e atualizados por `recalcularHorasGastas` (`src/lib/utils.ts`, `increment`), que exige o `tx` (`Prisma.TransactionClient`) e roda **dentro** da mesma transação que grava, edita ou apaga o lançamento. A origem do lançamento (atividade ativa, no escopo da empresa ou de parceria ativa, projeto/cliente coerentes) também é validada dentro da transação (`validarOrigemLancamento` em `lancamentos.service.ts`).
- Não há `CHECK`, índice parcial nem exclusion constraint nas migrations, embora `lancamentos.prisma` tenha comentário citando checks.
- `DATABASE_URL` é a única URL; o `prisma.config.ts` não define URL direta para migrations.
- Exemplos: transação em `src/entities/empresas/empresas.service.ts` (`create`), `src/entities/auth/auth.service.ts` (`refreshToken`) e `src/entities/lancamentos/lancamentos.service.ts` (`create`/`update`/`remove`); agregação no banco em `src/entities/lancamentos/lancamentos.service.ts`; erro Prisma mapeado ad hoc em `src/entities/projetos/projetos.service.ts` (`remove`) — não há mapeamento central (o `errorMiddleware` global devolve 500 genérico para erros do Prisma não tratados).

## Schema
- Todo modelo tem `createdAt` e `updatedAt`. `DateTime` é UTC; data de calendário usa `@db.Date`. Duração em `Int` (minutos). Dinheiro em `Decimal` (`@db.Decimal(12, 2)`) ou `Int` em centavos — nunca `Float`.
- A integridade fica no banco: `@unique`/`@@unique` para unicidade, enums para status, campos obrigatórios por padrão, `onDelete` sempre explícito (`Restrict` para dados financeiros; `Cascade` só quando o filho não existe sem o pai).
- Índices para toda coluna de filtro ou ordenação frequente e para FKs usadas em join, em ordem composta: igualdade primeiro, depois intervalo ou ordenação (`@@index([userId, date])`). Confirme consultas pesadas com `EXPLAIN`.
- Dados financeiros e auditáveis usam exclusão lógica (`deletedAt`) em vez de apagar; lembre de filtrar em toda consulta e de que `@unique` convive mal com exclusão lógica (use índice único parcial).
- Regras que o schema do Prisma não expressa (índice único parcial, constraint de exclusão para sobreposição de períodos, `CHECK`) vão em migration SQL manual, comentadas no próprio arquivo e no schema. Depois, confira se a próxima `migrate dev` não tenta removê-las.

## Migrations
- **Nunca edite migration já aplicada**; mudou, é migration nova com nome descritivo (`add_expense_receipt_key`).
- O deploy roda `prisma migrate deploy`, que só aplica o que está em `src/schema_db/migrations/`. `db push` é só para banco local descartável e **não gera migration**: use `migrate dev --create-only` e revise o SQL antes de commitar.
- Compatível com a versão anterior do app durante o deploy: **expandir → migrar → contrair**. Coluna nova entra nullable ou com default; backfill separado; `NOT NULL` só depois. Remover coluna só quando nenhum código a lê. Renomear no Prisma vira drop + create (perde dados): faça adicionar nova → copiar → remover antiga.
- Operações perigosas (drop, mudança de tipo, `NOT NULL` em tabela cheia, índice em tabela grande) pedem plano: bloqueios, volume, janela, rollback. Em tabela grande, crie índice com `CREATE INDEX CONCURRENTLY` (migration SQL manual, fora de transação).
- Antes de produção: valide em homologação e tenha ponto de restauração. O Neon permite criar um branch do banco para ensaiar a migration.
- No deploy (`.github/workflows/deploy.yaml`) a migration roda **antes** do `npm run build` e do restart do PM2: o código antigo roda alguns instantes contra o schema novo. Por isso expandir → migrar → contrair é obrigatório aqui.
- Ao alterar `src/schema_db/*.prisma`, confira se a migration correspondente existe na mesma branch; schema sem migration nunca chega a hom/prod.
- Conexão com o Neon: a aplicação usa a URL com pooler; `migrate` deveria usar a conexão direta (no Prisma 7, via `prisma.config.ts`). **Hoje o projeto só tem `DATABASE_URL`, e o `migrate deploy` dos servidores roda pela URL com pooler** (confirmado pelo time). Não altere isso sem combinar. Se uma migration falhar com erro de advisory lock, prepared statement ou timeout, a causa provável é o pooler; a correção é configurar uma URL direta no `prisma.config.ts`. Depois que a compute do Neon suspende, a primeira consulta demora: configure timeouts e retry sem derrubar a requisição.

## Consultas
- Uma única instância de `PrismaClient` por processo; `$disconnect()` no encerramento.
- `select` só dos campos necessários e `include` só quando precisa. Sem query dentro de loop (N+1): use `include`, `in`, `groupBy` ou `aggregate`. Somas e contagens (total de horas) são feitas no banco, nunca carregando linhas para somar em JS.
- **Transações:** `$transaction([...])` para escritas independentes em lote; transação interativa (`$transaction(async (tx) => ...)`) quando há ler → decidir → escrever. Dentro dela, use `tx` (não `prisma`) e mantenha curta: sem HTTP, sem e-mail.
- Transição de estado atômica: `updateMany({ where: { id, status: 'ESPERADO' }, data })` e confira `count === 1`; evita que dois aprovadores atuem ao mesmo tempo.
- Contadores e saldos com `increment`/`decrement`, não ler-somar-gravar.
- Relações N:N: `set` **substitui** a lista inteira; `connect`/`disconnect` altera de forma incremental. Escolha conforme o contrato (substituir ou alterar) e teste os dois casos (lista vazia inclusive).
- Mapeie os erros do Prisma em **um só lugar**: `P2002` (unicidade) → `409`, `P2025` (não encontrado) → `404`, `P2003` (chave estrangeira) → `409`.
- Paginação por cursor com ordenação estável (inclua `id` como desempate); `skip` grande é lento.
- Seeds só para dev e teste, idempotentes e sem dados reais.
