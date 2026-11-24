---
name: ux-controle-de-horas-e-despesas
description: Conhecimento de domínio e UX para telas de controle de horas (timers, lançamentos, relatórios) e de despesas corporativas (valores em BRL, comprovantes, aprovação). Use ao projetar ou implementar essas telas.
---

# UX de controle de horas e despesas

## Duração e horas
- Guarde duração em **minutos inteiros** (ou segundos), nunca em horas decimais com `float`. Exiba como `HH:MM` com `tabular-nums`; totais por dia, semana, projeto e cliente.
- Campo de duração aceita `1:30`, `1,5`, `1.5`, `90m` e `1h30`; mostre o valor normalizado ao sair do campo. Defina e mostre a regra de arredondamento, se houver.
- Valide: máximo de 24 h por dia, sem sobreposição quando houver início e fim, sem lançamento no futuro (se a regra proibir). Períodos fechados ou aprovados ficam bloqueados **com explicação** do motivo.
- Instantes em **UTC** (`timestamptz`); exiba no fuso do usuário (`America/Sao_Paulo` por padrão). "Dia" sem horário (data de competência) é `date`, sem fuso. Defina explicitamente o primeiro dia da semana.
- Formate com `Intl.DateTimeFormat('pt-BR')`; plural correto ("1 hora", "2 horas").

## Timer
- Não confie em `setInterval` incrementando um número: ele atrasa em aba em segundo plano. Guarde `startedAt` e **derive** `agora − startedAt` a cada tick.
- O timer sobrevive a recarregar a página e a abrir outra aba: o estado vive no servidor (ou é sincronizado), não só na memória do componente.
- Parar o timer gera um lançamento editável; ofereça "descartar" e desfazer.
- Esqueceram o timer ligado? Alerte após um limite razoável de horas e permita ajustar o horário de término.

## Lançamento de horas
- Entrada rápida é o fluxo principal: teclado primeiro, projeto recente pré-selecionado, copiar do dia anterior, atalho para novo lançamento.
- Mostre o total do dia e da semana enquanto o usuário edita, e a diferença para a meta quando existir.
- Projeto, cliente e atividade em seletores com busca; itens arquivados não aparecem para novos lançamentos, mas continuam legíveis no histórico.

## Despesas
- Guarde valores em **centavos inteiros** ou `Decimal`, nunca `float`. Formate com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. O campo de valor trata digitação, colagem e vírgula/ponto.
- Comprovante: aceite imagem e PDF, informe o limite de tamanho antes do envio, mostre pré-visualização, progresso e erro com "tentar de novo"; no mobile, permita usar a câmera.
- Fluxo de status com nomes e badges consistentes (ex.: rascunho → enviada → aprovada/rejeitada → paga). Rejeição exige motivo visível ao autor. As ações disponíveis dependem do papel (colaborador, gestor, financeiro), e o back-end valida.
- Histórico/trilha de auditoria legível: quem fez, quando e o que mudou.

## Relatórios e templates enviados a clientes
- Mostre **pré-visualização** do que será enviado antes de enviar; avise campos vazios ou valores fora do esperado.
- Nome de arquivo previsível (`cliente_AAAA-MM.xlsx`). Exportações respeitam o filtro e o período mostrados na tela.
- Template por cliente: ao mapear campos do modelo, mostre exemplo real com dados de amostra e sinalize conflitos de célula antes de gerar.

## Dados pessoais (LGPD)
- Peça e mostre o mínimo necessário; não registre dados pessoais em logs; ofereça exportação e remoção conforme a política da empresa.
