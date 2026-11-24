# Duvidas sobre Docker, IaC, GitHub Actions e Kubernetes

Este documento responde as duvidas sobre o papel de cada arquivo e ferramenta no desenvolvimento e deploy do ChronoTracker.

## 1. O `docker-compose` que fica no repositorio e IaC?

### Resposta curta

Sim, com uma observacao: um `compose.yaml` e uma forma de IaC para descrever e reproduzir a infraestrutura de containers, principalmente em desenvolvimento e testes. Ele nao representa toda a infraestrutura da AWS.

### O que o Compose descreve

Um arquivo Compose pode declarar:

- containers;
- imagens;
- portas;
- volumes;
- redes;
- variaveis de ambiente;
- dependencias entre servicos;
- comandos de inicializacao.

Neste projeto, ele poderia descrever:

```text
API ChronoTracker + PostgreSQL local
```

Ao executar:

```powershell
docker compose up --build
```

o Docker cria os containers conforme o arquivo. Isso torna o ambiente reproduzivel para todos os desenvolvedores.

### O que o Compose nao cria

O Compose nao cria, por si so:

- conta AWS;
- VPC e subnets;
- instancia EC2;
- banco RDS;
- security groups;
- DNS;
- regras IAM;
- cluster Kubernetes.

Para esses recursos, use Terraform, OpenTofu ou AWS CDK. A separacao pode ser:

```text
compose.yaml             -> containers locais e CI
Dockerfile               -> como construir a imagem da API
Terraform/OpenTofu       -> recursos AWS
manifests Kubernetes     -> como executar a aplicacao no cluster
GitHub Actions           -> automacao do processo
```

Portanto, e correto chamar o Compose de IaC de containers, mas nao de IaC completa da AWS.

## 2. Como o Docker sera instalado na EC2 e nas maquinas dos colegas?

O `Dockerfile` e o `compose.yaml` nao instalam o Docker. Eles sao arquivos usados pelo Docker depois que ele ja esta instalado.

### Na maquina dos colegas

Cada colega instala uma vez:

1. Docker Desktop no Windows ou macOS, ou Docker Engine no Linux.
2. Git.
3. Node.js somente se precisar executar comandos fora dos containers.

Depois, clona o repositorio, cria o `.env` local e executa:

```powershell
docker compose up --build
```

O Compose baixa imagens, constroi a API e inicia os servicos declarados no arquivo.

O `.env` nao deve ser versionado. O repositorio deve conter apenas um `.env.example` com nomes de variaveis e valores ficticios.

### Na EC2

Na EC2, o Docker e instalado uma vez pelo bootstrap da maquina ou por provisionamento. Depois, o deploy pode ser atualizado automaticamente.

O fluxo inicial e:

```text
criar EC2
  -> instalar Docker Engine e Docker Compose Plugin
  -> configurar acesso ao registry
  -> configurar secrets
  -> docker compose up -d
```

Para evitar configuracao manual, use script de bootstrap, Terraform/OpenTofu ou Ansible. O script pode instalar Docker, Nginx, agente de logs e dependencias.

Depois da instalacao inicial, o GitHub Actions pode atualizar a EC2 usando AWS Systems Manager ou SSH restrito:

```powershell
docker compose pull
docker compose run --rm api npx prisma migrate deploy
docker compose up -d
```

Em producao, prefira imagens versionadas pelo SHA do commit em vez de usar somente `latest`.

### Diferenca entre os arquivos

| Arquivo | Finalidade | Onde e usado |
|---|---|---|
| `Dockerfile` | Define como construir a imagem da API | local, CI e registry |
| `compose.yaml` | Define containers e conexoes | desenvolvimento e CI |
| `compose.production.yaml` | Define a execucao em producao | EC2 |
| `.env.example` | Documenta variaveis necessarias | repositorio |
| `.env` ou Secret Manager | Guarda valores reais | maquina local ou AWS |

## 3. Faz sentido separar ambientes por branches e deixar o GitHub Actions atualizar a AWS?

### Resposta curta

Sim. Faz sentido usar branches para controlar o fluxo de mudancas e GitHub Actions para automatizar deploys. Branch e ambiente podem se relacionar, mas nao sao a mesma coisa.

Uma estrategia simples:

```text
feature/* -> pull request -> testes de CI
develop   -> deploy automatico em teste/homologacao
main      -> deploy em producao, com aprovacao manual
```

### O que cada um representa

A branch representa uma linha de desenvolvimento e revisao do codigo. O ambiente representa recursos e configuracoes isolados:

- banco de dados;
- secrets;
- dominio;
- credenciais AWS;
- maquinas, pods ou namespaces;
- politicas de backup.

O ambiente de teste deve ter banco e secrets de teste, mesmo que o deploy seja disparado pela branch `develop`.

### Fluxo com EC2 e Docker Compose

Para a primeira fase, sem Kubernetes:

1. Um pull request executa build, migrations contra banco efemero e testes.
2. Um merge em `develop` constroi a imagem e publica no Amazon ECR.
3. O GitHub Actions atualiza a EC2 de teste.
4. O workflow executa migrations e sobe a nova imagem.
5. O workflow chama `/health` e executa smoke tests.
6. Um merge em `main` repete o processo para producao, com aprovacao manual.

O GitHub Actions orquestra o processo, mas a EC2 executa os containers. O Compose define como eles devem rodar.

### Fluxo com Kubernetes

Com Kubernetes, o GitHub Actions normalmente nao instala containers em cada maquina. Ele publica a imagem e atualiza o estado desejado do cluster, por exemplo a tag da imagem no `Deployment`.

O Kubernetes identifica a diferenca entre o estado atual e o desejado e cria ou substitui pods ate chegar ao estado declarado.

## 4. Se Kubernetes fizer isso, como ele funciona?

### Resposta curta

Kubernetes nao e um workflow do Git. Ele e uma plataforma que fica rodando continuamente e administra containers em um cluster.

Os arquivos YAML do Kubernetes declaram o estado desejado. Eles podem ser aplicados manualmente, mas em um fluxo profissional o GitHub Actions aplica essas declaracoes depois de testes e aprovacao.

### O que acontece durante um deploy

1. O desenvolvedor faz push ou abre um pull request.
2. O GitHub Actions executa build e testes.
3. O pipeline constroi uma imagem Docker com tag imutavel.
4. O pipeline publica a imagem no registry, como Amazon ECR.
5. O pipeline atualiza o manifest para usar aquela tag.
6. O pipeline executa `kubectl apply` ou usa uma ferramenta GitOps.
7. Kubernetes compara o estado desejado com o atual.
8. Kubernetes cria novos pods com a imagem nova.
9. Readiness e liveness probes verificam os pods.
10. O `Deployment` substitui os pods antigos conforme a estrategia de rollout.
11. O pipeline aguarda o rollout e executa smoke tests.

Exemplo de aplicacao manual:

```powershell
kubectl apply -k k8s/overlays/test
kubectl rollout status deployment/chronotracker-api --namespace chronotracker-test
```

Esse comando aplica os arquivos naquele momento. E util para aprendizado e troubleshooting, mas nao deve ser o processo principal de producao se o objetivo for rastreabilidade.

### Como Kubernetes permanece funcionando

Um cluster possui componentes de controle que observam continuamente os recursos declarados. Um `Deployment` pode declarar:

```yaml
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: api
          image: registry/chronotracker-api:commit-sha
```

Isso significa manter dois pods da API usando aquela imagem. Se um pod cair, Kubernetes tenta criar outro. Se a imagem mudar, ele executa um rollout.

Kubernetes nao constroi a imagem Docker. A construcao fica no CI. Kubernetes executa a imagem publicada e mantem o estado desejado.

### Tres formas de fazer deploy Kubernetes

#### Aplicacao manual

O desenvolvedor executa:

```powershell
kubectl apply -k k8s/overlays/test
```

E simples para aprender, mas depende de acesso manual, pode esquecer etapas e dificulta auditoria.

#### GitHub Actions aplicando os manifests

O workflow executa os comandos `kubectl` depois de testes e aprovacao. O repositorio continua sendo a fonte de configuracao e o pipeline faz a aplicacao.

E simples de adotar, mas o pipeline precisa de credenciais de acesso ao cluster.

#### GitOps com Argo CD ou Flux

O GitHub Actions publica a imagem e altera os manifests em um repositorio de ambiente. Argo CD ou Flux, que ja roda no cluster, observa o repositorio e aplica as mudancas.

```text
GitHub Actions -> imagem no registry + manifest no Git
Argo CD/Flux  -> observa o Git e sincroniza o cluster
Kubernetes    -> executa e mantem os pods
```

Essa opcao oferece auditoria e reconciliacao automatica, mas adiciona uma ferramenta para operar.

## Recomendacao para o ChronoTracker

### Fase 1: desenvolvimento e CI

- `Dockerfile` para a API;
- `compose.yaml` com API e PostgreSQL local;
- GitHub Actions para build, migrations e testes;
- banco efemero separado para cada execucao do CI.

### Fase 2: AWS inicial com baixo custo

- EC2 com Docker Compose;
- RDS PostgreSQL separado do banco local;
- ECR para imagens versionadas;
- GitHub Actions atualizando a EC2;
- teste e producao com bancos, secrets e dominios diferentes.

### Fase 3: Kubernetes

- manifests com Kustomize;
- namespaces `chronotracker-test` e `chronotracker-production`;
- migration como Job unico por release;
- GitHub Actions aplicando manifests ou introducao de Argo CD/Flux;
- cluster Kubernetes somente quando disponibilidade, escala ou frequencia de deploy justificar o custo.

## Resumo

Docker empacota a aplicacao, Compose descreve containers, IaC cria a infraestrutura, GitHub Actions automatiza o pipeline e Kubernetes mantem a aplicacao rodando conforme o estado declarado.