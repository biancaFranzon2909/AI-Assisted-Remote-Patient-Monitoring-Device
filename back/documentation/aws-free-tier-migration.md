# Plano de migracao para AWS Free Tier

## Objetivo

Hospedar inicialmente a API ChronoTracker e seu banco PostgreSQL na AWS, controlando custos e preservando a possibilidade de crescer sem alterar a arquitetura da aplicacao.

Arquitetura inicial:

```text
Frontend -> HTTPS (Nginx ou Caddy na EC2) -> API Express/Prisma -> RDS PostgreSQL privado
```

O backend ja possui `npm run build`, `npm start`, migrations Prisma e o endpoint `GET /health`. O schema Prisma utiliza PostgreSQL, portanto e compativel com Amazon RDS for PostgreSQL.

## Antes de provisionar

1. Criar um AWS Budget mensal com alertas em US$ 5 e US$ 10.
2. Verificar os beneficios Free Tier disponiveis para a conta. A elegibilidade e a duracao podem variar conforme a data de criacao da conta e o tipo de recurso.
3. Escolher uma unica regiao AWS proxima dos usuarios e criar todos os recursos nela.
4. Registrar o estado atual do banco com um dump logico:

```powershell
pg_dump --format=custom --file=chronotracker-pre-migracao.dump "$env:DATABASE_URL"
```

5. Nunca usar `prisma migrate dev` em producao. A aplicacao das migrations em deploy deve usar `npx prisma migrate deploy`.

## Recursos iniciais

### EC2

1. Criar uma instancia Linux elegivel ao Free Tier. Prefira uma familia x86, como `t3.micro`, para evitar complexidade com o modulo nativo `argon2`.
2. Criar um security group que permita:
   - `80` e `443` de qualquer origem;
   - `22` somente do IP administrativo, ou preferencialmente acesso via AWS Systems Manager;
   - nao expor a porta `8080` publicamente.
3. Associar IP publico somente se necessario. IPv4 publico pode ter cobranca mesmo quando a instancia e elegivel ao Free Tier.
4. Instalar Docker e Docker Compose Plugin na instancia.

### RDS PostgreSQL

1. Criar uma instancia RDS PostgreSQL elegivel ao Free Tier, em Single-AZ e com armazenamento minimo.
2. Desabilitar acesso publico.
3. Associar um security group que permita `5432` apenas a partir do security group da EC2.
4. Habilitar backups automaticos e definir a menor retencao que atenda a operacao.
5. Criar um usuario de aplicacao sem privilegios administrativos.

## Compatibilidade Prisma

O cliente atual usa `@prisma/adapter-neon`, que e especifico para Neon. Antes de conectar ao RDS, substituir este adaptador por `@prisma/adapter-pg`, pois o pacote `pg` ja esta presente no projeto.

Variaveis obrigatorias no ambiente de producao:

```env
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_RDS:5432/chronotracker?schema=public
JWT_SECRET=segredo-com-pelo-menos-32-caracteres
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_TTL_DAYS=30
```

Guardar os valores em AWS Systems Manager Parameter Store ou AWS Secrets Manager. Nao enviar arquivos `.env` ao repositorio ou a imagens Docker.

## Migracao dos dados

1. Criar o banco no RDS e validar conectividade a partir da EC2.
2. Aplicar o historico do schema:

```powershell
npx prisma migrate deploy
```

3. Restaurar uma copia inicial para validar o processo:

```powershell
pg_restore --clean --if-exists --no-owner --dbname "$env:RDS_DATABASE_URL" chronotracker-pre-migracao.dump
```

4. Comparar contagens das tabelas principais entre a origem e o RDS.
5. No corte definitivo, colocar o ambiente atual em manutencao ou interromper gravacoes, gerar um dump final, restaurar no RDS e rodar `npx prisma migrate deploy` novamente.

## Deploy e validacao

1. Construir a imagem Docker da API em arquitetura x86.
2. Executar `npx prisma generate`, `npm run build` e `npx prisma migrate deploy` durante o processo de entrega.
3. Publicar a API atras de Nginx ou Caddy, com TLS e encaminhamento para `localhost:8080`.
4. Atualizar a origem permitida em `src/config/app.ts` caso o dominio do frontend seja alterado.
5. Validar pelo menos:
   - `GET /health`;
   - login e renovacao de token;
   - criacao e consulta de lancamentos;
   - relatorios;
   - acesso isolado por empresa.

## Rollback

1. Manter o ambiente e o banco anteriores disponiveis durante a janela de estabilizacao.
2. Preservar o dump criado antes do corte e validar que ele pode ser restaurado.
3. Em falha, restaurar a URL anterior da API no frontend e reabrir gravacoes somente no banco anterior.
4. Nao executar migrations destrutivas sem backup validado e plano de reversao correspondente.

## Custos a acompanhar

- Horas e tipo da EC2 e do RDS.
- Armazenamento, snapshots e retencao de backups RDS.
- IPv4 publico, transferencia de dados e logs no CloudWatch.
- Servicos que nao fazem parte da arquitetura inicial, especialmente load balancer, NAT Gateway, EKS e Secrets Manager, pois podem gerar custo fora do Free Tier.