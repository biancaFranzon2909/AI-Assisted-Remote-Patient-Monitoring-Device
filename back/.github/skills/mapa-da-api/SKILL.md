---
name: mapa-da-api
description: Mapa do back-end real do ChronoTracker — entidades e rotas, middlewares e ordem, modelos/enums do Prisma, formato de erro, utilitários, integrações e exemplos de referência com caminhos. Use antes de criar ou alterar endpoint, consulta, schema ou regra de autorização, para saber onde as coisas ficam e qual padrão imitar.
---

# Mapa da API do ChronoTracker

Levantado do código em `src/`. Se algo aqui divergir do código, o código vence: corrija este arquivo.

## Montagem do app (`src/config/app.ts`, ordem real)
1. `app.set("trust proxy", true)` (permissivo; aguardando informação de infraestrutura)
2. `helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })`
3. `requestIdMiddleware` (`src/middlewares/requestId.ts`): `req.requestId` + header `X-Request-Id` (reaproveita o do cliente se seguro, senão UUID).
4. `cors` com lista fixa de origens (localhost:5173/5174, IPs da rede interna, `chronotracker.sinosbyte.com.br`, `chrono-hml.sinosbyte.com.br`), `credentials: true`, headers `Content-Type`, `Authorization`, `x-workspace-id`.
5. `cookie-parser`
6. Só em `/api/*`: copia `Authorization: Bearer <token>` para `req.cookies._tk` (uso por integração externa com a API key).
7. Rate limit por rota (`src/middlewares/rateLimit.ts`, `express-rate-limit`, store em memória — vale para 1 processo; 429 `{ error: true, message }`): `POST /auth/login` 10/15 min (só falhas), `/auth/register` 10/h, `/auth/password-reset` 5/15 min, `/auth/password-reset-verify` 10/15 min, `/auth/refresh-token` 120/15 min, todos por IP.
8. `express.json({ limit: "1mb" })`
9. `authMiddleware` global (`src/middlewares/auth.ts`). `verifyRole` existe mas está comentado (não usado).
10. `router` único (`src/router/index.ts`). `POST /convite/create` tem `conviteLimiter` na própria rota (30/h por `usuario_id`, depois do `authMiddleware`).
11. `notFoundMiddleware`: rota inexistente → 404 `{ error: true, message: "Rota não encontrada." }` (sem login, o `authMiddleware` responde antes).
12. `errorMiddleware` (`src/middlewares/errorMiddleware.ts`): `AppError` com o próprio status/mensagem; JSON malformado 400; corpo > 1mb 413; outros 4xx genérico; resto 500 `"Erro interno."`. Log com `requestId` e só `name`/`code`/`message`/`stack`.

Não há logger estruturado. `src/server.ts` faz `prisma.$connect()`, `listen(PORT)` (erro no `listen` → encerra com código 1), encerramento em `SIGINT`/`SIGTERM` (`server.close` → `prisma.$disconnect()`, tempo limite 10 s) e trata `unhandledRejection`/`uncaughtException` (loga e encerra com código 1).

## Autenticação (`src/middlewares/auth.ts`)
- Rotas públicas: `pathsToIgnore` (`/auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/register`, `/auth/password-reset`, `/auth/password-reset-verify`, `/health`) e `testBypassPathsWithRegex` (`GET /convite/aceite/:token` e `GET /auth/password-reset-verify/:a/:b`, este sem rota correspondente no router). O path é normalizado (sem barra final, minúsculo) antes da comparação.
- Com usuário, mas sem empresa: `bypassWithUser` (`/auth/me`, `/empresas/create`, `/empresas/usuario/add/:email`, `/convite/aceitar/:token`).
- Demais rotas: JWT de acesso no cookie `_tk` (`type: "access"`, `usuario_id`, `nome_usuario`) + header `x-workspace-id` (= `empresa.identificador`) + vínculo em `empresaUsuarios`. Resultado em `req.user`: `{ type, usuario_id, nome_usuario, empresaId, empresaData }`.
- Rota nova pública ou sem empresa precisa ser incluída nessas listas; caso contrário exige login + empresa.
- O **cargo não está no JWT nem em `req.user`**: consulte `empresaUsuarios` com `getCargoUsuario` ou `podeVerLancamentosDaEmpresa` (`src/lib/utils.ts`). Regra decidida: `COLAB` só acessa os próprios lançamentos e o que deriva deles (despesas, relatórios, `usuarios/list/:id` e `stats`, lançamentos e somas nos detalhes de atividade e cliente); `OWNER`/`ADMIN`, os da empresa. Fora do escopo → 404. Quem pode convidar e gerir `administrativo`: pendente (hoje só escopo de empresa).

## Sessão (`src/entities/auth/`)
- Login aceita `nome_usuario` ou e-mail; senha com argon2id (`src/lib/argon/index.ts`).
- Cookies `_tk` (access JWT, `ACCESS_TOKEN_EXPIRES_IN`) e `_rtk` (refresh opaco, `REFRESH_TOKEN_TTL_DAYS`), `httpOnly`; `secure` e `sameSite: "none"` só com `NODE_ENV=production`, senão `lax`.
- Refresh guardado como SHA-256 em `token`; rotação em `$transaction` com `updateMany({ where: { id, revoked_at: null } })` + `count`. Logout revoga só o refresh enviado (outras abas/dispositivos seguem logados).
- Primeiro login cria `apiKey` (JWT sem expiração) usada em `/api/*`.
- Recuperação de senha: código de 8 hex em `Map` em memória, 5 min (não sobrevive a restart nem a mais de um processo; persistência depende de migration).
- `GET /auth/me` é atendido por `usuariosController.getMe`.

## Rotas por entidade (`src/router/index.ts`)
Padrão de nome atual: `/<entidade>/list[/:id]`, `/create`, `/edit/:id`, `/delete/:id`.

| Entidade (pasta) | Rotas | Observação |
|---|---|---|
| `auth` | `POST /auth/{login,register,refresh-token,logout,password-reset,password-reset-verify}` | e-mail de reset via Resend |
| `usuarios` | `GET /auth/me`, `GET /usuarios/list[/:id]` (`?cargo&status`), `GET /usuarios/stats/:usuarioId`, `PATCH /usuarios/senha` | `stats` usa `$queryRaw`; `:id`/`:usuarioId` precisam de vínculo com a empresa (404); COLAB: `stats` só de si, `lancamentos: []` no detalhe de colega |
| `empresas` | `POST /empresas/create`, `POST /empresas/usuario/add/:email`, `DELETE /empresas/usuario/remove/:id`, `DELETE /empresas/delete` | criação em transação (empresa + vínculo `OWNER`) |
| `convite` | `POST /convite/create` (rate limit 30/h por usuário), `GET /convite/aceite/:token` (público, redireciona ao front), `POST /convite/aceitar/:token` | token JWT 2 dias; erros com `InviteError.code` |
| `clientes` (modelo `parceiro`) | `GET /clientes/list[/:id]` (`?is_active`), `GET /clientes/:id/projetos`, `POST /clientes/create`, `PUT /clientes/edit/:id`, `DELETE /clientes/delete/:id` | parceria com outra empresa via `identificador_parceiro` |
| `parceria` (`partner.*`) | `POST` e `DELETE /partner/:projetoId/:clienteId` | marca projeto/atividades como `compartilhado` |
| `projetos` | `GET /projetos/list[/:id]`, `POST /projetos/create`, `PUT /projetos/edit/:id`, `DELETE /projetos/delete/:id` | mapeia `P2025`/`P2003` no `remove` |
| `atividades` | `GET /atividades/list[/:id]`, `POST /atividades/create`, `PUT /atividades/edit/:id`, `DELETE /atividades/delete/:id` | detalhe traz até 5 lançamentos recentes (COLAB: só os próprios) |
| `lancamentos` | `GET /lancamentos/new-info`, `GET /lancamentos/list[/:id]` (`?from&projeto_id&ano&mes`; `cargoOwner` é ignorado), `POST /lancamentos/create`, `PUT /lancamentos/edit/:id`, `DELETE /lancamentos/delete/:id` | escritas em transação: valida origem (`validarOrigemLancamento`), `hora_fim > hora_inicio` e atualiza `horas_gastas` com `recalcularHorasGastas(…, tx)` |
| `despesas` | `GET /despesas/lancamentos/dia`, `GET /despesas/list[/:id]`, `POST /despesas/create`, `DELETE /despesas/delete/:id` | despesa pertence a um lançamento; create/delete conferem empresa e, para COLAB, dono do lançamento (404) |
| `administrativo` | `GET /administrativo/list`, `POST /administrativo/create`, `PUT /administrativo/edit/:id`, `DELETE /administrativo/delete/:id` | férias/falta/evento com checagem de conflito; escopo de empresa; PUT altera só os campos enviados |
| `dashboard` | `GET /dashboard/stats` | |
| `relatorios` | `POST /relatorios/list` e `POST /relatorios/files` (mesmo handler; `?tipo=despesas`, `?filext=xlsx` devolve arquivo), `GET /api/relatorios/registro?identificador&data_inicio&data_fim` (Bearer API key + `x-workspace-id`) | ExcelJS; JSON e arquivo respondem `202` |
| — | `GET /health` | texto simples |

## Camadas e formato (como o código faz hoje)
- `<entidade>.dto.ts`: **interfaces TypeScript** de entrada (camelCase) e saída. Não há validação em tempo de execução; `zod` foi removido e não será adotado.
- `<entidade>.controller.ts`: lê `req.body` (snake_case, ex.: `razao_social`), valida com `typeof`/presença, chama o service, responde. Exporta `default { ... }`.
- `<entidade>.service.ts`: Prisma + regra; lança `AppError`. Exporta `export const XService = { ... }`.
- Tipos globais `request`, `response`, `next`, `Returnable` em `src/types/index.ts` (sem import).
- Sucesso: `{ error: false, data }` ou `{ error: false, message }`.
- Erro: `errorHandler(res, error, "XController")` (`src/lib/errors/AppError.ts`) → `AppError` vira `{ error, message }` com o `statusCode`; **para 404 responde `error: false`**; o resto vira `500 { error: true, message: "Erro interno." }` com `console.error` (com `requestId`, só `name`/`code`/`message`/`stack` via `resumoDoErro`; `PrismaClientValidationError` só `name`). Erro que escapa do controller cai no `errorMiddleware` global (responde `error: true`, inclusive 404). `InviteError` (`src/lib/errors/InviteError.ts`) acrescenta `code` (só em `postAceitarConvite`).
- Sem paginação nas listagens (só `take: 5` em rankings do dashboard/atividades).

## Modelos e enums (`src/schema_db/*.prisma`, multi-arquivo)
| Modelo | Pontos-chave |
|---|---|
| `empresa` | `identificador` único (= `x-workspace-id`), `nome_empresa` único |
| `usuario` | `nome_usuario`/`email` únicos, `hash_senha`, `is_active` |
| `empresaUsuarios` | PK (`usuario_id`,`empresa_id`), `cargo Cargos` (`OWNER`, `ADMIN`, `COLAB`) |
| `parceiro` (cliente) | `empresa_id`, `cnpj`/`razao_social`/`email` únicos globais, `is_active` |
| `parceria` | liga `parceiro` a `empresa_parceira_id`; `@@unique([empresa_id, empresa_parceira_id])` |
| `projeto` | `parceiro_id`, `empresa_id`, `status StatusProjeto` (`EmEspera`, `Orcando`, `EmAndamento`, `Finalizado`, `Cancelado`), `tipo TipoProjeto`, `horas_previstas`/`horas_gastas` `Float`, `compartilhado`, N:N `equipe` com `usuario` |
| `atividade` | `projeto_id`, `empresa_id`, `prioridade Prioridades`, `tipo TipoAtividade`, `horas_*` `Float`, `faturado`, `compartilhado` |
| `lancamento` | `usuario_id`, `atividade_id`, `projeto_id`, `cliente_id` (→ `parceiro`), `data_lancamento timestamptz`, `hora_inicio`/`hora_fim` `@db.Time`, `duracao_total Float` (horas decimais), `tipo_lancamento` (`MANUAL`, `CRONOMETRO`) |
| `despesa` | `lancamento_id`, `valor Float`, sem status nem comprovante |
| `administrativo` | `tipo TipoAdministrativo` (`FERIAS`, `FALTA`, `EVENTO`), `data_inicio`/`data_fim`, `usuarioId?` e `empresaId` (camelCase, exceção no schema) |
| `token` | refresh token (hash, `expires_at`, `revoked_at`) |
| `apiKey` | chave por usuário |
| `relatorios_log` | existe no schema; nenhum código grava nele |

Convenções: modelos em minúsculas, campos snake_case, PK `uuid` com `gen_random_uuid()`, `criado_em`, desativação por `is_active` (não há `deletedAt` nem `updatedAt`). Sem máquina de estados além de `StatusProjeto`.

## Utilitários (`src/lib/`)
- `TimeStamps.ts`: `getRangeDate`, `getRangeMonth`, `getRangeYear` (UTC), `getWatchHour` (horas decimais → `"HH:mm"`).
- `utils.ts`: `limitCheck`, `getCargoUsuario`, `podeVerLancamentosDaEmpresa` (403 sem vínculo; `true` para OWNER/ADMIN), `isUuid`, `recalcularHorasGastas` (`increment`, exige o `tx` da transação), `decodeJWTconvite`, `projectStatusClassByLabel`. (`validaLancamentoFonte` foi removida; a validação de origem do lançamento está em `lancamentos.service.ts`.)
- `mailer/index.ts`: exporta o cliente `Resend`. Os services chamam `resend.emails.create({ from, to, template: { id, variables } })` com `from` = `Chronotracker <contato…>` (`auth.service.ts`) ou `<convite…>` (`convite.service.ts`), sufixo vindo de `RESEND_MAIL`. Templates: `password-reset`, `convite-empresa`. Sem timeout nem retry.
- `argon/index.ts`: `argon2.hash`/`verify` (argon2id).
- `src/prisma/index.ts`: instância única de `PrismaClient` com `PrismaNeon` (`DATABASE_URL`).

## Exemplos de referência
| Padrão | Onde |
|---|---|
| Entidade completa (DTO/Service/Controller) | `src/entities/clientes/` |
| Listagem com filtros e agregação no banco | `src/entities/lancamentos/lancamentos.service.ts` (`find`, `aggregate`) |
| Escopo empresa + parceria na consulta | `src/entities/clientes/clientes.service.ts` (`findById`) |
| Transação interativa | `src/entities/empresas/empresas.service.ts` (`create`) |
| Atualização condicional atômica (`updateMany` + `count`) | `src/entities/auth/auth.service.ts` (`refreshToken`) |
| Checagem de conflito de período | `src/entities/administrativo/administrativo.service.ts` (`validateNoConflict`) |
| Envio de e-mail | `src/entities/convite/convite.service.ts` (`invite`) |
| Mapeamento de erro do Prisma | `src/entities/projetos/projetos.service.ts` (`remove`) |
| Geração de XLSX | `src/entities/relatorios/relatorios.service.ts` (`generateBuffer`) |
| Teste de rota / de serviço | não existe (sem testes no projeto) |

## Variáveis de ambiente (só nomes)
`PORT`, `NODE_ENV`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_TTL_DAYS`, `FRONTEND_URL`, `BACK_END_URL`, `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_MAIL`. `.env.example` também lista `INTERNAL_CLIENT` (não usada em `src/`) e não lista `BACK_END_URL` nem `RESEND_MAIL`. Lidas direto com `env` de `node:process` (ou `process.env` em `src/server.ts`), sem módulo de configuração.
