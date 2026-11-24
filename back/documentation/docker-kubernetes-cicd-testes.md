# Docker, Kubernetes e CI/CD com ambiente de teste isolado

## Decisao de arquitetura

Docker deve ser usado desde o inicio para tornar o build e a execucao identicos em desenvolvimento, CI e producao. Kubernetes deve ser introduzido para padronizar deploy e isolamento de ambientes, mas um cluster EKS nao e recomendado na fase Free Tier: ele acrescenta custo e operacao. Para producao inicial, use Docker Compose na EC2; valide os manifests Kubernetes localmente com Kind ou Minikube e adote um cluster gerenciado apenas quando a necessidade justificar.

O fluxo proposto e:

```text
pull request -> lint/build/test -> imagem Docker -> deploy ambiente teste -> smoke test
main -> imagem Docker versionada -> aprovacao -> migration -> deploy producao
```

## 1. Criar uma imagem Docker da API

1. Adicionar um `Dockerfile` multi-stage baseado em Node LTS x86.
2. Na etapa de build, copiar arquivos de dependencias, executar `npm ci`, copiar o codigo e executar:

```powershell
npx prisma generate
npm run build
```

3. Na etapa final, copiar apenas `dist`, `node_modules` de producao e os arquivos Prisma necessarios para migrations.
4. Executar a aplicacao com:

```powershell
npm start
```

5. Criar `.dockerignore` incluindo `node_modules`, `dist`, `.git`, `.env`, `.env.local`, dumps e relatorios gerados.
6. Fazer build e teste local:

```powershell
docker build --tag chronotracker-api:local .
docker run --rm --env-file .env -p 8080:8080 chronotracker-api:local
```

Em outro terminal, validar `http://localhost:8080/health`.

## 2. Criar ambiente local de integracao

1. Criar um `compose.yaml` com dois servicos: `api` e `postgres`.
2. Usar volume nomeado somente para o banco local.
3. Fornecer `DATABASE_URL` da rede Docker, por exemplo:

```env
DATABASE_URL=postgresql://chronotracker:senha-local@postgres:5432/chronotracker_test?schema=public
```

4. Nunca usar a URL do RDS em testes locais ou no CI.
5. Subir a stack:

```powershell
docker compose up --build --wait
```

6. Aplicar migrations no banco do Compose com `npx prisma migrate deploy` antes de executar testes de integracao.
7. Encerrar e limpar o ambiente de teste com:

```powershell
docker compose down --volumes
```

## 3. Definir isolamento de testes

O teste precisa de banco, segredo JWT e dados exclusivos. Cada execucao de CI deve criar seu proprio banco PostgreSQL efemero, aplicar migrations, executar testes e descartar os dados ao final.

Variaveis de teste recomendadas:

```env
NODE_ENV=test
JWT_SECRET=teste-com-mais-de-32-caracteres
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=1
DATABASE_URL=postgresql://chronotracker:senha-local@postgres:5432/chronotracker_test?schema=public
```

Regras:

- Nunca compartilhar banco de teste com homologacao ou producao.
- Cada suite deve limpar ou recriar seus dados antes da execucao.
- Dados de teste devem pertencer a empresas de teste distintas para exercitar o isolamento multi-tenant.
- O pipeline deve falhar caso migrations, build, testes ou `GET /health` falhem.

## 4. Estruturar Kubernetes

Manter manifests em uma pasta propria, por exemplo:

```text
k8s/
  base/
    deployment.yaml
    service.yaml
    configmap.yaml
    secret.example.yaml
  overlays/
    test/
    production/
```

Use Kustomize para evitar duplicar configuracoes. O `base` contem a configuracao comum; cada `overlay` declara imagem, host, replicas, limites e referencias de segredo do seu ambiente.

### Recursos minimos

1. `Deployment`: executa a imagem da API, com `readinessProbe` e `livenessProbe` em `/health`.
2. `Service` `ClusterIP`: expoe a porta `8080` apenas dentro do cluster.
3. `Ingress`: recebe trafego externo e encaminha para o Service. Usar somente quando o cluster tiver um controlador de Ingress.
4. `ConfigMap`: valores nao sensiveis, como `NODE_ENV`, `PORT` e TTLs.
5. `Secret`: `DATABASE_URL` e `JWT_SECRET`. O manifesto real de segredo nao deve ser versionado.
6. `Resource requests` e `limits`: evitar que um pod consuma recursos de outro ambiente.

Exemplo de criterios de probe:

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 15
```

## 5. Isolar homologacao com namespace

1. Criar namespace `chronotracker-test` e namespace `chronotracker-production`.
2. Usar um banco PostgreSQL exclusivo para cada ambiente. No RDS, isso significa pelo menos bancos diferentes e usuarios distintos; para isolamento mais forte, instancias distintas.
3. Criar Secrets diferentes por namespace.
4. Aplicar `ResourceQuota` e `LimitRange` no namespace de teste.
5. Criar `NetworkPolicy` para permitir que a API de teste se comunique somente com o banco e servicos necessarios daquele ambiente.
6. Nunca usar secrets, nomes de host ou dados de producao no overlay de teste.

Para ambientes efemeros por pull request, o pipeline pode criar um namespace `chronotracker-pr-<numero>`, um banco temporario, aplicar o overlay, testar e remover ambos ao fechar o pull request. Comecar com um unico ambiente de teste permanente reduz custo e complexidade.

## 6. Pipeline de CI/CD

O provedor pode ser GitHub Actions, GitLab CI ou outro equivalente. O comportamento esperado e o seguinte:

### Pull requests

1. Fazer checkout do codigo.
2. Instalar dependencias com `npm ci`.
3. Executar `npx prisma generate`.
4. Executar `npm run build`.
5. Subir PostgreSQL efemero com Docker Compose ou service container.
6. Executar `npx prisma migrate deploy` apontando para o banco efemero.
7. Executar testes unitarios e de integracao quando estiverem presentes.
8. Construir a imagem Docker e executar um container para smoke test em `/health`.
9. Publicar a imagem somente quando a politica do repositorio permitir.

### Branch principal

1. Repetir todas as validacoes de pull request.
2. Gerar uma tag imutavel, preferencialmente com o SHA do commit.
3. Publicar a imagem no registry, como Amazon ECR.
4. Atualizar somente a tag da imagem no overlay de teste.
5. Aplicar migrations do ambiente de teste como um Job Kubernetes unico.
6. Executar o deploy e aguardar o rollout:

```powershell
kubectl rollout status deployment/chronotracker-api --namespace chronotracker-test
```

7. Executar smoke tests contra a URL de teste.
8. Exigir aprovacao manual antes de repetir migrations e deploy em producao.

## 7. Migrations em Kubernetes

Nao executar migrations no inicio de todos os pods: replicas concorrentes podem competir entre si. Criar um `Job` de migration que rode uma unica vez por release:

```powershell
npx prisma migrate deploy
```

O Job deve usar o Secret `DATABASE_URL` do namespace correspondente. O deploy da API acontece somente depois de o Job concluir com sucesso.

## 8. Segredos e acesso AWS

1. O CI deve obter credenciais AWS por OIDC, sem salvar chaves de acesso de longa duracao no provedor de CI.
2. Conceder ao papel do pipeline apenas permissoes para publicar no ECR e fazer deploy no ambiente-alvo.
3. Usar SSM Parameter Store ou Secrets Manager para valores de ambiente em AWS.
4. No cluster, sincronizar segredos por mecanismo controlado; nunca registrar valores reais em YAML, logs ou artefatos de build.

## 9. Sequencia de adocao recomendada

1. Criar Dockerfile e Docker Compose local.
2. Validar build, migrations e health check em container.
3. Adicionar CI para build e banco PostgreSQL efemero.
4. Criar e testar manifests no Kind ou Minikube.
5. Criar ambiente de homologacao com banco e segredos separados.
6. Adotar Kubernetes gerenciado somente quando replicas, disponibilidade, deploys frequentes ou isolamento adicional compensarem o custo operacional e financeiro.