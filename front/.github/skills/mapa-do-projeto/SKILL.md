---
name: mapa-do-projeto
description: Mapa verificado do front-end ChronoTracker — telas, rotas, componentes, hooks, tema e integração com a API externa. Use ao localizar padrões antes de implementar ou revisar.
---

# Mapa do projeto ChronoTracker

Este repositório é o front-end (React/Vite); o back-end não está neste checkout. Confirme contratos no código antes de assumir semântica que depende do servidor.

## Stack e scripts verificados
- `package.json`: React `^19.2.8`, React Router DOM `^7.18.3`, TypeScript `^6.0.3`, Vite `^8.2.2`, Tailwind CSS `^4.3.3`.
- Formulários/tabelas: React Hook Form `^7.87.0`, `@hookform/resolvers` `^5.9.1`, TanStack React Table `^9.2.4`; Zod é importado no código, mas não aparece como dependência direta do manifesto.
- UI/dados: `shadcn` `^4.20.1`, `radix-ui` `^1.6.7`, `@base-ui/react` `^1.7.0`, Sonner `^2.0.8`, Lucide `^1.40.0`, date-fns `^4.4.0`, Recharts `^3.10.1`, `tw-animate-css` `^1.4.0`.
- Gerenciador `npm` com `package-lock.json`, sem workspaces. Scripts: `dev`, `build`, `lint`, `format`, `typecheck`, `preview`; não há `test`.

## Organização
- `src/App.tsx`: BrowserRouter, providers de autenticação/workspace e rotas.
- `src/pages/`: telas; `src/components/<domínio>/`: componentes por domínio.
- `src/components/ui/`: primitives e composições compartilhadas; `src/components/`: componentes compartilhados da aplicação.
- `src/contexts/`: sessão e workspace; `src/hooks/`: hooks; `src/lib/`: API e utilitários; `src/index.css`: Tailwind e tema.
- Alias `@/` → `src/`, em `tsconfig.app.json` e `vite.config.ts`.
- Não há backend, diretório `src/entities`, testes/configuração de teste ou script `test` neste checkout.

## Rotas e telas
Definidas em `src/App.tsx`:
- Sem `Layout`: `/login`, `/companies`, `/password_reset`.
- Sob `Layout`: `/` (Dashboard), `/timesheet`, `/timesheet/:id`, `/employees`, `/employees/:id`, `/clients`, `/clients/:id`, `/projects`, `/projects/:id`, `/activities`, `/activities/:id`, `/expenses`, `/reports`, `/administrativo`, `/profile`.
- `Layout` (`src/layout.tsx`) renderiza `AppSidebar` e `Outlet`. `AuthProvider` usa `/auth/me`; não existe componente dedicado `ProtectedRoute` no código localizado.

## Componentes compartilhados do app
- `PageHeader` (`page-header.tsx`): cabeçalho de página com título/subtítulo e ações.
- `DataTable` (`data-table.tsx`): tabela TanStack com filtro, ordenação, seleção e paginação. Exemplo de listagem: `pages/Clients.tsx`; colunas ficam nas pastas de domínio.
- `AppSidebar` (`app-sidebar.tsx`): navegação e shell do app.
- `EmptyComp` e `IncompleteSection` (`empty-comp.tsx`, `incomplete-section.tsx`): estados vazios/seções incompletas.
- `DeleteDialogGeral` (`delete-dialog-geral.tsx`): confirmação/exclusão via endpoint.
- `SeletorSearchBar` (`seletor-search-bar.tsx`): seletor pesquisável; `WorkspaceModal` (`workspace-modal.tsx`): seleção/gestão de workspace.
- `AppNotificationMenu`, `PasswordRequirements`, `StepIndicator`: notificações, requisitos de senha e progresso em etapas.
- `ThemeProvider` (`theme-provider.tsx`): tema claro/escuro/sistema.

## Primitives de `src/components/ui/`
Use a primitive existente antes de criar uma nova. A pasta contém:
- **Ações e status:** `button`, `button-group`, `badge`, `toggle`, `toggle-group`, `progress`, `spinner`, `skeleton`.
- **Superfícies e conteúdo:** `accordion` (conteúdo expansível), `card`, `item`, `empty`, `alert`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`.
- **Formulários e entrada:** `field`, `form`, `label`, `input`, `input-group`, `textarea`, `native-select`, `select`, `combobox`, `checkbox`, `radio-group`, `switch`, `slider`, `input-otp`, `calendar`.
- **Navegação e coleção:** `breadcrumb`, `navigation-menu`, `pagination`, `sidebar`, `tabs`, `menubar`.
- **Menus e sobreposições:** `dialog`, `alert-dialog`, `drawer`, `sheet`, `popover`, `tooltip`, `hover-card`, `dropdown-menu`, `context-menu`, `command`, `collapsible`, `direction`.
- **Dados e mídia:** `table`, `chart`, `carousel`, `avatar`, `kbd`, `icon-button-tooltip`, `sonner`.
- Implementações usam principalmente `radix-ui`; `combobox.tsx` usa `@base-ui/react`. Consulte cada arquivo para a API local; `components.json` não declara uma única base para todos.

## Hooks, contexts e utilitários
- `useAuth` (`contexts/auth-context.tsx`): usuário, carregamento, login/logout e `/auth/me`.
- `useWorkspace` (`contexts/workspace-context.tsx`): lista e troca do workspace selecionado.
- `useTimer` (`hooks/use-timer.tsx`): timer local com persistência em `localStorage` e sincronização por evento `storage`; não é persistido no servidor.
- `useMobile` e `useClipboard` (`hooks/use-mobile.ts`, `use-clipboard.ts`).
- `apiFetch` / `apiFetchRaw` (`lib/api-client.ts`): requisições, cookies, header do workspace e tentativa de refresh 401; resposta tipada como `Resp` (`error`, `message`, `data?`).
- `cn`, cookies e workspace (`lib/utils.ts`); status de projeto em `statusProjetoMap`.
- Datas usam `date-fns`; moeda VHC em centavos é formatada por `formatVhc` (`components/administrative/types.ts`). Há formatações locais em telas, então confira o exemplo específico antes de generalizar.

## Design system
- Tokens CSS semânticos light/dark em `src/index.css`: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-*` e `sidebar-*`.
- Fontes: Noto Sans Variable (`--font-sans`) e Nunito Sans Variable (`--font-heading`). Raio base `--radius: 0.875rem`, com escala `--radius-sm` a `--radius-4xl`.
- Tema aplicado como classe `.light`/`.dark` na raiz; `ThemeProvider` usa cookie e preferência do sistema. `Toaster` Sonner global em `src/main.tsx`.

## Formulários, requisições e exemplos
- Schema + RHF/Zod: `components/projects/addProjectModal.tsx` + `components/projects/addProjectUtils.ts`; também `activities/addActivitieModal.tsx` + `addActivityUtils.ts` e `employees/inviteEmployee.tsx` + `inviteEmployeeUtils.tsx`.
- API: `lib/api-client.ts`; módulo administrativo: `components/administrative/administrative-api.ts`.
- Exemplos de endpoints observados: auth (`/auth/login`, `/auth/me`, `/auth/logout`, `/auth/refresh-token`); clientes (`/clientes/list`, `/clientes/create`); projetos (`/projetos/list`, `/projetos/create`, `/projetos/edit/:id`); lançamentos (`/lancamentos/list`, `/lancamentos/new-info`); despesas (`/despesas/create`, `/despesas/lancamentos/dia`); administrativo (`/administrativo/list`, `/administrativo/create`). Essa lista é exemplificativa, não um inventário completo do contrato.
- Resposta HTTP normalizada por `apiFetch`: `{ error, message, data? }`. Falhas de rede também viram `error: true`. UI costuma notificar com Sonner; revise a tela e não silencie erro.
- Carregamento e erro são tratados localmente por telas, sem camada de dados/cache uniforme. `Clients.tsx` usa `DataTable` e filtro de status; não inferir que todas as telas têm os mesmos estados.

## Domínio visível no front
- Entidades/telas: clientes, projetos, atividades, colaboradores, lançamentos de horas, despesas, relatórios, calendário e equipe administrativa.
- Papéis administrativos tipados: `OWNER`, `ADMIN`, `COLAB` (`components/administrative/types.ts`); calendário: `FERIAS`, `FALTA`, `EVENTO`.
- Status de projeto em `lib/utils.ts`: `EmEspera`, `Orcando`, `EmAndamento`, `Finalizado`, `Cancelado`. Status de lançamento inclui `status_aprovacao` no detalhe, mas não há enum completo confirmado neste front.
- Não deduza estados de aprovação de despesas nem regras de negócio não tipadas/documentadas no código; o servidor é externo.

## Lacunas verificadas
- Não foram localizados testes, configuração de runner, workflow de CI versionado ou scripts de teste; `package.json` fornece `dev`, `build`, `lint`, `typecheck`, `preview`.
- O front importa Zod (`src/components/projects/addProjectUtils.ts`, entre outros), mas o manifesto atual não o declara como dependência direta.
- A skill `ux-controle-de-horas-e-despesas` descreve boas práticas (por exemplo, persistência de timer no servidor e valores de despesas em centavos); não as trate como comportamento existente. `use-timer.tsx` persiste localmente e `components/expenses/colums.tsx` formata o valor manualmente.
- Sem fontes aqui para confirmar schema de banco, arquitetura interna do backend, contratos completos, CI/hospedagem, autorização real, fusos e fluxos completos de despesas.
