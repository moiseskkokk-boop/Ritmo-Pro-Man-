# Autenticação e recuperação de senha

## Variáveis no Render

Configure somente no ambiente do servidor:

- `GOOGLE_CLIENT_ID`: ID público do OAuth Client do tipo Web criado no Google Cloud. Autorize o domínio da aplicação como origem JavaScript.
- `APPLE_SERVICE_ID`: Service ID habilitado para Sign in with Apple no portal Apple Developer. Registre o domínio e a URL de retorno da aplicação.
- `RESEND_API_KEY`: chave privada do projeto Resend usado para enviar e-mails de recuperação.
- `EMAIL_FROM`: remetente verificado no Resend, por exemplo `Ritmo Pro Man <contato@seudominio.com>`.
- `PUBLIC_APP_URL`: origem pública HTTPS usada para construir links de recuperação.

Google Identity Services entrega um ID token com nonce. O backend verifica audiência, emissor, validade e e-mail confirmado diretamente com o endpoint de validação do Google antes de criar a sessão. Apple Sign in usa o SDK oficial da Apple; state é comparado no retorno e o backend valida assinatura, emissor, audiência e nonce do ID token usando as chaves públicas da Apple.

Não é necessário colocar nenhum segredo OAuth no frontend. Os IDs de cliente são configuração pública do provedor e o endpoint de configuração retorna apenas esses IDs. A chave de envio de e-mail permanece no servidor.

## Recuperação

O link de recuperação expira em 20 minutos. A redefinição incrementa a versão de sessão e invalida sessões anteriores; por isso um link já usado não pode ser reutilizado. Sem `RESEND_API_KEY`, `EMAIL_FROM` e `PUBLIC_APP_URL`, a recuperação responde como não configurada.

## Limites pendentes

O projeto não possui confirmação de e-mail no cadastro, CAPTCHA ou serviço de limitação distribuída de tentativas. O login Apple/Google depende do consentimento e da configuração de cada fornecedor. Antes de lançar publicamente, conclua verificação de domínio, políticas e contato real de suporte; os textos legais incluídos são um ponto de partida do produto e precisam dos dados jurídicos do operador.
