# Wearables — fontes oficiais e limites

Pesquisa realizada em 2026-09-28 para orientar a integração do Ritmo Pro Man.

- Apple HealthKit: https://developer.apple.com/documentation/healthkit
  - Não há API web/REST/OAuth para React/Express. Exige app iOS/watchOS nativo assinado com HealthKit/HKHealthStore e permissões granulares; o app pode sincronizar dados autorizados para a API própria.
  - Métricas possíveis quando disponíveis: treinos/duração, energia/calorias, frequência cardíaca, passos, distância, sono e recuperação de 1 minuto; ausência deve ser tratada por métrica.
- Android Health Connect: https://developer.android.com/health-and-fitness/health-connect
  - Não há acesso direto pelo navegador ou backend. Exige app Android nativo com Jetpack Health Connect e permissões READ_*; histórico/background têm permissões adicionais.
  - Métricas possíveis: ExerciseSession, calorias, HeartRate, passos, distância, sono e HRV; não existe score oficial genérico de recuperação.
- Garmin Connect Developer Program: https://developer.garmin.com/gc-developer-program/
  - Web/backend é viável via Health API/Activity API e OAuth 2.0, mas exige candidatura/aprovação e credenciais; Health API/Activity API não é autoatendimento aberto. Dados podem vir JSON/FIT/GPX/TCX. Body Battery é indicador oficial; não prometer recovery time sem payload.
- Garmin Health API: https://developer.garmin.com/gc-developer-program/health-api/
- Garmin Activity API: https://developer.garmin.com/gc-developer-program/activity-api/
- Google Health API (sucessora atual para Fitbit Web API): https://developers.google.com/health
  - Web React/Express via OAuth 2.0 Web Server é possível, com projeto, scopes mínimos e tokens no servidor; verificação/CASA e política são necessárias para público maior. Não iniciar nova integração na Fitbit Web API legada.
- Google Health setup: https://developers.google.com/health/setup
- Google Health scopes: https://developers.google.com/health/scopes
- Google Health migration/API specs: https://developers.google.com/health/migration/api-specifications
- Google Health app verification: https://developers.google.com/health/app-verification
- COROS MCP: https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP
  - Web/backend viável via OAuth 2.0 + MCP; self-service é individual e não cobre multiusuário centralizado, webhooks, GPX ou sync bidirecional. Partner API exige revisão/credenciais para escala.
  - Métricas possíveis: atividades, duração, distância, calorias, FC, passos, sono, recuperação/HRV, estresse e detalhes de atividade.

Decisão técnica: o projeto recebeu modelo comum `wearable_connections` + `wearable_activities`, ingestão idempotente por `(userId, provider, externalId)`, histórico real por data e análise agregada semanal. A UI informa autorização/limites explicitamente e não simula dados. COROS/Google Health podem receber conectores web após credenciais; Garmin requer aprovação; Apple Health/Health Connect requerem companions móveis nativos.
