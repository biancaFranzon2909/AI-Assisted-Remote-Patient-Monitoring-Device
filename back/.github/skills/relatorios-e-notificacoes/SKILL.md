---
name: relatorios-e-notificacoes
description: Guia para o back-end de templates de relatório XLSX por cliente (upload, mapeamento de campos, escrita de células, envio) e de notificações em tempo real (SSE vs WebSocket, persistência, multi-processo). Use ao implementar ou revisar essas funcionalidades.
---

# Relatórios XLSX e notificações

## Como está hoje no código (verificado)
- **Biblioteca**: `exceljs` 4.x. Não há templates por cliente, upload de planilha, mapeamento de células nem marcadores: as planilhas são montadas do zero em código.
- **Onde**: `src/entities/relatorios/relatorios.service.ts` — `getRelatorioLancamentos`, `getRelatorioDespesas` (buscam tudo da empresa e filtram em JS por colaborador, cliente, projeto, atividade, data e tipo), `generateBuffer` (abas "Resumo Atividade" + uma aba por atividade; despesas com consolidação e totais por cliente via fórmula `SUM`), `generateReport` (aceita `fileType` `"xlsx" | "pdf"`, mas só gera XLSX — pedir `pdf` devolve um XLSX com extensão `.pdf`), `getRegistrosJson` (integração externa).
- **Rotas**: `POST /relatorios/list` e `POST /relatorios/files` apontam para o mesmo handler (`relatoriosEntryPoint` em `src/entities/relatorios/relatorios.controller.ts`): `?tipo=despesas` escolhe o relatório e `?filext=` faz devolver o arquivo (gerado em memória na própria requisição); JSON e arquivo respondem `202`. `GET /api/relatorios/registro` usa Bearer da `apiKey`.
- Valores de texto vão para as células sem neutralizar fórmula (`=`, `+`, `-`, `@`).
- Escopo: só `empresa_id` (via `atividade.empresa_id`); qualquer membro da empresa gera relatório de todos os colaboradores — confirme a regra antes de mudar.
- `makeFinalPath` cria a pasta `relatorios_gerados/` no disco, mas o fluxo atual devolve buffer. O modelo `relatorios_log` existe no schema e nenhum código grava nele. Não há envio de relatório por e-mail.
- **Notificações**: não existem (sem SSE, WebSocket, tabela de notificações). PM2 roda um processo em modo fork por ambiente (`ecosystem.config.js`); a URL do banco é a do pooler do Neon (ver seção "Vários processos").

## Templates XLSX por cliente
Modelo previsto: um template por cliente, cada cliente com vários colaboradores, mapeando campo/célula do Excel para dado da plataforma. Confirme a biblioteca de planilha em `package.json` antes de usar qualquer API.

**Localizar onde escrever**
- Se o projeto usa regex para achar linhas e colunas, aplique a regex a **marcadores explícitos** (`{{campo}}` ou nomes definidos do Excel), não a conteúdo livre. Assim a posição não depende de texto que o cliente edita.
- No upload do template, valide e devolva um relatório: marcadores desconhecidos, duplicados e obrigatórios ausentes. O mapeamento (célula ou marcador → dado da plataforma) fica salvo versionado, ligado ao cliente.
- Ofereça **simulação (dry-run)**: devolve o mapeamento resolvido e os avisos (campo vazio, conflito de células) sem gerar nem enviar nada.

**Conflito de células**
- Blocos que crescem (uma linha por colaborador ou por lançamento) empurram o que está abaixo. Calcule os deslocamentos antes de escrever, ou escreva de baixo para cima, e trate células mescladas, fórmulas, formatação condicional e áreas de impressão. Copie o estilo da linha modelo.
- Detecte conflito antes de gerar (duas escritas na mesma célula, bloco que invade outro) e devolva erro com a posição, nunca sobrescreva em silêncio.
- Tipos corretos: número como número, data como data do Excel, duração como número ou fração de dia, conforme o template; decida uma vez e documente. Teste com templates reais de clientes diferentes.

**Segurança**
- Injeção de fórmula: valor de texto que começa com `=`, `+`, `-` ou `@` é neutralizado (prefixo `'`) antes de entrar na célula.
- Upload: aceite só `.xlsx` (rejeite `.xlsm` e macros), limite o tamanho e também o tamanho descompactado e o número de entradas do arquivo (o `.xlsx` é um zip), nome gerado pelo servidor.
- O gestor só gera relatório de cliente a que pertence; o escopo vale também para colaboradores incluídos no relatório.

**Geração e envio**
- Geração pesada fora do ciclo da requisição: `202` com o estado consultável, ou streaming. Limite de linhas e timeout.
- Nome previsível (`cliente_AAAA-MM.xlsx`). Guarde o histórico do envio (quem, quando, para quem, período, hash do arquivo) e use idempotência para não enviar duas vezes. O e-mail sai depois de o arquivo estar gerado e salvo.

## Notificações em tempo real (SSE vs WebSocket)
Sugestão de ponto de partida para notificações: **SSE**. A decisão é do time.
- **SSE:** servidor → cliente sobre HTTP, reconexão automática com `Last-Event-ID`, simples no Express, funciona com o cookie de sessão. Basta para avisar "há novidade".
- **WebSocket:** bidirecional, mas exige autenticação no handshake, heartbeat e mais cuidado para escalar. Só compensa se o cliente também precisa enviar em tempo real (chat, edição colaborativa).

**Detalhes de SSE**
- Cabeçalhos `Content-Type: text/event-stream`, `Cache-Control: no-cache`. Desligue buffering e compressão no proxy (nginx: `X-Accel-Buffering: no`). Envie um comentário de heartbeat a cada 15–30 s para o proxy não derrubar a conexão ociosa.
- Autentique pela sessão (cookie). Se o front estiver em outra origem, o `EventSource` precisa de `withCredentials` e o CORS permitir credenciais. Libere recursos em `req.on('close')`.
- No HTTP/1.1 o navegador limita ~6 conexões por domínio, e cada aba abre uma. Prefira HTTP/2 no proxy ou compartilhe a conexão entre abas no front.

**Persistência e entrega**
- O evento **existe no banco** (tabela de notificações com lida/não lida); a conexão só avisa. Ao conectar ou reconectar, o front busca o que perdeu (`Last-Event-ID` ou `GET /notifications?since=`). Nunca dependa da conexão aberta para entregar.
- Cada evento vai só a quem tem permissão (use o mesmo escopo das consultas). Payload mínimo (id e tipo); o front busca o detalhe. Agrupe rajadas de eventos.
- Logout e expiração de sessão encerram a conexão.

**Vários processos**
- As conexões ficam em memória do processo. Com PM2 em cluster ou mais de uma instância, o evento precisa chegar ao processo que segura a conexão: Redis pub/sub ou Postgres `LISTEN/NOTIFY`. `LISTEN/NOTIFY` exige conexão direta ao banco, não a URL com pooler. Em processo único, um mapa em memória basta; documente a limitação.

**Testes:** reconexão, evento perdido durante a queda, várias abas, usuário sem permissão não recebe, logout fecha a conexão.
