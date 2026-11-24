---
description: Planeja uma mudança de banco (schema e migration) com ordem de deploy, backfill e rollback, sem alterar arquivos
agent: arquiteto-api
---

Mudança desejada: ${input:mudanca:Descreva a mudança no banco}

Entregue **somente o plano**, sem editar arquivos: modelo antes e depois; migration em etapas (expandir → backfill → contrair); SQL manual necessário (índice parcial, constraint de exclusão, `CONCURRENTLY`); bloqueios e impacto pelo volume de linhas; ordem de deploy entre back e front e compatibilidade com a versão anterior do app; validação em homologação (inclusive em branch do banco, se o Neon permitir); plano de rollback e riscos.

Lembre que o deploy roda `prisma migrate deploy`: a mudança só chega a homologação e produção se estiver em migration versionada. Se faltar dado (volume de linhas, regra de negócio), pergunte antes de planejar.
