---
name: integridade-horas-despesas
description: Regras de domínio e integridade para o back-end de controle de horas (timer, lançamentos, períodos fechados) e despesas (valores em BRL, comprovantes, aprovação, auditoria). Use ao modelar tabelas, escrever serviços, migrations ou consultas desse domínio.
---

# Integridade em horas e despesas

Ajuste os nomes abaixo (`TimeEntry`, status, perfis) aos do schema do projeto (`src/schema_db/*.prisma`). Os nomes reais estão na seção seguinte.

## Como está hoje no código (verificado)
- **Modelos**: `lancamento` (`src/schema_db/lancamentos.prisma`), `despesa`, `administrativo` (férias/falta/evento), `projeto`/`atividade` com `horas_previstas` e `horas_gastas`. Perfis: `OWNER`, `ADMIN`, `COLAB` (`empresaUsuarios.cargo`).
- **Tempo**: `data_lancamento` é `timestamptz`; `hora_inicio`/`hora_fim` são `@db.Time` montados como `${data}T${hora}:00Z` (UTC, sem fuso do usuário). `duracao_total` é `Float` em horas decimais, calculada no servidor a partir do início e fim (`src/entities/lancamentos/lancamentos.service.ts` `create`/`update`). Exibição em `"HH:mm"` por `TimeStamps.getWatchHour` (`src/lib/TimeStamps.ts`). Não há campo de fuso no usuário.
- **Timer**: não existe endpoint de timer nem registro "em aberto". Há só o enum `TipoLancamento` (`MANUAL`, `CRONOMETRO`); o cronômetro, se houver, é do front.
- **Lançamentos**: rejeita data futura na criação; exige `hora_fim > hora_inicio` (formato `HH:mm`, 400) em create e update; valida dentro da transação que a atividade existe, está ativa, pertence à empresa do ator (ou é compartilhada por parceria ativa) e que `projeto_id`/`cliente_id` batem com ela (`validarOrigemLancamento`: 404 ou 400); checa sobreposição do mesmo usuário no dia com `findFirst` dentro da mesma transação (sem constraint no banco; resposta `400`). Não há limite de horas por dia, período fechado, aprovação efetiva (`updateStatus` compara cargo com `"gerente"`, inexistente) nem `version`/`updatedAt`.
- **Horas consumidas**: `recalcularHorasGastas` (`src/lib/utils.ts`) faz `increment` em `atividade`/`projeto`, exige o `tx` e roda dentro da mesma `$transaction` que cria, edita ou apaga o lançamento. `limitCheck` sinaliza limite atingido (horas gastas × previstas).
- **Visibilidade (regra decidida):** `COLAB` só vê e altera os próprios lançamentos; `OWNER`/`ADMIN` veem os da empresa (`podeVerLancamentosDaEmpresa`, cargo do banco; `cargoOwner` da query é ignorado). Vale também para despesas (create/delete conferem o lançamento; listagem filtra o próprio usuário), relatórios (`colaboradores` ignorado para COLAB), `usuarios/list/:id` e `stats`, e detalhes de atividade e cliente. Divergência conhecida: `findById` de lançamento escopa por `atividade.empresa_id` e `update`/`remove` por `projeto.empresa_id`.
- **Administrativo**: `validateNoConflict` em `src/entities/administrativo/administrativo.service.ts` impede períodos sobrepostos por usuário/empresa (também sem constraint).
- **Dinheiro**: `despesa.valor` é `Float`, sem moeda; despesa pertence a um `lancamento`. **Não há** status, aprovação, comprovante/upload nem auditoria. Totais por cliente via `groupBy` em `src/entities/clientes/clientes.service.ts`.
- **Relatórios**: `src/entities/relatorios/relatorios.service.ts` carrega todos os lançamentos/despesas da empresa e filtra em JS (contraria "agregue no banco").
- Ao implementar qualquer regra abaixo que hoje não existe (timer, período fechado, status de despesa, Decimal), trate como mudança de schema com plano de migração e impacto no front.

## Tempo
- Instantes em `timestamptz` (UTC). "Dia" sem horário (data de competência) em `date`. Duração em `Int` de minutos.
- Guarde o fuso do usuário (nome IANA, como `America/Sao_Paulo`) e use-o para decidir a que dia um instante pertence e para agrupar por dia/semana (`AT TIME ZONE`). Defina e documente o primeiro dia da semana.
- **O servidor calcula a duração** (`agora − início`). Nunca confie no relógio nem na duração enviados pelo cliente, exceto em lançamento manual, validado.
- Uma regra de arredondamento, definida em um lugar só e testada.

## Timer
- No máximo **um timer ativo por usuário**, garantido no banco com índice único parcial: `CREATE UNIQUE INDEX ... ON "TimeEntry"("userId") WHERE "endedAt" IS NULL`. O Prisma pode não declarar índice parcial no schema (confira a versão): escreva em migration SQL, comente no schema e verifique que a próxima `migrate dev` não tenta removê-lo.
- `start` é idempotente: com timer já ativo, devolve o ativo (ou `409`), nunca cria um segundo. `stop` também é idempotente.
- Timer esquecido: limite máximo configurável, alerta e correção do horário de término com trilha de auditoria.

## Lançamentos
- Limite de horas por dia (ex.: 24 h) validado **dentro da transação**, somando no banco com `aggregate`.
- Sobreposição de intervalos do mesmo usuário: prefira constraint de exclusão (`EXCLUDE USING gist` com `tstzrange` e `btree_gist`, em migration SQL; confirme que a extensão está disponível no Neon). Sem isso, verifique dentro de uma transação com bloqueio da linha ou do usuário.
- Data futura, retroativa além do prazo e período fechado seguem a regra do negócio e respondem `409` com `code` estável e motivo legível (`PERIODO_FECHADO`).
- **Período fechado ou aprovado é imutável.** Reabrir é ação privilegiada, auditada.
- Edição concorrente: `version` ou `updatedAt` → `409` se desatualizado.

## Dinheiro
- `Decimal` (`@db.Decimal(12, 2)`) ou `Int` em centavos; moeda explícita (BRL). Cálculo com `Decimal`, nunca `Number`/`Float`. Arredondamento definido e testado (ex.: rateio que não fecha centavos).
- No JSON, centavos inteiros ou string decimal.

## Despesas: máquina de estados
- Estados explícitos (ex.: rascunho → enviada → aprovada | rejeitada → paga) e **tabela de transições** por perfil, centralizada no Service. Transição inválida → `409`.
- Rejeição exige motivo, visível ao autor.
- **Transição atômica:** `updateMany({ where: { id, status: 'ENVIADA' }, data: { status: 'APROVADA', ... } })` e confira `count === 1`; assim dois aprovadores simultâneos não geram dois efeitos.
- Cada transição grava um evento de auditoria (quem, quando, de → para, motivo) **na mesma transação**. A tabela de auditoria só recebe inserções.
- Pagamento e e-mails disparam **depois** do commit, idempotentes.

## Comprovantes
- Aceite só tipos permitidos (valide pelo conteúdo) e tamanho máximo; nome gerado pelo servidor; guarde a **chave** do objeto, não URL pública; entregue por URL assinada de curta duração; storage privado.
- Excluir despesa não apaga o histórico de auditoria; use exclusão lógica.

## Consultas e relatórios
- Agregue no banco (`groupBy`, `aggregate` ou SQL com `SUM`), por período, com índices como `(userId, date)` e `(projectId, date)`. Não carregue linhas para somar em JS.
- Toda consulta leva o escopo do ator (usuário, cliente ou espaço de parceiro). Em relatório por cliente, confirme que o gestor pertence àquele cliente.
- Totais e exportações respeitam o mesmo filtro e período que a tela mostra.
