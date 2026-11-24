# ChronoTracker Frontend — guia para agentes de IA

Este repositório contém o front-end do ChronoTracker. Confirme os detalhes no código e consulte `.github/skills/mapa-do-projeto/SKILL.md` quando precisar do mapa de telas, componentes ou integrações.

## Stack verificada
- React `^19.2.8`, TypeScript `^6.0.3`, React Router DOM `^7.18.3`, Vite `^8.2.2` e Tailwind CSS `^4.3.3` (`package.json`).
- UI baseada em componentes locais em `src/components/ui/`, configurados em `components.json`; primitives usam principalmente `radix-ui`, com Combobox de `@base-ui/react`.
- Formulários usam `react-hook-form`, `@hookform/resolvers` e importam Zod; Zod não está declarado diretamente em `package.json`.
- Dados são requisitados por `fetch` via `src/lib/api-client.ts`; não há biblioteca de cache/estado de servidor declarada.
- `npm` e `package-lock.json`; sem workspaces. Este checkout não contém o back-end.

## Estrutura e padrões
- Rotas em `src/App.tsx`; páginas em `src/pages/`; layout/sidebar em `src/layout.tsx` e `src/components/app-sidebar.tsx`.
- Componentes específicos por domínio em `src/components/<domínio>/`; primitives compartilhadas em `src/components/ui/`; contexts em `src/contexts/`; hooks em `src/hooks/`; API/utilitários em `src/lib/`.
- Alias `@/*` aponta para `src/*` (`tsconfig.app.json`, `vite.config.ts`). Siga os nomes existentes, inclusive arquivos legados em camelCase e variações.
- Referências: listagem `src/pages/Clients.tsx`; tabela `src/components/data-table.tsx`; formulário/schema `src/components/projects/addProjectModal.tsx` e `src/components/projects/addProjectUtils.ts`; sessão `src/contexts/auth-context.tsx`; cliente HTTP `src/lib/api-client.ts`; tema `src/index.css`.
- Sessão consulta `/auth/me`; `AuthProvider` está no topo da aplicação. Não há componente `ProtectedRoute` no código encontrado.

## Scripts
Confira `package.json`: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` e `npm run preview`. Não existe script `test` nem testes/configuração de runner versionados; não afirme que testes passaram nem instale infraestrutura sem aprovação.

## Princípios
- Leia antes de escrever; encontre e siga um exemplo existente. Não introduza biblioteca ou convenção sem combinar.
- Reaproveite componentes e tokens do tema; evite cores hexadecimais e estilos soltos quando houver alternativa existente.
- Considere estados de carregamento, vazio, erro, sucesso e ausência de permissão, de acordo com o fluxo.
- Acessibilidade por teclado, foco visível, rótulos e contraste são requisitos.
- Mantenha a mudança pequena; não reformate arquivos fora do escopo.
- Textos de interface em pt-BR; nomes e identificadores seguem o idioma usado no código.
- Pergunte quando uma regra de negócio ou decisão pendente mudar o resultado.

## Agentes de interface
- Para tela ou feature nova: `design-ux` → `implementador-front` → `a11y-qualidade` → `testes-front` → `revisor-front`.
- Para bug visual pequeno: `implementador-front` → `revisor-front`. Para telas/componentes, use `orquestrador` como ponto de entrada quando disponível.

## Definição de pronto (front)
- Usa componentes e tokens existentes, sem dependência nova não combinada.
- Estados aplicáveis tratados; funciona por teclado, com foco visível e nomes acessíveis para botões de ícone.
- Layout sem rolagem horizontal em 320, 768 e 1280 px; claro e escuro.
- Formulários validados com Zod e mensagens pt-BR junto ao campo.
- Sem `any`, `console.log` ou código comentado novo.
- Rode lint, typecheck e testes relacionados somente quando existirem; não declare testes inexistentes como aprovados.

## Regras
- Leia instruções aplicáveis em `.github/instructions/` antes de editar. Use o padrão existente e mantenha mudanças focadas.
- Não altere o contrato do back-end externo por suposição; documente endpoints e formatos somente quando observados no front e sinalize decisões que dependam do back-end.
- Prefira tokens CSS semânticos existentes em `src/index.css`, primitives compartilhadas e textos pt-BR. Preserve claro/escuro e acessibilidade por teclado.
- Não adicione dependências nem invente regras de negócio. Em caso de dúvida que afete o resultado, pergunte.
- Nunca exponha segredos, dados pessoais ou tokens em código, logs ou documentação.
- Antes de concluir uma mudança de código, rode lint, typecheck e validação relacionada que exista no repositório; não execute build, instalação ou testes para tarefas que os proíbam.
