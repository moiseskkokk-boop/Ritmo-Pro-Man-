import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

export type MercadoPagoSubscriptionStatus = "pending" | "active" | "payment_pending" | "cancelled" | "expired" | "error";
export type MercadoPagoResource = Record<string, unknown> & { id?: string | number; status?: string };

export function normalizeSubscriptionStatus(status: unknown): MercadoPagoSubscriptionStatus {
  switch (String(status ?? "").toLowerCase()) {
    case "authorized": case "active": return "active";
    case "pending": return "pending";
    case "paused": case "payment_pending": return "payment_pending";
    case "cancelled": case "canceled": return "cancelled";
    case "expired": return "expired";
    default: return "error";
  }
}

export function paymentResultStatus(status: unknown, subscriptionStatus: MercadoPagoSubscriptionStatus): MercadoPagoSubscriptionStatus {
  switch (String(status ?? "").toLowerCase()) {
    case "approved": return "active";
    case "pending": case "in_process": case "authorized": return "payment_pending";
    case "rejected": case "cancelled": case "refunded": case "charged_back":
      return subscriptionStatus === "active" ? "payment_pending" : "error";
    default: return subscriptionStatus;
  }
}

export function hasPremiumAccess(status: MercadoPagoSubscriptionStatus | "none", periodEnd: Date | string | null | undefined, now = new Date()): boolean {
  if (status !== "active") return false;
  if (!periodEnd) return true;
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  return Number.isFinite(end.getTime()) && end.getTime() > now.getTime();
}

export function makeWebhookEventKey(topic: string, resourceId: string, action?: string, eventId?: string | number, dateCreated?: string): string {
  if (eventId !== undefined) return `mp:${String(eventId)}`.slice(0, 191);
  return `mp:${topic}:${resourceId}:${action ?? "update"}:${dateCreated ?? "undated"}`.slice(0, 191);
}

export function canClaimWebhookEvent(status: string, processingAt: Date | null, now = new Date(), leaseMs = 120_000): boolean {
  if (status === "processed") return false;
  if (status !== "processing") return true;
  return !processingAt || now.getTime() - processingAt.getTime() >= leaseMs;
}

export function makeUserExternalReference(userId: number, nonce: string): string {
  if (!Number.isSafeInteger(userId) || userId < 1 || !/^[a-f0-9]{16,64}$/i.test(nonce)) throw new Error("Invalid subscription reference input");
  return `ritmo-${userId}-${nonce}`;
}

export function isMercadoPagoCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && /(?:^|\.)mercadopago\.(?:com(?:\.[a-z]{2})?|[a-z]{2})$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function verifyMercadoPagoSignature(args: {
  signature: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string;
}): boolean {
  if (!args.signature || !args.requestId || !args.dataId || !args.secret) return false;
  const fields = Object.fromEntries(args.signature.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
  const timestamp = fields.ts;
  const received = fields.v1;
  if (!timestamp || !received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const manifest = `id:${args.dataId.toLowerCase()};request-id:${args.requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", args.secret).update(manifest).digest();
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class MercadoPagoClient {
  constructor(
    private readonly accessToken = ENV.mercadoPagoAccessToken,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async request<T extends MercadoPagoResource>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error("Mercado Pago backend credentials are not configured");
    const response = await this.fetcher(`https://api.mercadopago.com${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.accessToken}`, "content-type": "application/json", ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Mercado Pago API returned ${response.status}${text ? `: ${text.slice(0, 500)}` : ""}`);
    }
    return response.json() as Promise<T>;
  }

  createMonthlySubscription(input: { externalReference: string; email: string; amount: string; currency: string; publicUrl: string }) {
    const url = new URL("/api/webhooks/mercadopago", input.publicUrl).toString();
    return this.request<MercadoPagoResource & { init_point?: string; date_created?: string; next_payment_date?: string }>("/preapproval", {
      method: "POST",
      headers: { "x-idempotency-key": input.externalReference },
      body: JSON.stringify({
        reason: "Ritmo Pro Man — Plano mensal",
        external_reference: input.externalReference,
        payer_email: input.email,
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(input.amount), currency_id: input.currency },
        back_url: `${input.publicUrl.replace(/\/$/, "")}/perfil?subscription=returned`,
        notification_url: url,
        status: "pending",
      }),
    });
  }

  getSubscription(id: string) { return this.request<MercadoPagoResource & { date_created?: string; next_payment_date?: string; reason?: string; external_reference?: string }>(`/preapproval/${encodeURIComponent(id)}`); }
  getPayment(id: string) { return this.request<MercadoPagoResource & { preapproval_id?: string; status?: string; transaction_amount?: number; currency_id?: string; date_approved?: string }>(`/v1/payments/${encodeURIComponent(id)}`); }
  cancelSubscription(id: string) {
    return this.request<MercadoPagoResource>(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "canceled" }) });
  }
}
