# Validação de autenticação — 29/09/2026

## Resultado

Escopo de código e validação automatizada concluído. Alterações locais anteriores preservadas. Nenhum deploy ou git push realizado. Nenhuma chave, senha, token ou valor privado do `.env` foi impresso. A verificação dos artefatos encontrou zero valores privados do `.env` no diretório `dist`.

## O que foi validado

- Cadastro com aceite obrigatório e registro das versões de Termos/Privacidade; normalização do endereço; senha armazenada com scrypt e salt aleatório; nenhuma sessão antes da confirmação.
- Confirmação por token aleatório armazenado somente como SHA-256; expiração, propósito correto, endereço vinculado, uso único e criação de sessão.
- Login, restauração da sessão, recuperação, redefinição, novo login e logout usando o backend real com MySQL em tabelas temporárias. Os e-mails foram capturados em memória, sem envio externo.
- Rejeição de JWT adulterado, sem expiração, expirado, de conta inexistente, não verificada ou com versão revogada.
- Revogação das sessões antigas após redefinição, troca de senha, troca de e-mail e logout. Uso único de tokens mesmo em duas tentativas concorrentes.
- Respostas neutras no cadastro duplicado, recuperação e reenvio. Acesso ao histórico de outra conta bloqueado; campos de proprietário enviados pelo cliente não mudam o proprietário autenticado.
- Troca de e-mail mantém o endereço atual até confirmar o novo endereço, avisa as partes e revoga sessões e links anteriores.
- Limites persistentes no banco, por identidade e IP, incluindo operações sensíveis.
- Templates HTML e texto simples dos sete tipos de mensagem, escape de conteúdo, timeout, idempotência e falhas de envio sem registrar segredos.
- Proteção contra replay de desafios OAuth e rejeição de nonce divergente com resposta simulada do Google. O login interativo real dos provedores permanece uma etapa externa.

## Problemas encontrados e correções

- Login de conta inexistente e cadastro duplicado evitavam o cálculo de senha, criando diferença de tempo identificável. Agora também executam scrypt nesses caminhos. Isso reduz esse sinal de enumeração; não representa garantia de tempos idênticos em redes ou bancos reais.
- Limite por endereço estava combinado com IP e podia ser contornado trocando IP. Agora a identidade tem limite global, além do limite por IP.
- Confirmação, aplicação da recuperação e mudança de senha não tinham limites próprios. Foram adicionados.
- Tokens pendentes sobreviviam a mudanças de credenciais e emissões simultâneas não eram serializadas. Emissão e atualização de credenciais agora usam transações; links antigos são revogados e ações já reivindicadas são rejeitadas se a versão da sessão mudar antes da aplicação.
- Tokens não vinculavam confirmação/recuperação ao endereço atual. Agora carregam o endereço destinatário e a confirmação de troca confere o endereço pendente.
- Login social podia ativar a senha de uma conta local ainda não verificada. A confirmação pelo provedor agora remove essa senha, revoga links antigos e incrementa a versão da sessão.
- Desafio OAuth dependia apenas da exclusão do cookie para impedir replay. Agora seu consumo único é registrado no banco; o Google recebe novo desafio após falha no frontend.
- Sessões aceitavam JWT sem expiração obrigatória e não exigiam conta verificada. Essas condições agora são exigidas; cookies são sempre Secure em produção.
- Nome em texto simples era escapado como HTML. As duas representações agora são renderizadas corretamente.
- Solicitar troca para endereço ocupado revelava sua existência. Agora retorna resposta neutra; colisões durante confirmação recebem mensagem controlada.
- Remoção de conta não limpava tokens de e-mail. A limpeza foi acrescentada sem modificar o fluxo de pagamentos existente.
- O banco estava migrado apenas até 0012. Aplicar uma migração posterior com o executor original faria o Drizzle ignorar pendências anteriores. O novo executor valida checksums, usa lock e confere cada entrada individualmente.
- A primeira rodada encontrou fixtures sem os novos campos de segurança; foram atualizadas. Os testes MySQL exigiram adaptação da criação de tabelas temporárias e timeout compatível com a conexão remota. A checagem do novo executor encontrou `await` no nível superior incompatível com o target atual; foi corrigido com função assíncrona.

## Migrações efetivamente aplicadas

- `0015_nebulous_slayback.sql`: datas de aceite, necessárias para o cadastro.
- `0016_auth_email_verification_tokens_rate_limits.sql`: tabelas de tokens/limites e campos de verificação e versões de aceite; preserva acesso de contas anteriores com e-mail ao marcá-las verificadas.
- `0017_auth_rate_limit_retention_index.sql`: índice de retenção dos limites.
- `0018_auth_email_token_retention_index.sql`: índice de expiração dos tokens.

As quatro migrações são aditivas e não removem estruturas nem registros existentes. Histórico, seis colunas de autenticação, índices e cadeia dos snapshots foram conferidos após a execução. Uma segunda execução não reaplicou nenhuma migração.

0013 e 0014 permanecem pendentes, por tratarem de treinos/alimentação. Nenhuma funcionalidade de Mercado Pago, assinatura ou quinto dia foi alterada. Usar os scripts do projeto para futuras migrações; `drizzle-kit migrate` diretamente usa a maior data do histórico e ignoraria essas pendências.

## Verificações finais

| Comando | Resultado |
| --- | --- |
| `corepack pnpm check` | Passou, incluindo o executor de migrações |
| `corepack pnpm test` | 62 testes passaram; 8 de integração exigem ativação explícita |
| `AUTH_DATABASE_TESTS=1 corepack pnpm test server/auth.database.test.ts` | Os 8 testes de integração passaram |
| `corepack pnpm build` | Passou; frontend e servidor gerados |
| `corepack pnpm db:migrate:auth` após aplicação | Passou, sem reaplicar migrações |
| `git diff --check` | Passou |

O build apresenta aviso de bundle frontend acima de 500 kB: aproximadamente 644 kB antes de gzip e 182 kB com gzip. Não é falha de build. Os testes de integração sombreiam as tabelas com tabelas temporárias na conexão e não modificam registros reais.

## Configuração e etapas externas restantes

`DATABASE_URL` está disponível no ambiente local. As seguintes variáveis não estão configuradas nesse ambiente; a configuração do Render não foi consultada:

- `JWT_SECRET`: obrigatório em produção, aleatório, com pelo menos 32 bytes.
- `RESEND_API_KEY`, `EMAIL_FROM` e `PUBLIC_APP_URL`: necessários para envio, remetente verificado e links HTTPS do domínio oficial.
- `GOOGLE_CLIENT_ID` e `APPLE_SERVICE_ID`: necessários somente para habilitar os respectivos logins sociais.

Ainda depende de serviço externo configurar/verificar domínio e remetente no Resend, receber mensagens em uma caixa controlada, verificar spam e percorrer os links reais. Configure também os projetos/domínios de Google e Apple e valide os logins interativos. Os testes simulados não comprovam essas integrações nem a configuração de produção. Não houve envio externo de mensagens nem deploy durante esta validação.
