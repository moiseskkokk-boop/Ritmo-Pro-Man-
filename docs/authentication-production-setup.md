# Autenticação, confirmação e e-mails transacionais

## Variáveis no Render

Configure somente no ambiente do servidor:

- `DATABASE_URL`: conexão MySQL do servidor e das migrações. Não publicar no frontend.
- `JWT_SECRET`: segredo aleatório com pelo menos 32 bytes, obrigatório em produção. O fallback de desenvolvimento não deve ser usado no servidor público.
- `RESEND_API_KEY`: chave privada do Resend, configurada somente no Render.
- `EMAIL_FROM`: remetente verificado no Resend, por exemplo `Ritmo Pro Man <contato@seudominio.com>`.
- `PUBLIC_APP_URL`: origem pública HTTPS usada para links de confirmação, recuperação e troca de e-mail. Em produção, deve apontar para o domínio oficial.
- `GOOGLE_CLIENT_ID`: ID público do OAuth Client Web configurado no Google Cloud.
- `APPLE_SERVICE_ID`: Service ID configurado para Sign in with Apple.

Google Identity Services entrega um ID token com nonce. O backend verifica audiência, emissor, validade e e-mail confirmado diretamente com o endpoint de validação do Google antes de criar a sessão. Apple Sign in usa o SDK oficial da Apple; state é comparado no retorno e o backend valida assinatura, emissor, audiência e nonce do ID token usando as chaves públicas da Apple.

Desafios OAuth são consumidos uma única vez no banco, mesmo se o cookie assinado original for reenviado. O frontend renova o desafio Google após uma falha de login.

Não é necessário colocar nenhum segredo OAuth no frontend. Os IDs de cliente são configuração pública do provedor e o endpoint de configuração retorna apenas esses IDs. A chave de envio de e-mail permanece no servidor.

## Fluxos e segurança

- Novos cadastros ficam sem sessão até confirmar o e-mail. A confirmação expira em 30 minutos. Contas existentes na data da migração são preservadas como verificadas para evitar bloquear usuários atuais.
- Tokens de confirmação, recuperação e troca de e-mail são aleatórios, armazenados no banco somente como SHA-256, expiram e são consumidos uma única vez.
- Cada token é vinculado ao endereço destinatário. Troca de senha/e-mail revoga links pendentes e sessões, e mudanças concorrentes de credenciais impedem aplicar um token já reivindicado com a versão anterior da sessão.
- A emissão é serializada por conta em transação. Reenvios substituem links anteriores; uma emissão iniciada com versão antiga da sessão é rejeitada.
- Login e cadastro executam o cálculo de senha também para contas existentes/inexistentes, reduzindo enumeração por tempo. Recuperação, reenvio, cadastro duplicado e solicitação de troca para endereço ocupado mantêm respostas neutras.
- Os limites por identidade são globais entre IPs; existe também limite por IP. Confirmação, redefinição e alteração de senha possuem limites próprios.
- Sessões exigem assinatura, assunto, emissão, expiração, versão atual e conta verificada. Cookies são HttpOnly, SameSite=Lax e sempre Secure em produção.
- Se um provedor confirmar uma conta local ainda não verificada, a senha anterior é removida e os links anteriores são revogados para impedir ativar uma senha cadastrada por terceiros.
- Tokens expirados são removidos quando um novo token de autenticação por e-mail é emitido.
- Os links carregam o token no fragmento (`#token=`/`#reset=`), que não é enviado na requisição HTTP inicial nem incluído no caminho de acesso do Render. A página remove o fragmento do histórico assim que captura o token.
- A recuperação expira em 20 minutos, invalida sessões anteriores e envia aviso de segurança. A resposta é neutra para contas existentes ou inexistentes.
- A troca de e-mail mantém o endereço atual até a confirmação no novo endereço, avisa o endereço anterior e invalida sessões antigas ao concluir.
- Os limites por endereço/IP ficam em `auth_rate_limits`, no mesmo banco, e não dependem da memória de uma instância do Render.
- Os templates incluem versões HTML e texto simples para confirmação, troca de e-mail, recuperação, boas-vindas, alteração de senha e alerta de segurança. Falhas transitórias do Resend não interrompem a aplicação; os endpoints de recuperação e reenvio mantêm resposta neutra.
- O Resend recebe uma chave de idempotência por evento, evitando reenvio duplicado em retries dentro da janela suportada pelo provedor.
- Se `RESEND_API_KEY`, `EMAIL_FROM` ou `PUBLIC_APP_URL` não estiverem disponíveis, nenhum e-mail será enviado. Configure-os no serviço Render e valide o domínio/remetente no Resend. Para OAuth, configure também `GOOGLE_CLIENT_ID` e `APPLE_SERVICE_ID`; não há segredo OAuth privado no frontend.
- Os aceites de Termos e Política são registrados com data e versão (`2026-09`) para novos cadastros.

## Operação

Após sincronizar/aplicar as migrações `0016_auth_email_verification_tokens_rate_limits.sql`, `0017_auth_rate_limit_retention_index.sql` e `0018_auth_email_token_retention_index.sql`, configure as três variáveis Resend acima no Render e envie um cadastro de teste para um endereço controlado. Confirme recebimento, expiração, uso único e entrega ao spam antes de habilitar cadastros publicamente. As credenciais Google/Apple são opcionais para senha/e-mail e devem ser adicionadas ao Render apenas quando os respectivos projetos/domínios estiverem configurados.

Use `corepack pnpm db:migrate:auth` para aplicar somente 0015–0018 (0015 registra os aceites). O executor verifica checksums e cada entrada do histórico e usa um lock no banco. MySQL confirma DDL implicitamente: se houver falha parcial, inspecione o esquema antes de repetir.

Nesta validação, 0015–0018 foram aplicadas ao banco configurado; 0013 e 0014 ficaram pendentes por serem de treinos/alimentação. Não executar `drizzle-kit migrate` diretamente: seu marcador pela maior data ignoraria pendências anteriores. Os scripts `db:migrate` e `db:push` agora usam o executor por entrada; o comando geral aplica também as pendências fora de autenticação e deve ser usado apenas no escopo correspondente.

Validação automatizada: `corepack pnpm check`, `corepack pnpm test` e `corepack pnpm build`. Para os testes de integração, execute `AUTH_DATABASE_TESTS=1 corepack pnpm test`. Eles usam tabelas temporárias na mesma conexão para sombrear as tabelas reais, sem alterar contas existentes, e capturam os e-mails em memória. O usuário do banco precisa de permissão para criar tabelas temporárias. Essa execução não valida entrega real do Resend nem autenticação interativa de Google/Apple.

Os limites usam o banco de dados e um bucket temporal fixo. Registros de limite com mais de 48 horas são removidos durante chamadas aos fluxos de autenticação. Configure também políticas e contatos reais no material legal antes de lançamento.
