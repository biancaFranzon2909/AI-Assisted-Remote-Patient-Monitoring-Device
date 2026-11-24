---
applyTo: "**/src/**/*.ts,**/ecosystem.config.*"
---

# Operação, configuração e observabilidade

## Como está hoje no código
- **Config**: não há módulo de configuração; `env` de `node:process` é lido em vários arquivos (`src/middlewares/auth.ts`, `src/entities/auth/auth.service.ts`, `src/prisma/index.ts`, `src/lib/mailer/index.ts`…). Variáveis usadas: `PORT`, `NODE_ENV`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_TTL_DAYS`, `FRONTEND_URL`, `BACK_END_URL`, `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_MAIL`. `.env.example` está incompleto (faltam `BACK_END_URL` e `RESEND_MAIL`). Variável nova: acrescente ao `.env.example` sem valor real.
- `NODE_ENV` é usado para decidir cookie `secure`/`sameSite`: hom roda com `development`.
- **Logs**: `console.*` (`console.error`/`console.warn` nos erros; `console.log` só na subida e no encerramento em `src/server.ts`). Sem logger. Cada requisição tem `req.requestId` (`src/middlewares/requestId.ts`: reaproveita `X-Request-Id` se válido, senão gera; devolvido no header `X-Request-Id`), incluído nos logs do `errorHandler` e do `errorMiddleware`. Erros são logados só com `name`, `code`, `message` e `stack` (`resumoDoErro`), nunca o objeto inteiro (erros do Prisma levam os argumentos da consulta). Não acrescente `console.log`; ao tocar num, prefira removê-lo.
- **Erros**: `errorHandler` (`src/lib/errors/AppError.ts`) por controller; depois do router, `notFoundMiddleware` (404 JSON `"Rota não encontrada."`) e `errorMiddleware` global (`AppError` com o próprio status; JSON malformado 400; corpo > 1mb 413; demais 500 genérico). Rota inexistente sem login responde 401 (o `authMiddleware` vem antes). `src/server.ts` registra `unhandledRejection`/`uncaughtException` (loga e encerra com código 1) e trata erro do `listen` (encerra com código 1).
- **Saúde e encerramento**: `GET /health` em `src/router/index.ts` (público, não testa o banco). `src/server.ts` trata `SIGINT`/`SIGTERM` com `server.close` + `prisma.$disconnect()` e tempo limite de 10 s (depois força a saída).
- **PM2** (`ecosystem.config.js`, versionado, editado só pelo dono): app `back-end`, modo fork, 1 processo, `watch: false`, **sem `kill_timeout`** (o padrão do PM2 é 1,6 s, menor que os 10 s do encerramento); `env_prod` porta 3001, `env_hom` porta 3005. O arquivo contém valores de variáveis: **nunca copie, cite ou acrescente segredos nele**; use variáveis do servidor. Fica fora do `tsconfig` (não é copiado para `dist/`). Rate limit e código de recuperação de senha ficam em memória: valem só com 1 processo.
- **Deploy**: `.github/workflows/deploy.yaml` (push em `hom`/`prod`) → `npm install --include=dev` → `npx prisma migrate deploy` → `npm run build` → `pm2 restart ecosystem.config.js --env <branch>`.
- **Integrações**: Resend sem timeout/retry, chamado dentro do request (`convite.service.ts`, `auth.service.ts`). Relatórios XLSX gerados em memória e devolvidos na mesma requisição (`relatorios.service.ts`).

## Configuração
- `process.env` é lido em **um único módulo**, validado com schema na subida (falha rápida com mensagem clara dos campos ausentes). O resto do código importa a configuração tipada.
- Nada de `if` por nome de host ou ambiente no código: o que muda entre hom e prod é variável de ambiente. Cada ambiente tem banco, chaves e origens permitidas próprios.

## Logs
- Logs estruturados (JSON), com a biblioteca que o projeto já usa (pino, por exemplo). Sem `console.log`.
- Cada requisição carrega um `requestId` (gerado ou vindo de `X-Request-Id`), presente em todos os logs e na resposta de erro, para o front e o suporte rastrearem.
- Níveis: `error` para falha inesperada; `warn` para situação de negócio anormal; `info` para eventos relevantes. Nunca registre corpo de requisição inteiro, senha, token, cookie, e-mail ou CPF.

## Erros
- Um middleware central converte erros conhecidos (validação, regra de negócio, Prisma) na resposta padrão; erro inesperado vira `500` genérico, com stack e `requestId` só no log.
- `unhandledRejection` e `uncaughtException` registram e encerram o processo de forma controlada, para o PM2 reiniciar.

## Saúde e encerramento
- `GET /health` (rápido, sem autenticação) para checagem; se precisar, `/health/ready` testa o banco.
- Encerramento gracioso em `SIGTERM`/`SIGINT`: parar de aceitar conexões (`server.close`), terminar as requisições em andamento, `prisma.$disconnect()`, com tempo limite. Alinhe com o `kill_timeout` do PM2.
- `pm2 reload` só entrega zero downtime em modo cluster; em modo fork é um restart. Com mais de um processo, tudo que fica em memória (conexões SSE, cache, contadores de rate limit, timers) deixa de ser global: use armazenamento compartilhado.

## Trabalho em segundo plano e integrações
- E-mail (Resend) e geração de relatório não bloqueiam a resposta quando demoram: responda `202` com o estado consultável, ou use fila/worker. Envie e-mail **depois** do commit da transação; falha de e-mail não desfaz a regra de negócio. Retentativas com backoff e idempotência, para não enviar duas vezes.
- Chamadas externas com timeout explícito; retry só em operação idempotente; nunca devolva ao cliente o erro cru do provedor.
- Evite trabalho síncrono pesado no event loop (planilha grande, hash de senha síncrono): use streaming ou worker.
