---
applyTo: "**/src/entities/**/*.ts"
---

# API: camadas, contrato e erros

## Camadas por entidade (`src/entities/<entidade>/`)
- **DTO:** interfaces que definem a entrada permitida (lista explícita de campos) e o formato da resposta. Sem regra de negócio. A validação em runtime é manual no controller; **decisão do time: não adotar `zod`** (nem outra biblioteca de validação).
- **Service:** regra de negócio e acesso ao Prisma. Não conhece `req`/`res`. Recebe o **usuário autenticado (ator)** como argumento, e é aqui que se decide se ele pode agir sobre o recurso.
- **Controller:** só HTTP. Lê a requisição já validada, chama o Service, devolve status e corpo. Sem `if` de perfil espalhado e sem Prisma.
- Erros assíncronos: o projeto usa **Express 5.2** (promessas rejeitadas vão ao `next` sozinhas). Cada controller faz `try/catch` + `errorHandler(res, error, "NomeController")` (`src/lib/errors/AppError.ts`); siga esse padrão. Como rede de segurança, `src/config/app.ts` registra depois do router o `notFoundMiddleware` (rota inexistente → 404 `{ error: true, message: "Rota não encontrada." }`) e o `errorMiddleware` (`src/middlewares/errorMiddleware.ts`): `AppError` responde com o próprio status e mensagem; JSON malformado 400; corpo acima de 1mb 413; outros 4xx com mensagem genérica; o resto 500 `"Erro interno."`.
- Nunca devolva o objeto do Prisma cru: mapeie para o DTO de resposta (sem hash de senha, tokens ou campos internos).

## Contrato HTTP
- **Padrão de rotas (decisão do time, vale para entidades novas):** `GET /<entidade>/list[/:id]`, `POST /<entidade>/create`, `PUT /<entidade>/edit/:id`, `DELETE /<entidade>/delete/:id`, com a entidade em português no plural. Não use o padrão REST puro (`/projects/:id`). `GET` não tem efeito colateral.
- Status: `200` leitura/atualização, `201` criação (com o recurso criado), `204` exclusão sem corpo, `400` requisição malformada ou validação, `401` sem sessão válida, `403` autenticado sem permissão para a ação, `404` não existe **ou não é visível para o usuário**, `409` conflito (duplicidade, período fechado, transição inválida, versão desatualizada), `429` limite de requisições. Use `422` para regra de negócio só se o projeto já adota.
- **Formato único de erro** (siga o que o projeto já usa): `code` estável para o front tratar, `message` em pt-BR para o usuário, `details` opcional por campo. Nunca stack, SQL ou nome de tabela.
- Datas em ISO 8601 UTC com `Z`; data de calendário como `AAAA-MM-DD`; duração em minutos inteiros; dinheiro em centavos inteiros (ou string decimal). Nunca `float` no JSON.
- **Listagens:** paginação obrigatória com limite máximo (ex.: 100). Cursor para dados que crescem sem parar (lançamentos); offset só para listas pequenas. Ordenação e filtros apenas por campos permitidos — nunca repasse a query string do cliente ao Prisma.
- **Idempotência:** `POST` que cria lançamento, despesa ou envio aceita `Idempotency-Key` (ou usa constraint única natural) para que duplo clique e retry não dupliquem.
- **Edição concorrente:** quando duas pessoas podem editar o mesmo recurso, compare `updatedAt` ou `version` e responda `409` se estiver desatualizado.
- **Evolução do contrato:** mudanças aditivas (campo novo opcional). Renomear ou remover exige período de convivência, aviso e ajuste do front antes da remoção.

## Organização
- Hoje **não há arquivo de rotas por entidade**: todas as rotas estão em `src/router/index.ts`, e a autenticação é o `authMiddleware` global (`src/middlewares/auth.ts`). Não existe middleware de autorização nem de validação por rota (`src/middlewares/verifyRole.ts` está desligado e desatualizado). Registre a rota nova no router central; a ordem desejada continua sendo autenticação → autorização → validação → controller.
- Funções puras de regra (cálculo de horas, transições de status) ficam isoladas e testáveis, sem acesso ao banco.
- Constantes de domínio (status, perfis) em enums compartilhados, nunca strings soltas. Use os enums gerados pelo Prisma (`Cargos`, `StatusProjeto`, `TipoLancamento`…).

## Como está hoje no código (siga ao alterar; não reescreva o que não faz parte da tarefa)
- **DTO** (`<entidade>.dto.ts`): só interfaces TypeScript de entrada e saída; não valida em runtime. O time decidiu **não adotar `zod`** (removido do `package.json`).
- **Controller** (`export default { ... }`): lê `req.body`/`req.query`, valida com checagens manuais (`typeof`, presença, `isUuid` de `src/lib/utils.ts` para ids → 400), chama o service e responde `{ error: false, data }` ou `{ error: false, message }`. `req.user.usuario_id` e `req.user.empresaId` vêm do middleware.
- **Service** (`export const XService = { ... }`): Prisma + regra; lança `new AppError(mensagem, status)`. Escopo de lançamentos por cargo: `podeVerLancamentosDaEmpresa(usuarioId, empresaId)` (`src/lib/utils.ts`; 403 sem vínculo, `true` para OWNER/ADMIN); COLAB filtra `usuario_id` na consulta.
- **Erro**: `{ error: true, message }`; não há `code` estável (exceção: `InviteError` em `convite`). `errorHandler` responde `error: false` quando o status é 404 — não copie isso em código novo sem alinhar com o front (o `errorMiddleware` global responde `error: true`). O `console.error` do `errorHandler` traz o `requestId` e só `name`/`code`/`message`/`stack` (`resumoDoErro`).
- **Rotas**: padrão `/<entidade>/list[/:id]`, `/create`, `/edit/:id`, `/delete/:id`, com nomes em português — também para entidades novas (decisão do time). Não renomeie rotas existentes sem plano com o front.
- **Nomes**: entrada em snake_case (igual às colunas); saída mapeada para camelCase.
- **Tempo e dinheiro**: duração em horas decimais `Float` (`duracao_total`, `horas_gastas`) e totais formatados `"HH:mm"` por `TimeStamps.getWatchHour`; `despesa.valor` é `Float`. Divergem da regra acima; mudar exige migration e ajuste do front.
- **Status**: criação costuma responder `200`/`201` sem padrão único; relatórios respondem `202` com o arquivo; rate limit responde `429` `{ error: true, message }`.
- **Listagens**: sem paginação (só `take: 5` em rankings). Novas listagens devem paginar; proponha o formato antes.
- Exemplo completo para imitar: `src/entities/clientes/`. Mapa de rotas e modelos: skill `mapa-da-api`.
