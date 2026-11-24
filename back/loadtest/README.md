# Teste de carga HTTP com k6

Scripts locais em `loadtest\teste_carga\`; resultados em `loadtest\results\`.
Ambos os diretorios sao ignorados pelo Git, conforme solicitado. Somente este
README e versionado: um clone nao recebe os scripts nem a massa local. Guarde uma
copia local segura desses arquivos se precisar reproduzir em outra maquina.
Nao ha mudanca de endpoint, schema, dependencia npm ou contrato com o front.

## Instalacao

Instale k6 1.x ou superior no Windows, em PowerShell:

```powershell
winget install k6 --source winget
k6 version
```

Alternativas e instalacao em outros sistemas:
<https://grafana.com/docs/k6/latest/set-up/install-k6/>.
Os scripts usam somente modulos nativos do k6; nao precisam de `npm install`.
Execute os comandos abaixo na raiz do repositorio.

## Ambiente e massa

Use uma API dedicada a testes com banco **descartavel**, nunca homologacao ou
producao. Confirme com o responsavel qual banco a API realmente utiliza. A URL da
API nao prova o destino do banco. Nao execute seed, migration ou limpeza como parte
do teste. Nao altere os limitadores da API para favorecer resultados.

O bloqueio de destino ocorre antes do setup: somente origem HTTP(S), sem caminho,
query, fragmento ou credenciais. Localhost/127.0.0.1 sao aceitos, inclusive na porta
3001; a porta 3001 em destinos remotos e nomes de producao/hom/staging conhecidos
sao recusados. Destinos remotos exigem HTTPS,
nome com segmento `test`, `teste`, `loadtest`, `sandbox`, `dev` ou `local`, e
`SAFE_BASE_URL` identica a `BASE_URL`. Redirects sao desabilitados em todas as chamadas.
Nao existe flag para ignorar o bloqueio. Uma origem remota deve ser revisada, nao
renomeada apenas para contornar essa protecao.

Selecione ao menos tres projetos sinteticos **proprios, ativos, nao compartilhados**,
com cliente e atividades existentes. Informe seus UUIDs em `PROJECT_IDS`. O setup
consulta a API, valida a propriedade e utiliza os IDs reais de cliente e atividades
retornados; nao inventa IDs nem cria fixtures no banco. Use o workspace sintetico
inteiro como descartavel, inclusive para as leituras.

### Usuarios do mockup\seed.ts

O seed gera logins dinamicamente como `nome.sobrenome`, sem lista fixa de contas.
O trecho `Logins de exemplo` da **execucao anterior** informa identificador da
empresa e logins OWNER/COLAB das maiores empresas. Use um OWNER ativo (ou ADMIN)
e o identificador daquela empresa, nao o UUID, em `WORKSPACE_ID`.

A senha e a `SEED_SENHA` usada naquela execucao; se ela nao foi definida, consulte
o padrao no cabecalho do seed. Nao copie esse padrao para scripts ou massa.
O k6 nao importa nem executa o seed, nao le `.env` e nao consulta o banco.
Ler o arquivo nao confirma quais usuarios existem na base atual.

## Variaveis e autenticacao

| Variavel | Uso |
| --- | --- |
| `BASE_URL` | Origem da API de teste, sem prefixo de caminho |
| `SAFE_BASE_URL` | Mesma origem, obrigatoria para destino remoto |
| `WORKSPACE_ID` | `empresa.identificador` do workspace sintetico |
| `CONFIRM_TEST_WORKSPACE` | Repetir exatamente `WORKSPACE_ID` |
| `CONFIRM_DISPOSABLE_DATABASE` | `yes`, somente depois de conferir o banco |
| `PROJECT_IDS` | Pelo menos tres UUIDs distintos separados por virgula |
| `LOGIN_USER` | Login OWNER/ADMIN obtido da massa existente |
| `LOGIN_PASSWORD` | Senha fornecida pelo ambiente, nunca em arquivo |
| `SEED_SENHA` | Alternativa para senha; `LOGIN_PASSWORD` tem precedencia |
| `ACCESS_TOKEN` | Alternativa ao login: JWT de acesso ja existente |
| `RUN_ID` | ID unico por execucao, ate 24 caracteres alfanumericos, `_` ou `-` |
| `VU_LIMIT` | Teto de VUs; padrao 1500, maximo permitido 5000 |

No modo de credenciais, `setup()` faz `POST /auth/login` com `nome_usuario` e `senha`,
le o cookie `_tk` e distribui somente esse acesso aos VUs. Em modo `ACCESS_TOKEN`,
o login e dispensado. O token e enviado no **cookie `_tk`**, acompanhado de
`x-workspace-id`, porque Bearer so e convertido em cookie nas rotas `/api/*`.
Nao envie o refresh `_rtk` aos VUs.

O setup verifica sessao, vinculo e cargo via `GET /auth/me`. O JWT precisa de
`type=access` e `exp` suficiente para a duracao do perfil **mais quatro minutos**.
A leitura de claims nao verifica assinatura; a API faz essa verificacao.
Nao ha refresh automatico: evita reutilizar refresh opaco entre VUs e gerar
trafego fora do orcamento. Para soak, obtenha um acesso com validade suficiente
na configuracao do ambiente descartavel antes de iniciar. Tokens curtos falham
explicitamente na preparacao, sem iniciar a carga.

Se houver `Preparacao recusada`, a mensagem identifica a rota-modelo, o status
e separa HTTP inesperado de JSON invalido, `error` diferente de `false`,
`data` ausente/null ou cookie de acesso ausente no login. Quando a API retorna
`X-Request-Id` em formato UUID, ele acompanha o erro para correlacao com o log
sanitizado do servidor. O harness nao imprime o corpo nem a mensagem bruta da API.
Status 0 indica falha de transporte, sem resposta HTTP; status 500 exige investigar
o log do servidor pelo requestId antes de atribuir uma causa interna.
Nao repita `k6 run` apenas para diagnosticar: as iteracoes criam atividades.
Use health, uma autenticacao e somente os GETs do setup, com cookies em memoria;
`k6 inspect` valida o carregamento, mas nao executa nem comprova o setup.

### Configuracao pelo env.ps1

Edite `loadtest\teste_carga\env.ps1`, no bloco `$settings`: preencha `BaseUrl`,
`WorkspaceId`, os tres ou mais `ProjectIds` e `LoginUser` com os valores da massa.
Depois de conferir o banco real da API, ajuste `ConfirmDisposableDatabase = $true`.
O arquivo e local e ignorado pelo Git, assim como os demais scripts.

Use `AuthMode = 'login'` para login no setup ou `'token'` para acesso existente.
**Nao escreva senha nem token no arquivo.** O script reaproveita `LOGIN_PASSWORD`
ou `SEED_SENHA` do terminal; se nao existirem, solicita a senha com entrada oculta.
No modo token, usa `ACCESS_TOKEN` ou solicita o JWT com entrada oculta.
Ao trocar de modo, limpa as variaveis do outro modo para evitar autenticacao errada.
Para trocar a senha/conta no mesmo terminal, remova `LOGIN_PASSWORD` e `SEED_SENHA`
antes de carregar novamente.

Execute o arquivo **no mesmo terminal** em que rodara o k6, antes de cada perfil.
Ele define as variaveis, gera um novo `RUN_ID` e cria o diretorio de resultados;
nao inicia k6, nao acessa a API e nao executa seed. As validacoes de destino e
validade do token continuam sendo feitas pelos scripts k6.

```powershell
& .\loadtest\teste_carga\env.ps1
```

### Configuracao manual (alternativa)

Se preferir nao usar `env.ps1`, configure manualmente:

```powershell
$env:BASE_URL = "http://localhost:3005"
$env:WORKSPACE_ID = Read-Host "Identificador do workspace sintetico"
$env:CONFIRM_TEST_WORKSPACE = $env:WORKSPACE_ID
$env:CONFIRM_DISPOSABLE_DATABASE = "yes" # somente apos conferir o banco real da API
$env:PROJECT_IDS = Read-Host "Tres ou mais UUIDs de projetos sinteticos separados por virgula"
$env:LOGIN_USER = Read-Host "Login OWNER da saida anterior do seed"
$credential = Get-Credential -UserName $env:LOGIN_USER -Message "Senha da conta sintetica"
$env:LOGIN_PASSWORD = $credential.GetNetworkCredential().Password
New-Item -ItemType Directory -Force -Path .\loadtest\results | Out-Null
```

Se `SEED_SENHA` ja estiver no ambiente com o valor correto, `LOGIN_PASSWORD` pode
ficar ausente. Para usar token, em vez das credenciais:

```powershell
$tokenSecret = Read-Host "JWT de acesso de teste" -AsSecureString
$env:ACCESS_TOKEN = [System.Net.NetworkCredential]::new("", $tokenSecret).Password
```

Tokens, senhas e cookies nao sao gravados nos resumos. Nao use `--http-debug`,
`--summary-export` ou dumps de `setup_data`: podem persistir segredos. Arquivos de
archive do k6 tambem devem ser tratados como sensiveis. Nao use execucao distribuida:
este dimensionamento e a unicidade por RUN_ID foram preparados para um processo local.

## Perfis e comandos

Todos importam o mesmo fluxo e configuracao. Execute `env.ps1` antes de cada teste
para recarregar os valores e gerar novo RUN_ID. Use o mesmo terminal e a raiz do
repositorio. O `if ($?)` impede iniciar k6 se a configuracao falhar.
Os pares de comandos abaixo sao alternativas; rode um perfil por vez.

| Perfil | Taxa e duracao |
| --- | --- |
| smoke | 3 VUs por 1 min; excecao deliberada com `constant-vus` |
| load | 1 -> 20 req/s em 1 min, 20 por 13 min, 20 -> 1 em 1 min; total 15 min |
| stress | 20, 30, 40 e 60 req/s por 5 min cada; transicoes de 1 s, total 20 min 3 s |
| spike | 20 por 1 min, 20 -> 200 em 10 s, 200 por 2 min, 200 -> 20 em 10 s, 20 por 1 min |
| soak | 14 req/s (70% de 20) por 2 h |
| breakpoint | Rampa continua 20 -> 260 req/s em 24 min, segmentos de +20 a cada 2 min |

```powershell
& .\loadtest\teste_carga\env.ps1
if ($?) { k6 run .\loadtest\teste_carga\smoke.js }

& .\loadtest\teste_carga\env.ps1
if ($?) { k6 run .\loadtest\teste_carga\load.js }

& .\loadtest\teste_carga\env.ps1
if ($?) { k6 run .\loadtest\teste_carga\stress.js }

& .\loadtest\teste_carga\env.ps1
if ($?) { k6 run .\loadtest\teste_carga\spike.js }

& .\loadtest\teste_carga\env.ps1
if ($?) { k6 run .\loadtest\teste_carga\soak.js }

& .\loadtest\teste_carga\env.ps1
if ($?) { k6 run .\loadtest\teste_carga\breakpoint.js }
```

Nao sobrescreva executors, stages, tags ou thresholds pela CLI. O breakpoint para
ao falhar SLO ou atingir o teto seguro: se chegar a 260 req/s sem falha, o limite
**nao foi encontrado**, apenas ficou acima do teto ensaiado. Amplie esse teto
somente apos revisar capacidade e custo do gerador e da API.

Para inspecionar sem login, requisicoes HTTP ou carga, configure as variaveis e use:

```powershell
& .\loadtest\teste_carga\env.ps1
if ($?) { k6 inspect --include-system-env-vars .\loadtest\teste_carga\smoke.js }
```

Ao terminar, remova os segredos do ambiente:

```powershell
Remove-Item Env:LOGIN_PASSWORD, Env:SEED_SENHA, Env:ACCESS_TOKEN -ErrorAction SilentlyContinue
$credential = $null
$tokenSecret = $null
```

## Jornada e efeitos

Uma iteracao faz uma requisicao seguida de think time aleatorio uniforme de 1 a 3 s.
O mix e balanceado em blocos de 100 iteracoes, intercalado por permutacao:
60% leituras, 30% criacao e 10% consulta pesada. Uma execucao interrompida pode
terminar um bloco incompleto. O mix por fase e medido, nao presumido.

| Grupo | Endpoints reais |
| --- | --- |
| leitura | GET `/clientes/list/:id`, `/projetos/list/:id`, `/atividades/list/:id`, `/atividades/list?projeto_id=...`, `/lancamentos/list?from=all&projeto_id=...&ano=...&mes=...` |
| escrita | POST `/atividades/create`, status esperado 201 |
| pesada | GET `/dashboard/stats`, sem filtro de periodo |

Os 10% usam a alternativa de consulta pesada; login so ocorre na preparacao.
O teste nao mede concorrencia de login. Status esperado das leituras: 200.
As respostas devem ter `error: false` e `data` (ou `message` na criacao).
404 nunca e aceito, mesmo com `error: false` no corpo da API.
429, timeouts, redirecionamentos e erros de contrato sao falhas, sem retries.

`SharedArray` carrega `data\templates.json`: doze modelos sinteticos com prioridades,
horas, textos, datas e periodos variados. O setup fornece os IDs reais dos projetos
permitidos e das atividades; a selecao aleatoria evita consultar sempre um registro.
Periodos usam os ultimos doze meses, com ano e mes explicitos; ajuste a massa se
precisar garantir resultados nao vazios em todos eles. As datas de escrita sao UTC.
`RUN_ID` mais numero global da iteracao torna cada payload de escrita unico.

Cada atividade criada usa prefixo `LT`, tipo `INTERNO`, referencia da execucao e
somente um dos projetos permitidos. Nao cria horas, despesas, convites ou e-mails.
O centro de custo/solicitante do projeto pode prevalecer, conforme o service atual.
Nao ha cleanup automatico. O soak pode criar cerca de **30.240 atividades**;
listagens podem ficar mais lentas conforme a massa cresce. Remocao posterior do
ambiente e responsabilidade do operador, sem comandos destrutivos neste teste.

## Taxa, capacidade e thresholds

Exceto smoke, todos usam `ramping-arrival-rate`. Ha uma requisicao por iteracao,
portanto req/s = iteracoes/s durante a jornada. As consultas de setup sao extras,
marcadas `scope=setup` e excluidas dos SLOs da jornada.

Prealocacao = teto(taxa de pico x 3,25 s x 1,3). O tempo inclui think time maximo,
250 ms de resposta e margem de 30%. O maximo e o menor entre `VU_LIMIT` e seis vezes
a taxa de pico. O spike prealoca 845 VUs e pode chegar a 1200; o breakpoint prealoca
1099 e pode chegar a 1500. Isso exige CPU, memoria e sockets no gerador.
Degradacao severa pode consumir esse orcamento: `dropped_iterations == 0` impede
aprovar uma carga nao entregue. Nunca interprete taxa menor por falta de VUs como
capacidade da API.

- p95 estritamente menor que **250 ms**, agregado da jornada e por fase.
- `http_req_failed` estritamente menor que **5%**, agregado da jornada e por fase.
- `journey_errors` tambem mede respostas com contrato invalido, limite de **5%**.
- Checks devem ter **100%** de sucesso; deve haver ao menos uma acao.
- Stress/breakpoint usam `abortOnFail` nos SLOs de latencia e erros.
- Todos abortam quando erros HTTP ou de contrato ultrapassam **20%**,
  globalmente ou por fase, com avaliacao inicial apos 15 s.

Thresholds nativos sao acumulados, avaliados periodicamente (nao instantaneamente
nem em janela movel). Atrasos recentes podem ser diluidos pelo historico. A margem
inicial de 15 s e contada desde o inicio do teste, nao reiniciada em cada fase.
Uma falha de setup interrompe antes da jornada. Nao execute `--no-thresholds`.

## Resultados

`handleSummary` escreve arquivos com RUN_ID, perfil e timestamp, evitando sobrescrita:

```text
loadtest\results\<run-id>-<perfil>-<timestamp>-summary.json
loadtest\results\<run-id>-<perfil>-<timestamp>-<fase>.json
```

O diretorio precisa existir; o k6 nao cria diretorios no handleSummary. Falha de
gravacao deve ser tratada como falha operacional, nao como resultado aprovado.
O resumo geral contem metricas e estado; nao serializa `setup_data`, respostas,
credenciais, usuario, workspace ou cookies. Nomes de metricas usam rotas-modelo,
sem UUIDs/URLs dinamicas.

Cada fase tem submetricas declaradas antes do teste, incluindo p95 verdadeiro
das requisicoes enviadas naquela fase e contagens do mix. Uma requisicao iniciada
no final de uma fase continua atribuida a ela mesmo terminando na proxima.
Fases nao executadas apos aborto sao marcadas `observed: false`; metricas ausentes
nao sao substituidas por sucesso. `dropped_iterations` e global, pois o k6 nao
atribui tags dinamicas de fase a iteracoes que nao chegaram a executar.
