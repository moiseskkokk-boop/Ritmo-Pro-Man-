# Mercado Pago subscriptions

## Backend environment

The Render service already declares the private credential slots. Configure these in the Render service environment; never add their values to Vite variables or source control:

- `MERCADOPAGO_ACCESS_TOKEN`: access token for the Mercado Pago application.
- `MERCADOPAGO_WEBHOOK_SECRET`: secret generated in the Mercado Pago Webhooks settings for that application.
- `MERCADOPAGO_PLAN_MONTHLY_PRICE`: monthly price, decimal format; current Render value is `33.99`.
- `MERCADOPAGO_CURRENCY`: ISO 4217 currency; initial Render value is `BRL`.
- `PUBLIC_APP_URL`: public HTTPS origin. The Render config uses `https://ritmoproman.com`.

The account country and merchant setup must support the configured currency and subscriptions. Mercado Pago currently lists subscription availability for Argentina, Brazil, Chile, Colombia, Mexico, Peru and Uruguay; Portugal is not listed. Confirm that the receiving merchant account is in a supported country before enabling live checkout. Update price and currency together after confirming that setup in the merchant account.

## Mercado Pago dashboard

1. Create/select the production application and copy its production access token to Render `MERCADOPAGO_ACCESS_TOKEN`.
2. Configure Webhooks for the production application at `https://ritmoproman.com/api/webhooks/mercadopago`.
3. Enable subscription/preapproval notifications and payment notifications. Save the settings and copy the generated signing secret to Render `MERCADOPAGO_WEBHOOK_SECRET`.
4. Deploy the service and confirm `/health` responds before using the Webhooks simulator. The endpoint validates `x-signature`, then fetches the payment or subscription directly from Mercado Pago before changing local access.
5. For safe integration checks, use Mercado Pago test credentials and test users in a separate test environment. Tests in this repository mock provider responses and do not submit payments.

The application creates monthly recurring preapprovals server-side. Mercado Pago's `init_point` is the only payment URL returned to the authenticated browser. The application does not activate an account from a browser return URL.

Official references:

- [Create a subscription](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post)
- [Update/cancel a subscription](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/update-preapproval/put)
- [Configure and validate Webhooks](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod)
