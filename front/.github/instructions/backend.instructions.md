---
applyTo: "src/lib/api-client.ts,src/components/administrative/administrative-api.ts"
---

# Integração com a API externa

Este checkout contém o front-end, não o back-end nem suas entidades, DTOs, Services, Controllers ou schema de banco. A integração HTTP compartilhada está em `src/lib/api-client.ts`; a API do calendário administrativo é organizada em `src/components/administrative/administrative-api.ts`.

- Preserve os endpoints e o formato observados no cliente; alterações de contrato dependem da equipe/repositório do back-end.
- `apiFetch` retorna `{ error, message, data? }`; `apiFetchRaw` expõe `Response`. O cliente inclui credenciais, pode acrescentar `X-Workspace-Id` e tenta renovar sessão em respostas 401.
- Trate `error` explicitamente e mostre feedback ao usuário com os padrões existentes. Não transforme falhas em sucesso ou dados inventados.
- Validação e autorização precisam existir no servidor externo; interface não é controle de acesso.
- Tipos locais registram apenas os dados usados pelo front. Não deduza do cliente decisões de banco, fuso, regra de aprovação ou implementação interna do servidor.
