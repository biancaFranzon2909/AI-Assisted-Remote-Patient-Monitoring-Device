# PERF-REPORT — API ChronoTracker (auditoria de carga, 03/11/2026)

> Números relativos: k6, API e coletor rodaram na mesma máquina, e o banco é remoto (Neon, us-east-2). Toda evidência citada está em `loadtest/results/` (pasta ignorada pelo Git). Itens sem medição direta estão marcados como **hipótese**.

## 1. Resumo executivo (5 melhorias de maior ganho)
1. **Aumentar o pool do adapter Neon** (hoje `max=10`, o padrão): em 10 ações/s, p95 caiu de **9.131 ms para 2.046 ms**, e as iterações descartadas de **156 para 0** (validado, P1).
2. **Reduzir as idas e voltas ao banco por requisição**: cada consulta custa cerca de **155 ms de rede** (p50), mesmo quando o banco a executa em menos de 1 ms. O auth faz 2 consultas, e o dashboard faz 16 por requisição (C1, C2, Q3).
3. **Enxugar e paginar `/dashboard/stats`**: **1,22 MB** por resposta (todos os 2.760 lançamentos da empresa, sem filtro de período) e p95 de 3,3 s no smoke (DTO1).
4. **Paginar `/atividades/list` e `/projetos/list/:id`**: o payload cresceu de ~3,5 KB para **~150 KB** e de ~3 KB para **~123 KB** à medida que o teste inseriu 3.122 atividades (DTO2).
5. **Criar os índices de FK** `despesa(lancamento_id)`, `lancamento(atividade_id)` e `atividade(projeto_id)`: execução no banco de 6 a 77 ms caiu para 0,05 a 13 ms. O ganho fim a fim hoje é pequeno (cerca de 1 a 6% no p50), porque a rede domina (validado, B1).

## 2. Ambiente e metodologia
- **Máquina**: AMD Ryzen 7 5700 (8C/16T), 47,8 GB de RAM e Windows 11 Pro 10.0.26300. Versões: Node v24.20.0, k6 v2.3.0, Prisma/@prisma/client 7.10.1 com `@prisma/adapter-neon` e PostgreSQL 18.6.
- **Banco**: `*.neon.tech` (endpoint *pooled*, us-east-2), remoto em relação à máquina de teste.
  - Tamanho: 50 MB no início, 91 MB após o seed e 92,4 MB no fim (`pg_database_size`), sempre abaixo do limite de 350 MB.
- **API**: `node dist/src/server.js` com `NODE_ENV=production`, `PORT=3005` e `PERF_DEBUG=1`, a partir da branch `perf/instrumentation` (sem hot reload).
  - O rate limiter não foi desativado: ele só atua nas rotas de auth, e a jornada faz login uma única vez no `setup()`.
  - `ulimit -n` não se aplica ao Windows.
- **Instrumentação** (`PERF_DEBUG=1`, só nas branches `perf/*`, sem commit; código salvo em `loadtest/results/audit/perf.ts.saved` e `prisma-index.ts.saved`):
  - consultas Prisma agregadas (contagem, média e p50/p95/p99);
  - por rota: latência, consultas por requisição (AsyncLocalStorage) e bytes;
  - event loop delay, GC, heap e CPU;
  - pool `neon.Pool` (ativas, ociosas, em espera e espera no `connect`);
  - perfil de CPU via inspector.
- **Coleta a cada 5 s** (`tools/collector.cjs` → `audit/collector.jsonl`): CPU e memória da API, event loop e pool, `pg_stat_activity`, `pg_locks` e consultas acima de 500 ms.
- **Por fase**: `pg_stat_statements` (extensão criada com `CREATE EXTENSION IF NOT EXISTS`) com snapshot e reset; snapshot de `/__perf` com reset; contagem das escritas.
- **Volume de dados**:
  - Inicial: lancamento 114.794, atividade 6.972, despesa 9.291, projeto 490, parceiro 200, usuario 90 e empresa 30.
  - Seed sintético idempotente (`tools/seed-sintetico.sql`, só INSERT, marcado `SYN-PERF`, fora do workspace de teste): **+93.000 atividades e +91.000 despesas**, seguido de ANALYZE.
- **Jornada**: workspace `montenegro-erp-consultoria` (perfil OWNER), executor arrival-rate e think time de 1 a 3 s.
  - Mix 60% leitura / 30% escrita / 10% pesado.
  - Endpoints: `/projetos/list/:id`, `/clientes/list/:id`, `/atividades/list[/:id]`, `/lancamentos/list`, `/dashboard/stats` e `POST /atividades/create`.
  - "Ação" = 1 iteração (cerca de 1,05 a 1,2 requisições HTTP).
- **Janela**: de 15:35 a 16:30 BRT (cerca de 55 min de atividade no banco remoto, dos quais cerca de 35 min de carga). Soak não foi executado.
- **Desvios de procedimento**, todos registrados em `audit/timeline.txt`:
  1. O snapshot do `pg_stat_statements` do smoke se perdeu por um BOM no arquivo SQL; o reset foi feito.
  2. O cooldown entre load e stress foi de cerca de 45 s, e não de 2 min.
  3. Os estágios do stress tiveram **120 s**, e não 5 min, para respeitar o limite de cerca de 60 min do host remoto.
  4. O spike e o explore foram abortados pela regra de erro acima de 20%.

## 3. Resultados por fase
SLO derivado do smoke: **X = 2 × 2.278 ms ≈ 4.556 ms (p95)** e **Y = 1% de erro**. Todas as falhas HTTP foram **timeouts de 10 s do k6** (status 0). Não houve 4xx/5xx, e o stderr da API ficou vazio.

| Fase | Carga (ações/s) | Req. HTTP | RPS | p50 | p95 | p99 | Erro | CPU API média/máx. | RSS máx. | Pool em espera (máx.) |
|---|---|---|---|---|---|---|---|---|---|---|
| smoke | 1 | 72 | 0,99 | 959 | 2.278* | 2.957* | 0% | 3,3 / 8,1% | 150 MB | 0 |
| explore | 1→16 (abortado) | 763 | 5,4 | 1.618 | 9.654 | 10.000 | 4,3% | 8,1 / 13,7% | 246 MB | 119 |
| load (N=4) | 4 | 1.145 | 3,7 | 968 | 2.671 | 6.434 | 0% (21 descartadas) | 5,4 / 10,9% | 251 MB | 18 |
| stress 100% (4) | 4 | 479 ações | — | 953 | 2.069 | 2.213 | 0% | 7,1% | 260 MB | 0 |
| stress 150% (6) | 6 | 720 ações | — | 990 | 3.275 | 5.293 | 0% | 8,7% | 263 MB | 33 |
| stress 200% (8) | 8 | 959 ações | — | 2.011 | **5.208** | 6.916 | 0% | 12% | 270 MB | 33 |
| stress 300% (12) | 12 (atingiu ~8,4) | 1.002 ações | — | 6.470 | 10.000 | 10.001 | **10,2%** | 9,3% | 378 MB | 71 |
| spike (4→40) | baseline 4, depois pico | 375 | 4,2 | 1.329 | 10.000 | 10.000 | 14,7% (pico 44%) | 6,8 / 14,4% | 237 MB | **276** |
| breakpoint (4→24) | parou em 7→11 | 695 | 5,8 | 1.226 | 3.988 | 6.201 | 0% | 8,8 / 14,4% | 333 MB | 40 |

\* No smoke, valores de `scope:journey`. Fontes: `results/*-summary.json`, `audit/k6-*.log` e `audit/collector.jsonl` (agregados com `tools/colagg.cjs`).

- **Heap entre fases**: a mediana ficou em 50 a 57 MB em todas as fases, com picos de 150 a 170 MB nos momentos de fila (stress 300% e pool 25), que voltaram ao normal depois. **Não há indício de vazamento.**
- **Event loop**: o p99 ficou em 16 a 24 ms, perto da base de cerca de 15,6 ms da resolução de timer do Windows. O máximo chegou a ~91 ms, em picos isolados.
- **Banco**: nenhuma consulta acima de 500 ms em `pg_stat_activity` e nenhum lock não concedido em nenhuma amostra.

## 4. Joelho da curva
- **SLO violado entre 7 e 8 ações/s** (cerca de 8 a 9 req/s).
  - Explore: `ramp_1_6` com p95 de 2.095 ms e 0% de erro; `ramp_6_11` com p95 de 9.723 ms e 4,1% de erro.
  - Breakpoint: o SLO foi cruzado em `ramp_7_11` (p95 4.720 ms).
  - Stress: 200% (8/s) com p95 de 5.208 ms.
  - A vazão máxima sustentada foi de cerca de **8,3 ações/s**: stress 300% entregou 1.002 ações em 120 s, e o teste em 10/s com pool 10 entregou 744 em 90 s.
- **Recurso que saturou primeiro: o pool de conexões do adapter Neon (`max=10`)**.
  - Explore, às 18:44:34Z: `active=10`, depois `waiting` 1 → 133.
  - Spike: `waiting` chegou a 276.
  - Enquanto isso, a CPU da API ficou **abaixo de 16%**, e o perfil de CPU de 60 s no stress a 200% mostrou **92,1% de idle** (`audit/perf-1793732534932.cpuprofile`).
  - O banco não saturou: execução de 0,1 a 77 ms por consulta (seção 5A) e no máximo 8 backends ativos.
- **Mecanismo**: cada consulta segura uma conexão por cerca de 155 ms de ida e volta de rede. Com 10 conexões, o teto é de cerca de 64 consultas/s. A jornada média usa cerca de 7 a 8 consultas por ação, o que dá cerca de 8 ações/s, compatível com o medido.
- **Carga normal escolhida**: **N = 4 ações/s**, 50% do joelho de cerca de 8.

## 5. Achados

### Banco/Índices

**B1. FKs sem índice usadas nos filtros e joins mais caros** | Severidade: média | Status: **confirmado**
- Evidência:
  - `audit/fk-sem-indice.tsv`: 16 FKs sem índice, entre elas `despesa.lancamento_id`, `lancamento.atividade_id`, `lancamento.usuario_id`, `lancamento.projeto_id`, `lancamento.cliente_id`, `atividade.projeto_id`, `atividade.empresa_id`, `projeto.empresa_id`, `projeto.parceiro_id`, `administrativo.empresaId`/`usuarioId` e `token.usuario_id`.
  - `audit/seq-scans.json`: lancamento com 9.146 seq scans e 451 milhões de tuplas lidas; atividade com 311 milhões; despesa com 2.241 seq scans e `idx_scan=0`.
  - Top 1 do `pg_stat_statements` (`audit/pgss-top10-total.json`): soma de despesas do `clientes.findById`, com 779 chamadas, 41,4 s no total, 53 ms em média e **28.724 buffers por chamada**.
  - EXPLAIN (`audit/explain-antes.txt`): `Parallel Seq Scan on despesa` mais `Parallel Seq Scan on lancamento`.
- Causa: o schema não declara `@@index` nessas FKs (o Postgres não cria índice para FK automaticamente).
- Correção (migration versionada, nunca `db push` em hom/prod):
  ```sql
  CREATE INDEX CONCURRENTLY idx_despesa_lancamento_id ON despesa (lancamento_id);
  CREATE INDEX CONCURRENTLY idx_lancamento_atividade_id ON lancamento (atividade_id);
  CREATE INDEX CONCURRENTLY idx_atividade_projeto_id ON atividade (projeto_id);
  -- avaliar: lancamento (usuario_id, data_lancamento), projeto (empresa_id), atividade (empresa_id)
  ```
  ```prisma
  model despesa    { @@index([lancamento_id]) }
  model lancamento { @@index([atividade_id]) }
  model atividade  { @@index([projeto_id]) }
  ```
- Ganho medido (seção 6):
  - Execução no banco: 77 → 12,7 ms, 26 → 0,77 ms, 25 → 0,70 ms, 8,2 → 0,39 ms, 6,8 → 0,39 ms e 5,9 → 0,05 ms.
  - Fim a fim: p50 de `/clientes/list/:id` de 1.000 → 942 ms, `/lancamentos/list` de 1.319 → 1.255 ms e p95 global de 2.046 → 2.020 ms.
  - Com o banco próximo da API, o ganho relativo deve ser maior (**hipótese**).
- Esforço: P. Risco: baixo; use `CONCURRENTLY` em produção.
- Custo colateral: escrita um pouco mais lenta e cerca de 2 a 4 MB de índice por tabela de cerca de 100 mil linhas.
- Validar com `EXPLAIN (ANALYZE, BUFFERS)` (procurar `Index Scan using idx_...`) e com `pg_stat_statements` (`shared_blks_hit` por chamada).

**B2. Índices não usados ou redundantes** | Severidade: baixa | Status: **confirmado (uso) / hipótese (custo)**
- Evidência (`audit/indices-sem-uso.json`): `idx_scan=0` em `usuario.idx_usuario_nome_usuario`, que repete a unique `usuario_nome_usuario_key`, e em `parceiro.idx_nome_cnpj_id`, além de várias uniques em tabelas pequenas.
- Correção: remover `idx_usuario_nome_usuario` por migration, porque a unique já atende à consulta. Manter as uniques, que garantem integridade.
- Ganho: escrita um pouco mais barata em `usuario`, provavelmente desprezível (**hipótese**). Esforço: P.

### Queries

**Q1. Consultas inúteis com `IN (NULL)`** | Severidade: média | Status: **confirmado (existência) / hipótese (origem)**
- Evidência (`audit/perf-load-162627.json`, 90 s a 10 ações/s): cerca de 1.060 consultas `SELECT … WHERE "id" IN (NULL)` em parceiro, projeto, empresa, atividade e usuario. Cada uma custou cerca de 155 ms de rede (p50) e não pode devolver linha nenhuma.
- Causa provável: carregamento de relações (`include`/`select` aninhado) sobre FKs nulas, como `lancamento.cliente_id` e `lancamento.projeto_id`, em que o Prisma ainda emite a consulta.
- Correção: buscar só as relações necessárias, ou condicionar o `include` (filtrar `cliente_id: { not: null }`, ou carregar a relação só quando houver ids).
- Ganho: 155 ms e uma conexão do pool por consulta evitada. Esforço: P/M.
- Validar com `/__perf` (consultas `IN (NULL)` = 0).

**Q2. `lancamentos.find`: duas consultas com o mesmo filtro e sem paginação** | Severidade: média | Status: **confirmado**
- Evidência: `src/entities/lancamentos/lancamentos.service.ts:166` (`findMany`), `:195` (`take` comentado) e `:200` (`aggregate`).
  - pgss #2 e #3: 797 chamadas cada, cerca de 28 ms, com `Parallel Seq Scan on atividade` + `lancamento`.
  - A rota faz 9 consultas por requisição, com p50 de 1.255 ms.
- Correção: reativar `take`/cursor (`cursor: { id }`, `orderBy: [{ data_lancamento: 'desc' }, { id: 'desc' }]`) e calcular a soma no mesmo round-trip (`$queryRaw` com `SUM(...) OVER ()` ou `Promise.all` em paralelo).
- Esforço: M. Risco: muda o contrato (paginação), então alinhar com o front.

**Q3. `projetos.find`: N+1** | Severidade: média | Status: **confirmado (código) / hipótese (impacto, rota fora da jornada)**
- Evidência: `src/entities/projetos/projetos.service.ts:116-122`. `findNomeParceiroEspacoAtual(parceria.empresa_id)` é aguardada **dentro do loop** sobre parcerias e projetos.
- Correção: buscar os nomes de uma vez (`findMany({ where: { empresa_id: { in: ids } } })`) e montar um `Map`.
- Ganho: (n−1) × ~155 ms por requisição. Esforço: P.

### Código

**C1. Auth: 2 consultas sequenciais em toda requisição** | Severidade: alta | Status: **confirmado**
- Evidência: `src/middlewares/auth.ts:94` (`empresa.findUnique` por identificador) e `:102` (`empresaUsuarios.findUnique`), uma depois da outra.
  - No `/__perf` da fase load, foram as consultas mais frequentes: 1.190 + 1.165 chamadas, p50 de 155,8 / 159,9 ms e p95 de 1.489 / 1.049 ms (com fila no pool).
  - Custo mínimo de cerca de 310 ms por requisição autenticada antes do controller.
- Correção: uma consulta só, com cache curto em memória (TTL de 30 a 60 s, 1 processo) para `identificador → empresa_id`:
  ```ts
  const membership = await prisma.empresaUsuarios.findFirst({
    where: { usuario_id: userId, empresa: { identificador: workspaceId } },
    select: { empresa_id: true, cargo: true },
  });
  ```
- Ganho: cerca de 155 ms por requisição e uma conexão a menos (**hipótese** quantitativa, a partir do RTT medido). Esforço: P. Risco: baixo; o cache invalida ao remover membro.

**C2. Dashboard repete o vínculo e a empresa já resolvidos pelo middleware** | Severidade: média | Status: **confirmado**
- Evidência: `src/entities/dashboard/dashboard.service.ts:17` e `:28`, dois `findUnique` sequenciais antes do `Promise.all` (linhas 42, 55, 73 e 116). Total de **16 consultas por requisição** (`/__perf`).
- Correção: o middleware passa a pôr `cargo` em `req.user`, e o service o reutiliza.
- Ganho: cerca de 310 ms por chamada (2 RTT). Esforço: P.

**C3. `console.log(id)` em `projetos.findById`** | Severidade: baixa | Status: **confirmado (código)**
- Evidência: `src/entities/projetos/projetos.service.ts:147`.
- Correção: remover a linha. Ganho pequeno; a CPU não foi gargalo (92% idle no perfil). Esforço: P.

**C4. Requisições abandonadas continuam ocupando o pool** | Severidade: média | Status: **confirmado**
- Evidência: o k6 abortou o spike às 19:08:47Z, mas a fila do pool (276) só zerou às 19:09:16Z, cerca de 30 s depois (`audit/collector.jsonl`).
- Correção: timeout de requisição no servidor (por exemplo, `server.requestTimeout` e `headersTimeout`) e checar `req.socket.destroyed` antes de consultas caras.
- Esforço: M. **Hipótese** de ganho: recuperação mais rápida depois de picos.

### DTOs e payloads

**DTO1. `/dashboard/stats` devolve 1,22 MB** | Severidade: alta | Status: **confirmado**
- Evidência:
  - `resp_bytes{name:GET /dashboard/stats}` = 1.219.570 bytes em todas as amostras.
  - A consulta `lancamento.findMany` (`dashboard.service.ts:73`) não tem filtro de período: pgss #4 traz **2.760 linhas por chamada** e 20.255 buffers.
  - p95 de 3.282 ms no smoke, 16 consultas.
  - O stress inteiro transferiu 404 MB do servidor para o cliente.
- Correção: aceitar `from`/`to` (por exemplo, padrão de 30 dias) e agregar no banco (`groupBy` por dia, usuário e projeto) em vez de devolver cada lançamento; remover `descricao`/`despesas` aninhadas do card principal.
  ```ts
  prisma.lancamento.groupBy({
    by: ['usuario_id', 'data_lancamento'],
    where: { atividade: { empresa_id: empresaId }, data_lancamento: { gte: from, lt: to } },
    _sum: { duracao_total: true },
  });
  ```
- Ganho: redução proporcional ao período (**hipótese**: dezenas de vezes em bytes). Esforço: M. Risco: contrato com o front.

**DTO2. Listagens sem paginação crescem com os dados** | Severidade: alta | Status: **confirmado**
- Evidência: com a inserção de 3.122 atividades `LT` durante os testes, `resp_bytes` médio passou de:
  - `/atividades/list`: **3.552 → 150.837 bytes**;
  - `/projetos/list/:id`: **3.014 → 123.213 bytes**;
  - `/atividades/list/:id`: p50 de 1.708 ms, com 9 a 11 consultas.
- Correção: `take`/cursor (máximo de 100), `select` só com os campos exibidos e total separado e opcional. Esforço: M.

### Configuração

**CFG1. Pool `neon.Pool` com `max=10` (padrão)** | Severidade: **alta** | Status: **confirmado e validado**
- Evidência: seção 4 e seção 6. `connection_limit`/`pool_timeout` da URL não se aplicam ao `@prisma/adapter-neon`; o pool vem do `PrismaNeon({ connectionString, max })`.
- Correção (`src/prisma/index.ts`):
  ```ts
  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
    max: Number(env.DB_POOL_MAX ?? 25),
  });
  ```
- Custo colateral: mais conexões no pooler do Neon, que suporta muitas; acompanhar o compute.
- Esforço: P. Risco: baixo.

**CFG2. Latência de rede até o banco (~155 ms por consulta)** | Severidade: alta | Status: **confirmado no ambiente de teste**
- Evidência:
  - p50 de cerca de 155 ms para consultas triviais por PK (`/__perf`; mediana das medianas de 155,4 ms).
  - No `pg_stat_statements`, o INSERT de atividade executa em **0,1 ms**, contra p50 de 157 ms no Prisma.
- Nos servidores de hom/prod, a latência depende da região: **hipótese**, medir lá.
- Correção: colocar a API na mesma região do Neon (us-east-2) e manter o endpoint pooled, que já é usado.

**CFG3. Cold start** | Status: **observado**
- Primeira requisição do smoke: login com 1.103 ms e 3 consultas, contra p50 de cerca de 630 ms nas requisições seguintes. O cold start foi descartado do cálculo do SLO.

## 6. Resultado da validação (3 achados de maior impacto)
Mesma jornada nas três medições, `load` com 30 s de rampa + 90 s a 10 ações/s (`audit/k6-load-161955.log`, `162309` e `162627`).

| Achado | Antes | Depois | Resultado |
|---|---|---|---|
| CFG1 pool 10 → 25 (branch `perf/validation`, `PERF_POOL_MAX`) | p95 **9.131 ms**, p50 4.723, 744 ações/90 s, 156 descartadas, pool `waiting` médio 34 (máx. 48) | p95 **2.046 ms**, p50 958, 900 ações/90 s, 0 descartadas, `waiting` 0, `active` máx. 17 | **Ganho grande, confirmado** |
| B1 índices de FK (`perf_tmp_*`, SQL direto) | EXPLAIN: 77 / 26 / 25 / 37 / 8,2 / 6,8 / 5,9 ms. p95 2.046; `/clientes/list/:id` p50 1.000; `/lancamentos/list` p50 1.319 | EXPLAIN: 12,7 / 0,77 / 0,70 / 33,4 / 0,39 / 0,39 / 0,05 ms. p95 2.020; clientes p50 942; lançamentos p50 1.255 | Ganho grande no banco e **pequeno fim a fim** (−1 a −6%), porque a rede domina |
| CFG2/C1 custo por consulta (RTT) | Medição sem alteração de código: p50 por consulta de ~155 ms; INSERT 0,1 ms no banco contra 157 ms no Prisma; latência das rotas ≈ consultas sequenciais × 155 ms (create: 4 consultas, 631 ms) | Correção não aplicada (exige mudar o middleware/contrato) | **Causa confirmada**; ganho da correção = **hipótese** (cerca de 155 ms por consulta evitada) |

Os índices `perf_tmp_*` foram removidos com `DROP INDEX` às 16:29 (`audit/ddl-log.txt`; `pg_indexes` confirma 0 restantes).

## 7. Roadmap (impacto × esforço)
1. CFG1 pool `max` configurável (alto / P)
2. C1 auth em uma consulta, com cache (alto / P)
3. C2 reaproveitar o cargo no dashboard (médio / P)
4. B1 migration com índices de FK (médio / P)
5. Q1 eliminar `IN (NULL)` (médio / P-M)
6. DTO1 dashboard com período e agregação (alto / M)
7. DTO2 e Q2 paginação de listas e lançamentos (alto / M, coordenar com o front)
8. Q3 N+1 em projetos (médio / P)
9. C4 timeouts no servidor (médio / M)
10. CFG2 colocar a API na mesma região do banco (alto / depende de infra)
11. B2 e C3 limpeza (baixo / P)

## 8. Hipóteses não confirmadas e como confirmar
- Ganho fim a fim de C1, C2 e Q1: implementar em branch, repetir `load` a 10 ações/s e comparar p95 e `queriesPorReq` no `/__perf`.
- Latência de rede em hom/prod: medir `/__perf` (p50 de consulta trivial) no servidor real.
- Origem exata das consultas `IN (NULL)`: ativar o log por rota (`PERF_DEBUG`) e mapear consulta → rota.
- Custo de escrita dos índices redundantes: medir `INSERT` em `usuario` com e sem o índice (irrelevante no volume atual).
- Consumo no Neon (**estimativa**): cerca de 55 min de compute ativo (15:35 a 16:30 BRT; tamanho da CU não consultado). A rede foi cerca de 1,3 GB da API para o k6 em localhost; o tráfego banco → API deve ser da mesma ordem, com 1 GB ou mais, dominado pelo dashboard (**hipótese**; confirmar no painel do Neon).
- Entrada `CREATE DATABASE "prisma_migrate_shadow_db_…"` no `pg_stat_statements` durante o explore: origem externa a esta auditoria (ver seção 9). Nenhuma migration nova foi registrada em `_prisma_migrations` (última às 12:50Z).

## 9. Dados criados e como reexecutar
**Linhas** (`audit/rowcounts_inicial.json`, `rowcounts_pos_seed.json`, `rowcounts_final.json`):

| Tabela | Inicial | Final | Origem |
|---|---|---|---|
| atividade | 6.972 | 103.094 | +93.000 `SYN-PERF` (seed) e +3.122 `LT %` (jornada, POST `/atividades/create`) |
| despesa | 9.291 | 100.291 | +91.000 `SYN-PERF` (seed) |
| token | 7.735 | 7.745 | +10 (logins no `setup()`) |
| lancamento, projeto, parceiro, usuario, empresa, administrativo | — | sem mudança | — |

Nenhum DELETE, TRUNCATE ou DROP de dados ou tabelas. DDL executado (`audit/ddl-log.txt`):
- `CREATE EXTENSION pg_stat_statements`;
- `CREATE INDEX` com `ANALYZE` e depois `DROP INDEX` dos 3 `perf_tmp_*`;
- `ANALYZE` após o seed.

**Atenção: alterações externas na árvore.** Ao voltar para `teste-carga`, `git status` mostra alterações que **esta auditoria não fez** e que foram **mantidas intactas**:
- `src/schema_db/parceiro.prisma` (modificado às 15:42);
- nova migration `src/schema_db/migrations/20261103184426_tamanho_razao_fantasia/` (15:44);
- edição da migration **já aplicada** `20261029163806_fix_parceiro/migration.sql` (16:00).

Isso coincide com o `CREATE DATABASE prisma_migrate_shadow_db_*` visto no banco: alguém rodou `prisma migrate dev` em paralelo. Revise antes de qualquer commit, porque editar migration aplicada viola o AGENTS.md.

**Reexecutar** (PowerShell, na raiz do repo):
1. `git switch perf/instrumentation` e restaurar `src/lib/perf.ts` e os trechos de `src/prisma/index.ts` e `src/config/app.ts` a partir de `loadtest/results/audit/*.saved`.
2. `npm run build`.
3. Subir a API com `NODE_ENV=production PORT=3005 PERF_DEBUG=1 PERF_OUT_DIR=<pasta> node dist/src/server.js` (opcional: `PERF_POOL_MAX=25`).
4. `node loadtest/teste_carga/tools/collector.cjs loadtest/results/audit/collector.jsonl` em background.
5. `powershell -File loadtest/teste_carga/tools/run-phase.ps1 -Profile <smoke|explore|load|stress|spike|breakpoint> -ExtraJson '{"N_RATE":"4","SLO_P95_MS":"4556"}'`.
   - O script lê `SEED_SENHA` do `.env` sem imprimir e salva `k6-*.log`, `perf-*.json`, `pgss-*.json` e `escritas.jsonl` em `loadtest/results/audit/`.
6. Índices de validação: aplicar o SQL de B1 por SQL direto, medir e depois `DROP INDEX`.

Os scripts do harness ficam em `loadtest/teste_carga/` (ignorado pelo Git; originais em `common/*.orig`). O seed está em `loadtest/teste_carga/tools/seed-sintetico.sql`.