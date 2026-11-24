---
applyTo: "**/src/**/*.ts"
---

# Segurança, autenticação e autorização

Referência: OWASP API Security Top 10 (2023).

## Como está hoje no código
- **Autenticação global** em `src/middlewares/auth.ts`, registrado em `src/config/app.ts`. Rotas públicas: array `pathsToIgnore` + `testBypassPathsWithRegex`; rotas com usuário mas sem empresa: `bypassWithUser`. Rota nova pública ou sem empresa **precisa** entrar nessas listas.
- **Sessão**: JWT de acesso no cookie `_tk` (`type: "access"`, `usuario_id`, `nome_usuario`); refresh opaco no cookie `_rtk`, guardado como SHA-256 na tabela `token`, com rotação em transação (`src/entities/auth/auth.service.ts`). `secure` + `sameSite: "none"` só quando `NODE_ENV=production` (hom roda com `development` → `lax`, sem `secure`).
- **Escopo de empresa**: header `x-workspace-id` (= `empresa.identificador`) + vínculo em `empresaUsuarios`; o middleware põe `req.user.empresaId`. Toda consulta filtra por `empresa_id` (ou parceria, ver `src/entities/clientes/clientes.service.ts` `findById`).
- **Visão da empresa parceira** (detalhes de cliente/projeto/atividade): exige `parceria { empresa_parceira_id, is_active: true }` e, para projeto/atividade, `compartilhado: true` (mesmo predicado de `validarOrigemLancamento`). A parceira não recebe `notaInterna` (`null`) nem a `equipe` do projeto (`[]`), e só vê as atividades compartilhadas; `totalDespesas` do cliente soma só lançamentos de usuários da empresa do ator. Ids de rota não-uuid → `400`. Prisma com `errorFormat: "minimal"`; `PrismaClientValidationError` é logado só com `name`.
- **Perfis**: `empresaUsuarios.cargo` (`OWNER`, `ADMIN`, `COLAB`), por empresa. **Não está no token nem em `req.user`**: consulte no service (`getCargoUsuario`/`podeVerLancamentosDaEmpresa` em `src/lib/utils.ts`). Nunca aceite cargo, `usuario_id` de terceiro ou flag de privilégio vinda de query/corpo (o antigo `cargoOwner` de `GET /lancamentos/list` é ignorado). `src/middlewares/verifyRole.ts` não é usado e espera `req.user.cargo`, que não existe.
- **Regras de perfil decididas:** `COLAB` só vê e altera os próprios lançamentos (filtrar `usuario_id` na consulta; recurso de outro → `404`); `OWNER`/`ADMIN` veem os da empresa. Aplicado em lançamentos, despesas (create/delete pelo lançamento; listagem filtra o próprio usuário), relatórios (`colaboradores` do corpo ignorado para COLAB), `GET /usuarios/list/:id` (alvo precisa ter vínculo com a empresa; `lancamentos: []` para COLAB consultando colega), `GET /usuarios/stats/:usuarioId` (COLAB só a si mesmo) e detalhes de atividade/cliente (lançamentos e somas de despesas só os próprios). Lançamento só em atividade ativa da empresa ou compartilhada por parceria ativa, com projeto/cliente coerentes. `administrativo` tem escopo de empresa (`empresaId` do ator; responsável precisa ter vínculo). **Pendente de decisão:** quem pode criar convite (`POST /convite/create`) e criar/editar/excluir `administrativo` — não acrescente nem remova restrição sem confirmar com o time.
- **Integração externa**: `GET /api/relatorios/registro` aceita `Authorization: Bearer <apiKey>`; o app copia para o cookie `_tk` em `/api/*`. A `apiKey` é um JWT sem expiração gravado em texto puro na tabela `apiKey`; qualquer usuário com apiKey (inclusive `COLAB`) extrai os lançamentos de toda a empresa por essa rota.
- **Recuperação de senha**: código em `Map` na memória do processo (5 min), até existir a migration de persistência; tentativas limitadas só pelo rate limit.
- **CORS**: lista fixa no próprio `src/config/app.ts` (não vem de variável de ambiente), `credentials: true`.
- **Cabeçalhos e limites**: `helmet` (padrões, com `crossOriginResourcePolicy: "cross-origin"` para o front baixar JSON/XLSX), `express.json({ limit: "1mb" })`, `requestId` (`X-Request-Id`). Rate limit (`src/middlewares/rateLimit.ts`, store em memória — vale para 1 processo PM2; 429 `{ error: true, message }`): `POST /auth/login` 10/15 min por IP (só falhas contam), `/auth/register` 10/h, `/auth/password-reset` 5/15 min, `/auth/password-reset-verify` 10/15 min, `/auth/refresh-token` 120/15 min (por IP); `POST /convite/create` 30/h por `usuario_id`, aplicado na rota, depois do `authMiddleware`.
- **Ausentes**: proteção CSRF além de `SameSite`, validação de env na subida, trilha de auditoria. `trust proxy` está `true` (permissivo: o IP usado pelo rate limit vem do `X-Forwarded-For`, que o cliente pode forjar se não houver proxy confiável na frente; aguardando informação de infraestrutura).
- Senha: argon2id (`src/lib/argon/index.ts`). Ao devolver usuário, use `select` sem `hash_senha` (`include: { usuario: true }` expõe o hash).

## Autorização (a mais importante)
- **Negar por padrão:** middleware global exige autenticação; rotas públicas entram numa lista explícita e curta.
- **BOLA (API1):** todo acesso a recurso por id confere que o ator pode acessá-lo (dono, mesmo cliente ou espaço de parceiro, perfil). Filtre pelo escopo **na própria consulta** (`where: { id, ...escopoDoUsuario }`) em vez de buscar e checar depois; quando não for visível, responda `404`.
- **BFLA (API5):** ações privilegiadas (aprovar despesa, fechar período, mudar perfil) verificam o perfil no servidor.
- **Isolamento por espaço:** dados de espaços de parceiros e de clientes nunca se misturam; toda consulta carrega o escopo.
- **Atribuição em massa (API3):** o DTO aceita só campos permitidos. Nunca `prisma.x.create({ data: req.body })`. Campos como `role`, `ownerId`, `status` e `approvedBy` não vêm do cliente em endpoints comuns.
- **Fluxos de negócio sensíveis (API6):** convite, recuperação de senha, envio de relatório e aprovação têm limite de frequência e trilha de auditoria.

## Autenticação e sessão
- Cookie de sessão `httpOnly`, `Secure` em produção. `SameSite=Lax` quando front e API compartilham o mesmo domínio registrável (subdomínios contam como mesmo site); `SameSite=None; Secure` só se forem sites diferentes.
- Com cookie, métodos que alteram estado precisam de proteção CSRF: `SameSite` mais verificação de `Origin` contra a lista de origens permitidas, ou token CSRF.
- Senha com argon2id ou bcrypt (custo adequado); mensagem de login genérica (não diz se o e-mail existe); limite de tentativas em login, recuperação e convite.
- Tokens de recuperação e convite: aleatórios (`crypto`), uso único, com expiração e guardados como hash.
- Logout invalida a sessão no servidor; troque o identificador de sessão após o login.
- **Multi-aba:** logar em uma aba ou dispositivo não pode encerrar a sessão de outro; só logout explícito encerra. `GET /auth/me` é leitura. Ao mexer em autenticação, teste com duas abas.

## CORS e cabeçalhos
- Lista fixa de origens por ambiente (front de hom e de prod), `credentials: true`, nunca `*` com credenciais.
- Respostas de erro da infraestrutura (502/503 do proxy, processo reiniciando) não trazem cabeçalhos CORS e aparecem no navegador como "erro de CORS". **Antes de mexer no CORS, olhe o status real** (`curl -i`, logs do PM2/proxy).
- `helmet`, `x-powered-by` desligado, limite de tamanho no corpo (`express.json({ limit })`) e rate limit global, mais restrito nas rotas sensíveis. Atrás de proxy reverso, configure `trust proxy`; senão o rate limit enxerga só o IP do proxy.

## Entrada e consumo de recursos (API4)
- Valide tipo, tamanho, formato e enum de tudo que vem de corpo, query e parâmetros de rota (id no formato esperado).
- Nunca monte SQL por concatenação. `$queryRaw` só com template parametrizado; `$queryRawUnsafe` nunca com entrada do usuário.
- Paginação com limite máximo; sem consulta ilimitada, sem `include` aninhado sem controle.
- **Upload:** valide tipo pelo conteúdo (assinatura do arquivo, não só extensão ou `Content-Type`) e o tamanho; gere o nome no servidor; nunca monte caminho de disco com dado do cliente (path traversal); guarde em storage privado e entregue por URL assinada de curta duração.
- Chamadas a serviços externos (Resend, storage): timeout explícito; nunca busque URL fornecida pelo usuário sem allowlist (SSRF, API7).

## Segredos e dados pessoais
- Segredos só em variáveis de ambiente, validadas na subida; nunca em código, log, resposta ou commit. `.env.example` sem valores reais. Se vazar, rotacione.
- LGPD: colete o mínimo, devolva só os campos necessários, não registre e-mail, nome, CPF, tokens ou cookies em log.
- Ações sensíveis (aprovar ou rejeitar despesa, fechar ou reabrir período, mudar perfil) gravam trilha de auditoria: quem, quando, o quê e valor antes/depois.
- Dependências: lockfile versionado, `npm audit` no CI, nada de dependência nova sem necessidade.
