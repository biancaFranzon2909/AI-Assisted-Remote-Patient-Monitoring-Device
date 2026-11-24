# Configuracao inicial - local

### Passo 1

1. Instalar [Node.](https://nodejs.org/en/download)
2. Abrir um terminal e executar os comandos:
   - `node -v`
   - `npm -v`
   - `choco --version`
3. Verificar os retornos dos comandos acima, para confirmar instalacao dos pacotes.

### Passo 2

1. Abrir o projeto em um gitbash dentro do editor de codigo ou nao.
2. Verificar a política de execucao de codigo no powershell como admin:

   ```bash
       Set-ExecutionPolicy Unrestricted
   ```
3. Roda `npm run local:set` : Para setar o ambiente localmente.

### Passo 3

1. `npx prisma validate` para validar os arquivos do prisma conforme a versao instalada.
2. `npx prisma generate` para gerar o cliente que o prisma usara
3. `npm run dev` roda o projeto em dev mode.

# Sobre Autenticacao

### Variáveis de autenticação

- `JWT_SECRET`: segredo para assinar/verificar JWT.
- `ACCESS_TOKEN_EXPIRES_IN`: expiração do access token (ex: `"1h"`).
- `REFRESH_TOKEN_TTL_DAYS`: expiração do refresh token em dias (ex: `30`).

### Cookies (Auth)

- O backend envia `token` e `refreshToken` via cookies `HttpOnly`.
- Para o browser enviar cookies em requisições cross-origin, o cliente precisa usar `credentials: "include"` e o backend deve manter CORS com `credentials: true`.

# Sobre "Clean Exit" no terminal ou quando.

O clean exit acontece normalmente quando o terminal n fecha corretamente e o processo, no VScode, continua ativo.
Usar: `taskkill /F /IM node.exe`, no terminal powershell

# Atualizando o do projeto e dependencias com seguranca

O projeto usa ncu (npm-check-updates) que procura e escreve as versoes, no package.json, a serem instaladas.

1. Verificar se o chocolatey ainda esta corretamente instalado: `choco --version`
2. Rodar os seguintes comando separadamente, no terminal bash de preferencia:
   - `choco upgrade chocolatey`
   - `choco upgrade nodejs -y`
   - `npm run global:upgrade`

   Com isso teremos o runtime local atualizado.

3. Agora atualizamos a pasta do projeto: `npm run local:upgrade`

Tudo pronto!! Agora todas as dependencias relacionadas ao projeto estao atualizadas.

# Organizando as Branches

Para manter sincronizado as branches locais e as remotas podemos fazer o seguinte:

- `git checkout dev` - Iremos para a branch principal
- `git fetch -p` - Sincronizamos o repo remoto e local usando a flag "prune", limpando as referencias das branches remotas ja excluidas
- `git branch -vv | grep ': gone]' | awk '{print $1}' | xargs git branch -d` - Excluir do repositorio local as branches que foram marcadas como excluidas.

obs: nao obtendo branches a serem excluidas o terminal retorna um erro. 
 
- `git pull --rebase` - Realizar o pull normalmente. 

## Para maiores de datalhes sobre autenticacao e documentacao do modelo de dados do banco acesse a pasta '/documentation'


# Arquitetura — Entidades

Cada domínio de negócio vive em `src/entities/<entidade>/` com três arquivos:

```
src/
├── lib/
│   └── AppError.ts                   ← erro de domínio reutilizável
│   └── TimeStamps.ts                 ← utilitário de datas/timezone
└── entities/
    └── <entidade>/
        ├── <entidade>.dto.ts         ← interfaces de entrada (DTOs) e saída
        ├── <entidade>.service.ts     ← toda a lógica de negócio e acesso ao banco
        └── <entidade>.controller.ts  ← apenas req/res, delega ao service
```

### Responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `.dto.ts` | Interfaces TypeScript de entrada (`CreateXDTO`, `UpdateXDTO`, etc.) e tipos de retorno |
| `.service.ts` | Validações de negócio, queries Prisma, lança `AppError` para erros esperados |
| `.controller.ts` | Extrai dados do `req`, chama o service, responde com `res`, usa `errorHandler` |

### Regra de erro

- **Erros de domínio** (ex: "não encontrado", "permissão negada"): `throw new AppError(message, statusCode)` no service.
- **Erros inesperados**: deixa propagar — o `errorHandler` no controller loga e retorna 500.
- **Nunca** usar `try/catch` genérico no controller para esconder erros de negócio.

### Entidades migradas

- `entities/atividades/`
- `entities/auth/`
- `entities/clientes/`
- `entities/colaboradores/`
- `entities/dashboard/`
- `entities/despesas/`
- `entities/projetos/`
- `entities/relatorios/`
- `entities/usuarios/`
llll