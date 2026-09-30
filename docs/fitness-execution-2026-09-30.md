# Ritmo Pro Man — retomada e execução de fitness

## Tempo e contexto recuperado

A inspeção começou em 29/09/2026 às 22:25:07 UTC (23:25:07 em Lisboa). O horário de encerramento e o tempo decorrido estão no fim deste documento. É tempo de relógio desta retomada; o ambiente não mede separadamente tempo ativo e eventuais pausas. Não inclui o trabalho da sessão anterior.

O repositório já tinha alterações de autenticação, confirmação de e-mail, recuperação, revogação de sessões, limites persistentes, documentação e testes. Foram preservados todos esses arquivos. A autenticação não foi reestruturada. O relatório anterior registrava 62 testes padrão e 8 testes MySQL aprovados; a suíte foi executada novamente com essas integrações habilitadas.

Também foram recuperados `shared/fitness.ts`, `shared/original-prescriptions.ts`, a renomeação parcial dos quatro treinos e as definições de novas tabelas em `drizzle/schema.ts`. Essas estruturas ainda não tinham migração correspondente, endpoints de execução ou interface integrada. A biblioteca e o editor de treinos já existiam, assim como a infraestrutura Gemini, Storage privado, análise corporal e adaptadores wearable. Não se reiniciou o projeto.

## Migrações e banco real

- 0013 cria `workout_plans` e seu índice por proprietário/data. Necessária para a biblioteca; aditiva.
- 0014 acrescenta `daily_logs.mealAnalysisJson`. Necessária para a análise alimentar legada; aditiva.
- Ao executar o migrador com validação individual de histórico/checksums, ambas **já estavam aplicadas no estado real**. Isso divergia do relatório anterior. Não foram reaplicadas. A presença do campo alimentar foi conferida por consulta de metadados.
- 0015–0018 continuavam aplicadas e foram preservadas.
- 0019 foi gerada pelo Drizzle e aplicada: cria `training_sessions`, `training_sets`, `fitness_preferences`, `wellness_entries`, `body_measurements`, `fitness_revisions` e `coach_turns`, com índices.
- 0020 foi gerada pelo Drizzle e aplicada: acrescenta `training_sets.voidedAt`, para desmarcar uma confirmação sem apagar o registro.
- Uma nova execução do migrador validou o histórico sem reaplicar as migrações. Nenhuma dessas duas novas migrações remove tabelas, colunas ou registros. Não houve reset do banco nem migração destrutiva.

## Treino profissional e sequência 1–4

A tela principal `/treino` apresenta TREINO SUGERIDO 1, 2, 3 e 4, com os grupos musculares. Não associa os quatro planos a dias fixos da semana. Os 32 exercícios originais, imagens e prescrições foram preservados, incluindo quatro séries de panturrilha no treino 3 e a prancha por segundos. O calendário usa datas reais.

O próximo recomendado segue o último treino original finalizado, com ciclo 1 → 2 → 3 → 4 → 1. Treinos personalizados não avançam essa sequência. A escolha continua livre. Iniciar um treino armazena um snapshot independente de futuras edições da biblioteca.

A execução permite registrar repetições efetivas ou segundos, carga conhecida ou desconhecida, notas de série, corrigir carga/repetições, confirmar explicitamente uma série, desmarcar uma confirmação equivocada e finalizar com notas. Não pré-preenche repetições realizadas a partir da prescrição. Não registra automaticamente todas as séries ou todos os exercícios. Uma sessão parcial pode ser finalizada se existir ao menos uma série confirmada.

O backend confere a data em Europe/Lisbon no início, nas confirmações, correções, desmarcações e finalização. Sessões antigas podem ser consultadas pela data, inclusive além da janela do dashboard. Sessões finalizadas ficam imutáveis. Locks por sessão e IDs de série determinísticos evitam confirmações duplicadas; o índice proprietário/data evita sessões duplicadas. Registros antigos não foram convertidos em séries fictícias.

## Edição e biblioteca

Foram preservados criação manual, renomeação, substituição pelo catálogo, adição/remoção, ordenação, séries, repetições, carga planejada, descanso e observações. A cópia dos quatro originais agora usa as prescrições reais preservadas, em vez de aplicar a mesma prescrição genérica a todos os exercícios. Acrescentadas cópia de plano privado e abertura desse plano para execução.

A biblioteca e suas mutações usam o usuário autenticado. Não é possível iniciar ou editar um plano privado de outra conta. O editor e a biblioteca receberam o tratamento visual preto/verde.

## Histórico, progressão e integração

`/historico` mostra sessões reais, séries confirmadas, carga, repetições, segundos, volume conhecido e frequência por exercício. Volume = carga × repetições, apenas quando ambos foram informados. Volume incompleto é identificado como parcial. A consistência informa datas de sessões finalizadas no período explícito de 90 dias, sem presumir dias obrigatórios.

O histórico legado permanece consultável e identificado como resumo de exercícios, sem inventar séries ou cargas. A análise semanal existente passou a incluir sessões finalizadas do novo sistema; datas presentes também no histórico antigo são contadas uma vez. Apenas escolher um treino no histórico antigo com zero exercícios concluídos não equivale a execução confirmada.

## AI Coach e Gemini

`/coach` utiliza `gemini-3.5-flash-lite` explicitamente. O endpoint de metadados desse modelo respondeu HTTP 200 com a configuração local. Isso confirma disponibilidade de metadados, não substitui o teste de uma conversa real.

O contexto é enviado apenas com autorização explícita nessa solicitação. Sem autorização, o histórico não é carregado nem enviado ao modelo. Com autorização, são enviados preferências/perfil, medidas e histórico corporal, sessões e métricas de carga/repetição, frequência, registros de refeições/água/cardio, avaliações anteriores, estimativas corporais anteriores e atividades/estados wearable. Os registros legados entram como resumos identificados.

O contexto tem limites de quantidade e período. As sessões usam métricas agregadas e uma amostra de até 12 séries em até oito sessões; não é enviado o banco inteiro. Fotografias, signed URLs, credenciais e tokens wearable não entram nesse contexto. A análise alimentar prioriza registros da data escolhida.

Mantidos `GEMINI_DAILY_TOKEN_LIMIT`, `GEMINI_USER_DAILY_TOKEN_LIMIT`, `GEMINI_MAX_INPUT_TOKENS`, `GEMINI_MAX_OUTPUT_TOKENS` e `gemini_usage_daily`. Reservas transacionais de orçamento por usuário e global protegem chamadas em andamento; linhas internas `__budget__` ficam separadas das métricas por funcionalidade. A contabilização inclui tokens de raciocínio quando declarados pelo provedor. Falhas de resultado incerto mantêm a reserva conservadoramente até mudar o dia.

O Coach não possui ferramentas nem acesso a outras contas. O prompt trata pergunta e registros como conteúdo não confiável, ignora pedidos de segredos/prompts e proíbe diagnóstico. Respostas são texto escapado pelo React, sem HTML executável. Isso mitiga prompt injection; não é uma prova de imunidade absoluta de um modelo generativo. Testes do Coach simulam o Gemini e verificam autorização, modelo, isolamento e tamanho da amostra.

Referência oficial: [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

## Corpo, fotos e avaliação

`/corpo` registra peso, altura, percentual de gordura informado, cintura, peito, quadril, notas e foto opcional, por usuário/data. Compara pesos existentes e apresenta os registros sem completar lacunas. Correções usam revisão otimista e preservam o conteúdo anterior. A avaliação semanal existente continua acessível; a análise corporal por imagem existente foi preservada e identificada explicitamente como ESTIMATIVA POR IA, sem medição clínica.

Os novos uploads aceitam JPEG/PNG/WebP até 1,5 MB e verificam MIME e assinatura do conteúdo no backend. As chaves são geradas no servidor sob o proprietário autenticado. As URLs são assinadas por 15 minutos, com renovação nas fotos ativas. Paths com traversal são rejeitados. O Storage exige bucket privado e não publica fotos.

A consulta somente de metadados do bucket Supabase retornou HTTP 400; **não confirmou a disponibilidade/privacidade do bucket externo**. O código falha de forma controlada até a configuração externa ser corrigida. Não foram enviados nem apagados arquivos reais no Supabase. A privacidade é exigida também em runtime; não se assume que a configuração existente funciona apenas porque há variáveis preenchidas.

## Smartwatch

Preservados adaptadores COROS e Google Health, preparação OAuth Garmin e deduplicação por `(userId, provider, externalId)`. Tokens continuam cifrados no servidor. A análise existente exclui importações manuais da telemetria oficial e deduplica fontes compatíveis.

A interface distingue CONECTADO, DESCONECTADO, AUTORIZAÇÃO NECESSÁRIA, SEM DADOS, ERRO e INTEGRAÇÃO INDISPONÍVEL. Acrescentada desconexão na tela dedicada. Apple Health e Health Connect não criam conexões fictícias: a interface e os endpoints informam indisponibilidade de integração sem bridge. A ausência de dados de uma fonte no período consultado é distinta de erro de sincronização.

COROS precisa de URL pública e chave de cifragem. Google precisa de credenciais e consentimento OAuth. Garmin depende de aprovação e contrato/adaptador oficial. As credenciais wearable não estão configuradas localmente. Nenhuma sincronização real desses provedores foi realizada nesta retomada.

Bridges nativos continuam pendentes: [autorização HealthKit](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) e [leitura Health Connect](https://developer.android.com/health-and-fitness/health-connect/read-data). A documentação existente em `docs/wearables-production-setup.md` continua sendo a referência de configuração.

## Alimentação, água e cardio

A nova `/alimentacao` reúne as três áreas. Refeições armazenam nome, alimentos informados, quantidade/porção, horário, notas e foto privada opcional. A análise Gemini só acontece ao solicitar e autorizar; estimativas da IA aparecem separadas dos fatos informados.

Água tem botões de 250/500 ml, quantidade livre, total diário, meta configurável, consulta por data e correção. Correções preservam a revisão anterior; 0 ml permite neutralizar um registro indevido sem apagá-lo.

Cardio manual registra modalidade, duração, distância conhecida, intensidade informada, notas e data. Sua origem é manual e não recebe calorias inventadas. Atividades wearable exibem origem e calorias apenas se fornecidas. Registros manuais e importados ficam separados; não são somados como se fossem necessariamente atividades diferentes. O usuário é orientado a não duplicar manualmente uma atividade já importada.

## Dashboard, interface e qualidade

`/dashboard` integra próximo treino, sessão de hoje, séries confirmadas, água/meta, cardio manual/importado, peso/progresso, smartwatch e Coach. Estados vazios orientam o próximo registro. Novas telas têm fundo preto, destaque verde, controles adequados ao toque e layouts que se adaptam à largura.

Textos das novas telas estão em português, inglês e espanhol. Ritmo Pro Man permanece invariável. Foram reaproveitadas traduções do catálogo. Algumas telas antigas, incluindo partes do editor/smartwatch, ainda contêm textos em português; isso não foi apresentado como tradução integral do aplicativo.

A verificação visual no Chrome usou dados fictícios interceptados e 32 combinações (oito páginas em 360, 390, 768 e 1440 px), confirmação explícita de série e troca pt/en/es. Sem erros JavaScript ou overflow horizontal nessas verificações. Isso não equivale a testes em hardware iPhone/Android ou Safari.

O teste visual revelou que o servidor de desenvolvimento espalhava uma função de configuração Vite como se fosse um objeto, deixando o frontend sem carregar. Corrigido o carregamento da configuração real. As rotas passaram a carregar módulos sob demanda. O bundle principal caiu de aproximadamente 739 kB no primeiro build desta retomada para cerca de 407 kB, sem o aviso anterior de chunk acima de 500 kB. Também foi removido o bloqueio de zoom no viewport.

## Segurança e testes

Ownership vem da sessão nos novos endpoints. Planos, sessões, séries, refeições, medidas, fotos e conversas têm escopo por proprietário. Não se aceita `userId` como identidade do cliente. Mutação de séries exige confirmação e revalida o estado/data; histórico fica separado da escrita. Correções com revisão antiga são rejeitadas. O middleware existente de Origin/CSRF e cookies seguros foi preservado. Há limites persistentes para Coach, uploads e registros; respostas do provedor e objetos de erro sensíveis não são registrados em logs.

Foram criados 40 testes: 18 regras/segurança, 17 integração fitness MySQL e 5 orçamento Gemini MySQL. Com os 70 anteriores, totalizam **110 testes aprovados** na execução com integrações ativadas. Os testes MySQL usam tabelas temporárias na conexão; os testes Gemini usam respostas simuladas, sem enviar dados reais. A suíte de ledger serializa o uso da única conexão temporária para não intercalar transações; não é um teste de carga de múltiplas instâncias em produção.

Arquivos de teste novos:

- `server/fitness.rules.test.ts`
- `server/fitness.database.test.ts`
- `server/llm.database.test.ts`
- `scripts/fitness-ui-smoke.mjs` (verificação visual opcional com Playwright Core/Chrome instalados fora das dependências do projeto).

Verificações obrigatórias: `corepack pnpm check`, `corepack pnpm test`, `corepack pnpm build` e `git diff --check`. A suíte padrão aprova 80 testes e deixa 30 integrações explicitamente desativadas. Executar `FITNESS_DATABASE_TESTS=1 AUTH_DATABASE_TESTS=1 corepack pnpm test` aprova os 110.

A auditoria `corepack pnpm exec tsx scripts/audit-secrets.ts` verifica arquivos versionáveis e build contra valores privados conhecidos dos arquivos locais de ambiente e padrões de credenciais, imprimindo apenas contagens/caminhos. Resultado final: zero achados e nenhum arquivo de ambiente versionado. É uma auditoria automatizada dirigida, não garantia universal sobre qualquer formato possível de segredo.

## Configuração externa — somente nomes

Banco/autenticação: `DATABASE_URL`, `JWT_SECRET`.

Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL` (opcional; o Coach fixa o modelo solicitado), `GEMINI_DAILY_TOKEN_LIMIT`, `GEMINI_USER_DAILY_TOKEN_LIMIT`, `GEMINI_MAX_INPUT_TOKENS`, `GEMINI_MAX_OUTPUT_TOKENS`. Os limites têm valores padrão no código, preservados.

Storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.

Aplicação e wearable: `PUBLIC_APP_URL`, `APP_TIME_ZONE`, `WEARABLE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`, `GOOGLE_HEALTH_REDIRECT_URI`, `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_AUTHORIZE_URL`, `GARMIN_TOKEN_URL`, `GARMIN_API_BASE_URL`.

E-mail/login social preservados: `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `APPLE_SERVICE_ID`.

Não é necessário configurar credenciais de cobrança para esta entrega. `JWT_SECRET`, URL pública, envio de e-mail e credenciais wearable continuam ausentes no ambiente local; a configuração de produção externa não foi consultada. Gemini e nomes de configuração Supabase estão presentes localmente, com a limitação Supabase descrita acima. Nenhum valor dessas variáveis consta deste relatório.

## Arquivos principais

`server/fitness.ts`; `server/_core/llm.ts`; `server/routers.ts`; `server/db.ts`; `server/storage.ts`; `server/_core/vite.ts`; `drizzle/schema.ts`; migrações 0019/0020, snapshots e journal; `client/src/pages/Fitness.tsx`; `client/src/pages/Workouts.tsx`; `client/src/pages/Smartwatch.tsx`; `client/src/pages/Home.tsx`; `client/src/App.tsx`; `client/src/index.css`; `client/index.html`; `shared/fitness.ts`; `shared/original-prescriptions.ts`; `shared/workouts.ts`; `shared/fitness-copy.ts`; `shared/exercise-translations.ts`; `shared/wearable-status.ts`; testes e scripts citados acima. Os arquivos recuperados de autenticação permanecem na árvore, incluindo suas migrações, testes e documentação anteriores.

## Limitações e próximos passos

- Uma sessão de treino por usuário/data. Depois de iniciada, o plano daquele dia fica fixado no snapshot. Suporta sessão parcial; não suporta duas sessões separadas no mesmo dia nem trocar o snapshot de uma sessão em andamento.
- O catálogo de exercícios continua limitado aos 32 originais. Não há cadastro de exercício arbitrário novo nem geração de imagem demonstrativa.
- Dashboard/histórico agregado: 90 dias; consulta de sessão por data pode acessar datas anteriores. Refeições/água/cardio são carregados em janela de 90 dias e limite de 1.500 registros; medidas, até 90 registros. Não há paginação completa além desses limites nesta entrega.
- Não há identificação perfeita entre cardio manual e wearable sem identificadores/instantes comuns. A entrega evita totais duplicados separando as origens, mas não apaga nem funde registros reais automaticamente.
- Teste de geração Gemini real com conta autenticada e consentimento, upload real privado e renovação de fotos em produção continuam pendentes. Corrigir primeiro o erro da consulta de metadados Supabase e verificar o bucket privado.
- Habilitar e validar OAuth wearable em contas controladas; concluir aprovação/adaptador Garmin e implementar companions/bridges nativos para Apple/Android. Sem isso, integrações permanecem explicitamente indisponíveis ou exigindo autorização.
- Finalizar tradução das telas antigas e testar Safari/iPhone, Android e acessibilidade em dispositivos reais. O teste automatizado de viewport é somente parte dessa validação.
- As condições de acesso das análises avançadas legadas foram preservadas; a política de assinatura não foi redesenhada. O novo Coach não implementa cobrança.
- Revisar o diff local preservado antes de qualquer commit. Não houve commit, push ou deploy desta retomada. A árvore permanece com alterações anteriores e novas, na branch `main`.

## Recursos pausados e confirmações

Mercado Pago, checkout e regras de assinatura não foram alterados funcionalmente. Nenhum quinto dia foi implementado: o caminho legado de recomendação opcional foi explicitamente bloqueado no backend e aparece pausado, inclusive contra chamadas diretas, para respeitar o escopo desta execução. Sua implementação antiga foi preservada no arquivo, sem habilitá-la.

Nenhum segredo foi exposto. Nenhum dado real foi destruído. Nenhuma foto real foi apagada/enviada. Não houve deploy, alteração de DNS ou git push. Nenhuma integração Manus/Forge foi introduzida.

## Encerramento e estado final

Verificações encerradas em 30/09/2026 07:28:35 Europe/Lisbon. Tempo decorrido desde a primeira inspeção desta retomada: 8 h 3 min 28 s. Inclui o intervalo da interrupção/reinício comunicado pelo ambiente; não representa medição separada de tempo ativo.

Resultado final: check aprovado; test padrão com 80 aprovados e 30 integrações opcionais; suíte com integrações com 110 aprovados; build aprovado sem aviso de chunk acima de 500 kB; git diff --check aprovado. A verificação visual foi repetida sobre o build de produção, após o reinício, com 32 layouts, confirmação explícita e idiomas pt/en/es aprovados.

Git final: branch main, 23 arquivos versionados modificados e 32 arquivos novos não versionados, total de 55 caminhos. Inclui o trabalho recuperado. Nenhum commit ou descarte foi realizado. Auditoria de segredos: 323 arquivos verificados, zero achados e nenhum arquivo de ambiente versionado.
