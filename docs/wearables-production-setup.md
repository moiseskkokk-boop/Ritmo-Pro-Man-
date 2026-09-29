# Wearables: configuração de produção

## Google Health API (conector web implementado)

Configurar no backend:

- `PUBLIC_APP_URL=https://<dominio-publico>`
- `GOOGLE_HEALTH_CLIENT_ID`
- `GOOGLE_HEALTH_CLIENT_SECRET`
- `GOOGLE_HEALTH_REDIRECT_URI=https://<dominio-publico>/api/wearables/callback/google_health`
- `WEARABLE_TOKEN_ENCRYPTION_KEY` (32 bytes em hex ou Base64; manter estável e guardar como segredo)
- `APP_TIME_ZONE` (IANA, por exemplo `Europe/Lisbon`)

No Google Cloud, ativar Google Health API, configurar o OAuth Client do tipo Web e autorizar exatamente o redirect URI acima. Configurar o consent screen e obter a aprovação/verificação de escopos exigida pelo Google para disponibilizar a aplicação aos utilizadores. Escopos usados: `googlehealth.activity_and_fitness.readonly`, `googlehealth.health_metrics_and_measurements.readonly` e `googlehealth.sleep.readonly`. A API lê o grupo `google-wearables`, exercícios e sono; dados não fornecidos continuam ausentes.

Executar as migrations Drizzle no banco de produção antes de habilitar OAuth. A mesma chave de cifragem deve permanecer configurada nas próximas versões; perder ou trocar a chave torna os tokens existentes ilegíveis e exige reconexão dos utilizadores.

## COROS MCP (OAuth individual e sincronização implementados)

O backend descobre os metadados OAuth da COROS, regista dinamicamente o cliente web, aplica PKCE, troca/renova tokens no servidor e consulta o MCP oficial `https://mcpeu.coros.com/mcp`. Não exige credenciais de parceiro nem aprovação de parceiro. Os tokens e o client ID dinâmico são cifrados no backend. A sincronização consulta atividades e, se publicados no MCP, métricas diárias, sono e recuperação; a interface não escreve de volta na conta COROS. A conexão precisa de `PUBLIC_APP_URL` e `WEARABLE_TOKEN_ENCRYPTION_KEY` e de redirect URI permitido pelo serviço.

O MCP usa polling por solicitação de sincronização, sem webhook. A lista/esquemas de ferramentas pertencem ao servidor COROS e podem mudar; se uma ferramenta exigir filtros sem mapeamento seguro, a sincronização informa erro e não inventa dados.

## Garmin (OAuth preparado; API de dados bloqueada por acesso externo)

O backend aceita os seguintes segredos/configurações:

- Garmin: `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_AUTHORIZE_URL`, `GARMIN_TOKEN_URL`, `GARMIN_API_BASE_URL`.
- `PUBLIC_APP_URL`, `WEARABLE_TOKEN_ENCRYPTION_KEY`.

As credenciais/endpoints devem ser emitidos pelo programa de parceiros e aprovados pelo fornecedor. A troca OAuth e armazenamento cifrado estão prontos; a sincronização informa erro explicitamente até serem fornecidos acesso e contrato de API com adaptador que respeite a especificação aprovada. Configurar somente endpoints OAuth não libera acesso a atividades. O programa Garmin é empresarial, sob análise da candidatura, e publica OAuth 2.0 para as APIs cloud.

## Apple HealthKit (bridge nativo necessário)

O cliente web/Tauri não pode pedir autorização HealthKit nem ler HealthKit diretamente. Para ativar, acrescentar um companion iOS nativo (ou plugin Tauri iOS mantido) que:

1. habilite HealthKit entitlement/capability no App ID e provisioning profile;
2. configure `NSHealthShareUsageDescription` com texto de uso claro;
3. solicite ao utilizador apenas leitura para workouts, energia ativa, distância, passos, frequência cardíaca, sono e métricas de recuperação suportadas;
4. leia amostras com datas/offsets locais e envie-as pela sessão autenticada a um endpoint nativo versionado;
5. trate revogação, ausência de permissão e ausência de amostras como estados diferentes.

Sem esse bridge a interface mantém “Bridge nativo necessário”; nenhum token/conexão fictícia é criado.

## Android Health Connect (bridge nativo necessário)

O projeto não contém módulo Android nem bridge Health Connect. Para ativar, criar o módulo Android/companion ou plugin Tauri e:

1. adicionar SDK Health Connect compatível e permissões de leitura granulares para Exercise, Active Calories, Total Calories (se fornecido), Distance, Steps, Heart Rate e Sleep;
2. declarar permissões/intent de rationale no Manifest e publicar a declaração de Health Connect exigida na Play Console;
3. pedir consentimento em runtime e consultar records com paginação e `timeRangeFilter` no fuso local;
4. enviar apenas amostras lidas, com origem, identificadores, instantes e offsets, à API autenticada;
5. distinguir app Health Connect indisponível, permissão revogada e período sem dados.

Até o bridge existir, a aplicação mantém o estado de autorização necessária.

## Persistência e estados

Aplicar `drizzle/0008_flowery_big_bertha.sql`. Gerar a chave com `openssl rand -hex 32`, guardar como segredo no Render e mantê-la estável. OAuth usa state aleatório de uso único com validade de 10 minutos e PKCE para Google/COROS. Tokens OAuth só ficam no servidor, cifrados com AES-256-GCM; endpoints de leitura nunca retornam a coluna cifrada. Atividades são idempotentes pela chave `(userId, provider, externalId)`. Análises excluem arquivos `manual_import`, colapsam totais diários de múltiplas fontes pelo maior valor para evitar somar duas vezes o mesmo dispositivo e removem atividades de provedores com início/duração coincidentes. Fontes efetivamente usadas são devolvidas à interface.
