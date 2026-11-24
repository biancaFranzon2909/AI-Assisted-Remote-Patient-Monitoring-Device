# ChronoTracker — API (back-end): guia para agentes de IA

API do ChronoTracker, aplicação de controle de horas e gestão de despesas corporativas. Este arquivo é lido pelo Copilot (VS Code, CLI e agente de nuvem) e por outras ferramentas de IA. Regras por tipo de arquivo ficam em `.github/instructions/`, papéis em `.github/agents/` e conhecimento de domínio em `.github/skills/`.

## Stack (confira em `package.json` antes de assumir API de biblioteca)
- Node.js + **Express 5** + **TypeScript** (`strict`, `module` nodenext, alias `@/*` → `src/*` resolvido no build por `tsc-alias`). npm (`package-lock.json`).
- **Prisma 7** com `@prisma/adapter-neon` (PostgreSQL no Neon, um banco por ambiente). Config em `prisma.config.ts`; schema multi-arquivo em `src/schema_db/*.prisma`.
- JWT (`jsonwebtoken`) em cookies, senha com `argon2`, e-mail via `resend`, planilhas com `exceljs`, `helmet` e `express-rate-limit`.
- Validação é manual no controller; `zod` **não será adotado** (decisão do time). `zod`, `bcrypt`, `bcryptjs`, `cls`, `nodemailer`, `pg` e `z` foram removidos do `package.json`: não os importe.
- Execução: PM2 (`ecosystem.config.js`, processo `back-end`, `watch: false`, 1 processo): produção na porta 3001 (`NODE_ENV=production`), homologação na 3005 (`NODE_ENV=development`), em servidores separados. O `ecosystem.config.js` fica fora do `tsconfig` (não vai para `dist/`).

## Mapa do código
- `src/server.ts`: `listen` (erro no `listen` encerra com código 1), encerramento gracioso (`SIGINT`/`SIGTERM`) e handlers de `unhandledRejection`/`uncaughtException` (registram e encerram para o PM2 reiniciar). `src/config/app.ts`: monta o `app` (helmet, CORS, requestId, cookies, rate limit, JSON 1mb, `authMiddleware`, router, 404 JSON, middleware de erro) e o exporta sem `listen`.
- `src/router/index.ts`: **todas** as rotas, num arquivo só. `src/middlewares/`: `auth.ts` (login, rotas públicas e escopo de empresa), `requestId.ts`, `rateLimit.ts`, `errorMiddleware.ts` (erro global + `notFoundMiddleware`).
- `src/entities/<entidade>/`: `<entidade>.dto.ts` (interfaces), `<entidade>.service.ts` (Prisma e regra), `<entidade>.controller.ts` (HTTP).
- `src/lib/`: `errors/AppError.ts` (`AppError`, `errorHandler`, `resumoDoErro`), `errors/InviteError.ts`, `utils.ts` (`getCargoUsuario`, `podeVerLancamentosDaEmpresa`, `isUuid`, `recalcularHorasGastas`), `TimeStamps.ts`, `mailer/`, `argon/`. `src/prisma/index.ts`: cliente único. `src/types/index.ts`: tipos globais `request`/`response`/`next`, `req.user` e `req.requestId`.
- Detalhes (rotas por entidade, modelos, enums, exemplos): skill `mapa-da-api`.

## Convenções atuais do código
- Rotas: `/<entidade>/list[/:id]`, `/create`, `/edit/:id`, `/delete/:id`, também para entidades novas. Corpo de entrada em snake_case; respostas em camelCase.
- `COLAB` só vê e altera os próprios lançamentos (e as despesas, relatórios e detalhes derivados deles); `OWNER`/`ADMIN` veem os da empresa. Use `podeVerLancamentosDaEmpresa`/`getCargoUsuario` (cargo vindo do banco). `administrativo` tem escopo de empresa, mas quem pode convidar e gerir `administrativo` ainda não foi decidido: pergunte antes de mudar.
- Toda rota (fora das listas de `src/middlewares/auth.ts`) exige cookie `_tk` e header `x-workspace-id` (= `empresa.identificador`); o middleware põe `usuario_id` e `empresaId` em `req.user`. Toda consulta filtra por `empresa_id`. Recurso fora do escopo responde 404.
- Perfil é por empresa: `empresaUsuarios.cargo` (`OWNER`, `ADMIN`, `COLAB`). Não está no JWT; consulte no banco. O `cargoOwner` do corpo é ignorado.
- Sucesso `{ error: false, data | message }`; erro `{ error: true, message }`. O service lança `AppError(message, status)`; o controller faz `try/catch` e chama `errorHandler(res, error, "NomeController")`. Erro não capturado cai no `errorMiddleware` (AppError com o próprio status; demais 500 genérico); rota inexistente: 404 `{ error: true, message: "Rota não encontrada." }`.
- Validação de entrada é manual no controller (não há biblioteca de validação em uso); ids com `isUuid` (400).
- Tabelas com `criado_em` e `is_active` (desativação lógica); ids `uuid`. Horas em `Float` (horas decimais) e exibidas como `"HH:mm"` (`TimeStamps.getWatchHour`); `despesa.valor` é `Float`.
- Logs com `console.*` (sem logger); cada requisição tem `requestId` (header `X-Request-Id`), incluído nos logs de erro, que registram só `name`, `code`, `message` e `stack`. Rate limit em memória (vale para 1 processo; rotas e limites na skill `mapa-da-api`).

## Princípios
1. **Leia antes de escrever.** Ache uma entidade parecida e siga o padrão dela. Não introduza biblioteca, camada ou convenção nova sem pedir.
2. **O contrato é compartilhado com o front.** Prefira mudanças aditivas; ao alterar ou remover rota, campo ou status, liste o impacto no front.
3. **Autorização em todo recurso.** Toda rota exige login por padrão e todo acesso por id confere se o usuário pode ver aquele recurso (BOLA). O front esconde botões; quem decide é a API.
4. **O banco garante a integridade.** Unicidade, chaves e estados válidos viram constraint; operações com mais de uma escrita rodam em transação.
5. **Migrations seguras.** Nunca editar migration já aplicada; mudanças compatíveis com a versão anterior do app (expandir → migrar → contrair).
6. **Sem segredos nem dados pessoais** em log, resposta ou commit (LGPD).
7. **Idioma:** mensagens ao usuário em pt-BR; identificadores no idioma já usado no arquivo.
8. **Pergunte quando faltar regra de negócio** que muda o resultado, em vez de inventar.

## Ambientes e deploy — regra de ouro
Produção e homologação têm servidores e bancos separados. Fluxo de branches `dev` → `hom` → `prod`. `.github/workflows/deploy.yaml` dispara em push para `hom` e `prod` (não em `dev`) e, via SSH no servidor, roda `git pull --rebase`, `npm install --include=dev`, `npx prisma migrate deploy` (pela `DATABASE_URL` com pooler do Neon), `npm run build` e `pm2 restart ecosystem.config.js --env <branch>`. A migration roda **antes** do build e do restart: o código antigo convive com o schema novo por alguns instantes. Não há lint, teste nem typecheck no CI.
`prisma migrate deploy` só executa migrations **versionadas** em `src/schema_db/migrations/`.
- Toda mudança de schema que vá para hom/prod precisa de migration gerada e commitada (`npx prisma migrate dev --create-only --name <nome>`, só contra banco local, com o SQL revisado). `db push` só em banco local descartável: ele muda o banco sem criar migration, e a mudança nunca chegaria a hom/prod.
- O agente **nunca** executa migration, seed, reset ou script de dados contra homologação ou produção, nem usa a `DATABASE_URL` desses ambientes.
- Proibido: `prisma migrate reset`, `prisma db push --force-reset`, `DROP`, `TRUNCATE` e `DELETE` sem `WHERE`.

## Comandos (scripts reais do `package.json`)
- `npm run dev`: nodemon + tsx em `src/server.ts`.
- `npm run build`: `tsc && tsc-alias` (saída em `dist/`). `npm start`: `node dist/src/server.js`.
- Typecheck: `npx tsc --noEmit` (não há script). Schema: `npx prisma validate` e `npx prisma generate` (este também roda no `postinstall`).
- **Não existem** scripts de `lint` nem de `test`, e não há testes no repositório. Antes de dizer que terminou, rode typecheck e build; se a tarefa criar testes, proponha o runner antes.
- `npm run seed` usa `mockup/seed.ts` (pasta fora do Git); nunca rode contra hom/prod.

## Definição de pronto (back)
- Entrada validada com lista permitida de campos (hoje, no controller); autorização conferida por perfil (`cargo` em `empresaUsuarios`) e por recurso (`empresa_id` e dono).
- Status HTTP corretos e erros no formato padrão do projeto, sem vazar stack, SQL ou detalhes internos.
- Consultas com `select`/`include` mínimos, sem N+1; índice para todo filtro ou ordenação novos; listagens paginadas.
- Migration versionada e revisada (sem perda de dados), com a ordem de deploy entre back e front definida.
- Testes: caminho feliz, validação, autorização (usuário A não acessa recurso do usuário B) e erro.
- Sem `any`, sem `console.log`, sem segredo ou dado pessoal em log.
- `npx tsc --noEmit` e `npm run build` passando; lint e testes quando existirem.
- Rota nova pública ou sem empresa registrada em `src/middlewares/auth.ts`.

## Exemplos para imitar
- Entidade completa: `src/entities/clientes/`. Escopo empresa + parceria: `clientes.service.ts` (`findById`).
- Transação: `src/entities/empresas/empresas.service.ts` (`create`). Atualização condicional atômica: `src/entities/auth/auth.service.ts` (`refreshToken`).
- E-mail: `src/entities/convite/convite.service.ts`. XLSX: `src/entities/relatorios/relatorios.service.ts`.
- Não há exemplo de paginação nem de teste: proponha o padrão antes de criar.

## Agentes (`.github/agents/`)
| Agente | Use para |
|---|---|
| `orquestrador-back` | Ponto de entrada: classifica, delega e fecha a definição de pronto |
| `arquiteto-api` | Especificar contrato, modelo de dados, autorização e plano de migração antes do código |
| `implementador-back` | Escrever o código seguindo as camadas e o Prisma do projeto |
| `auditor-seguranca` | Auditar segurança, integridade e desempenho (somente leitura) |
| `testes-back` | Criar testes de API, serviço e autorização |
| `revisor-back` | Revisão final (somente leitura) |

Feature ou endpoint novo: `arquiteto-api` → `implementador-back` → `auditor-seguranca` → `testes-back` → `revisor-back`.
Mudança de schema: `arquiteto-api` (plano de migração) → `implementador-back` → `auditor-seguranca` → `revisor-back`.
Bug pequeno: `implementador-back` → `testes-back` (teste de regressão) → `revisor-back`.

Prompts: `/nova-feature-api`, `/planejar-migracao`, `/revisar-back`, `/adequar-contexto-back`.
Skills: `mapa-da-api` (onde fica cada coisa), `integridade-horas-despesas`, `relatorios-e-notificacoes`.
