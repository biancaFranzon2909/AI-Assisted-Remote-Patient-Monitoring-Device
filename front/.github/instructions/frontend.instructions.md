---
applyTo: "src/**/*.tsx,src/hooks/**/*.ts"
---

# Front-end: React, TypeScript e dados

## React
- Derive valores durante o render em vez de sincronizar estado com `useEffect`. Use efeito só para falar com sistemas externos (timers, assinaturas, APIs do navegador).
- Mantenha o estado perto de quem o usa; só suba quando dois irmãos precisarem. Prefira composição (`children`, slots) a prop drilling; reserve Context para dados estáveis (auth, tema).
- `key` estável (id do dado), nunca o índice em listas que mudam.
- Componentes pequenos, com uma responsabilidade; lógica reutilizável vira hook `useX`.
- `useMemo`/`useCallback`/`memo` só quando houver problema medido (React Profiler) ou dependência que exija identidade estável.

## TypeScript
- Sem `any`. Use `unknown` e estreite o tipo. Não use `as` para calar erro.
- Tipos de formulário vêm do schema: `z.infer<typeof schema>`.
- Estados assíncronos como união discriminada (`{ status: 'loading' } | { status: 'error'; error } | { status: 'success'; data }`) em vez de vários booleanos.

## Rotas e navegação
- Use `useLocation`, `useNavigate` e `NavLink` do React Router. Nunca `window.location` para saber a rota ativa.
- Estado compartilhável (filtros, aba, página, busca) vai em search params, para o link e o botão voltar funcionarem.
- O código atual configura as rotas em `src/App.tsx` e monta `AuthProvider`; não há `ProtectedRoute` dedicado. Não invente uma proteção existente nem altere o fluxo de sessão sem verificar as rotas e os contextos.
- Carregue rotas com `React.lazy` + `Suspense` quando a tela for pesada.
- Se só a home funciona em produção, suspeite do fallback de SPA (rewrite de `/*` para `index.html`) no host.

## Dados e requisições
- O front usa `fetch` centralizado em `src/lib/api-client.ts`, sem biblioteca de cache/estado de servidor declarada. Siga o mecanismo existente; não adicione biblioteca de dados sem combinar.
- Toda requisição tem estados de carregando, erro e vazio. Cancele com `AbortController` quando o componente desmontar ou a busca mudar.
- Evite cascata (waterfall): dispare requisições independentes em paralelo.
- Mutação: desabilite o botão durante o envio, confirme com toast e, se for atualização otimista, faça rollback no erro.
- Busca digitada: debounce em torno de 300 ms.

## Desempenho (metas Core Web Vitals)
- LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
- Imagens com `width`/`height` (ou `aspect-ratio`) para evitar salto de layout.
- Listas com mais de ~100 itens: paginar ou virtualizar.
- Não importe biblioteca inteira para usar uma função; confira o impacto no bundle.

## Robustez e segurança
- `ErrorBoundary` por rota, com mensagem humana e ação de recuperar. Nunca exibir stack trace.
- Não use `dangerouslySetInnerHTML` com conteúdo de usuário sem sanitizar.
- A sessão é cookie: não guarde token em `localStorage`.
- Verificação de permissão no front é só UX; o back-end é a fonte da verdade.

## Organização
- Schema Zod e utilitários do formulário ficam ao lado dele (ex.: `addProjectUtils.ts`).
- Componente em PascalCase; hook em `useCamelCase`; um componente exportado por arquivo, salvo subcomponentes privados.
