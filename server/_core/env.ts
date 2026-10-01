import { randomBytes } from "node:crypto";

const developmentJwtSecret = randomBytes(32);

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  geminiDailyTokenLimit: Number(process.env.GEMINI_DAILY_TOKEN_LIMIT ?? "100000"),
  geminiUserDailyTokenLimit: Number(process.env.GEMINI_USER_DAILY_TOKEN_LIMIT ?? "20000"),
  geminiMaxInputTokens: Number(process.env.GEMINI_MAX_INPUT_TOKENS ?? "12000"),
  geminiMaxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "5000"),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "ritmo-private",
  appPublicUrl: process.env.PUBLIC_APP_URL ?? "",
  appTimeZone: process.env.APP_TIME_ZONE ?? "Europe/Lisbon",
  wearableTokenEncryptionKey: process.env.WEARABLE_TOKEN_ENCRYPTION_KEY ?? "",
  googleHealthClientId: process.env.GOOGLE_HEALTH_CLIENT_ID ?? "",
  googleHealthClientSecret: process.env.GOOGLE_HEALTH_CLIENT_SECRET ?? "",
  googleHealthRedirectUri: process.env.GOOGLE_HEALTH_REDIRECT_URI ?? "",
  garminClientId: process.env.GARMIN_CLIENT_ID ?? "",
  garminClientSecret: process.env.GARMIN_CLIENT_SECRET ?? "",
  garminAuthorizeUrl: process.env.GARMIN_AUTHORIZE_URL ?? "",
  garminTokenUrl: process.env.GARMIN_TOKEN_URL ?? "",
  garminApiBaseUrl: process.env.GARMIN_API_BASE_URL ?? "",
  freeProAccess: (process.env.FREE_PRO_ACCESS ?? "true").toLowerCase() === "true",
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
  mercadoPagoPlanMonthlyPrice: process.env.MERCADOPAGO_PLAN_MONTHLY_PRICE ?? "33.99",
  mercadoPagoCurrency: process.env.MERCADOPAGO_CURRENCY ?? "BRL",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  appleServiceId: process.env.APPLE_SERVICE_ID ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
};

export function getJwtSecret(): Uint8Array {
  if (ENV.cookieSecret) {
    if (Buffer.byteLength(ENV.cookieSecret, "utf8") < 32) {
      throw new Error("JWT_SECRET must contain at least 32 bytes");
    }
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  if (ENV.isProduction) {
    throw new Error("JWT_SECRET must be configured in production");
  }

  return developmentJwtSecret;
}
