import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { canClaimWebhookEvent, isMercadoPagoCheckoutUrl, makeUserExternalReference, MercadoPagoClient, normalizeSubscriptionStatus, paymentResultStatus, hasPremiumAccess } from "./mercadopago";
import { processMercadoPagoWebhook } from "./mercadopago-service";

const secret = "local-test-webhook-secret-never-used-in-production";
function signature(dataId: string, requestId: string) {
  const ts = "1728045000";
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}
function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    begin: vi.fn(async () => true), finish: vi.fn(async () => undefined),
    findSubscription: vi.fn(async () => ({ id: 5, userId: 42, status: "pending" as const })),
    findByExternalReference: vi.fn(async () => null),
    updateSubscription: vi.fn(async () => null), upsertPayment: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as NonNullable<Parameters<typeof processMercadoPagoWebhook>[0]["repo"]>;
}

describe("Mercado Pago subscription states and access", () => {
  it("maps provider subscription lifecycle states", () => {
    expect(normalizeSubscriptionStatus("authorized")).toBe("active");
    expect(normalizeSubscriptionStatus("pending")).toBe("pending");
    expect(normalizeSubscriptionStatus("paused")).toBe("payment_pending");
    expect(normalizeSubscriptionStatus("cancelled")).toBe("cancelled");
    expect(normalizeSubscriptionStatus("expired")).toBe("expired");
    expect(normalizeSubscriptionStatus("unknown")).toBe("error");
  });

  it("only grants backend entitlement to active, unexpired subscriptions", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(hasPremiumAccess("active", "2026-02-01T00:00:00Z", now)).toBe(true);
    expect(hasPremiumAccess("pending", "2026-02-01T00:00:00Z", now)).toBe(false);
    expect(hasPremiumAccess("none", null, now)).toBe(false);
    expect(hasPremiumAccess("cancelled", null, now)).toBe(false);
    expect(hasPremiumAccess("active", "2025-12-31T00:00:00Z", now)).toBe(false);
  });

  it("binds external references to the authenticated user id", () => {
    expect(makeUserExternalReference(42, "abcdef0123456789abcdef0123456789")).toMatch(/^ritmo-42-/);
    expect(() => makeUserExternalReference(0, "abcdef0123456789")).toThrow();
  });

  it("claims each webhook once, while allowing failed or expired processing leases to retry", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(canClaimWebhookEvent("queued", null, now)).toBe(true);
    expect(canClaimWebhookEvent("failed", null, now)).toBe(true);
    expect(canClaimWebhookEvent("processed", null, now)).toBe(false);
    expect(canClaimWebhookEvent("processing", new Date(now.getTime() - 30_000), now)).toBe(false);
    expect(canClaimWebhookEvent("processing", new Date(now.getTime() - 121_000), now)).toBe(true);
    expect(canClaimWebhookEvent("processing", null, now)).toBe(true);
  });

  it("creates recurring checkout through the backend provider API", async () => {
    let sent: Request | undefined;
    const client = new MercadoPagoClient("server-token", async (input, init) => {
      sent = new Request(input, init);
      return new Response(JSON.stringify({ id: "sub-1", init_point: "https://www.mercadopago.com/subscriptions/checkout/1" }), { status: 201 });
    });
    const result = await client.createMonthlySubscription({ externalReference: "ritmo-42-acde0123456789abcdef", email: "user@example.com", amount: "33.99", currency: "BRL", publicUrl: "https://ritmoproman.com" });
    const body = await sent!.clone().json() as Record<string, any>;
    expect(sent!.url).toBe("https://api.mercadopago.com/preapproval");
    expect(sent!.headers.get("authorization")).toBe("Bearer server-token");
    expect(body.auto_recurring).toEqual({ frequency: 1, frequency_type: "months", transaction_amount: 33.99, currency_id: "BRL" });
    expect(body.external_reference).toBe("ritmo-42-acde0123456789abcdef");
    expect(result.init_point).toContain("mercadopago.com");
    expect(sent!.headers.get("x-idempotency-key")).toBe("ritmo-42-acde0123456789abcdef");
    expect(isMercadoPagoCheckoutUrl(result.init_point!)).toBe(true);
    expect(isMercadoPagoCheckoutUrl("https://mercadopago.com.attacker.example/checkout")).toBe(false);
    expect(isMercadoPagoCheckoutUrl("javascript:alert(1)")).toBe(false);
  });

  it("cancels recurring billing through Mercado Pago's subscription endpoint", async () => {
    let sent: Request | undefined;
    const client = new MercadoPagoClient("server-token", async (input, init) => {
      sent = new Request(input, init);
      return new Response(JSON.stringify({ id: "sub-1", status: "cancelled" }), { status: 200 });
    });
    const result = await client.cancelSubscription("sub-1");
    expect(sent!.method).toBe("PUT");
    expect(sent!.url).toBe("https://api.mercadopago.com/preapproval/sub-1");
    expect(await sent!.clone().json()).toEqual({ status: "canceled" });
    expect(result.status).toBe("cancelled");
  });

  it.each([
    ["approved", "active"], ["pending", "payment_pending"], ["rejected", "error"],
  ] as const)("reconciles a %s payment against the authenticated subscription owner", async (paymentStatus, expectedStatus) => {
    const repo = makeRepo();
    const payment = { id: "pay-7", preapproval_id: "sub-7", status: paymentStatus, transaction_amount: 9.9, currency_id: "BRL", date_approved: paymentStatus === "approved" ? "2026-01-02T00:00:00Z" : undefined };
    const result = await processMercadoPagoWebhook({
      event: { id: "event-7", type: "payment", action: "payment.updated", data: { id: "pay-7" } },
      signature: signature("pay-7", "request-7"), requestId: "request-7", queryDataId: "pay-7", secret,
      client: { getPayment: vi.fn(async () => payment), getSubscription: vi.fn(), cancelSubscription: vi.fn(async () => ({ status: "cancelled" })) }, repo,
    });
    expect(result.status).toBe(200);
    expect(repo.upsertPayment).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, providerPaymentId: "pay-7", status: paymentStatus }));
    expect(repo.updateSubscription).toHaveBeenCalledWith("sub-7", expect.objectContaining({ localId: 5, status: expectedStatus, lastPaymentId: "pay-7" }));
    expect(repo.finish).toHaveBeenCalledWith("mp:event-7", "processed");
  });

  it.each([["cancelled", "cancelled"], ["expired", "expired"]] as const)("reconciles subscription %s events", async (providerStatus, expectedStatus) => {
    const repo = makeRepo();
    const result = await processMercadoPagoWebhook({
      event: { id: `event-${providerStatus}`, type: "subscription_preapproval", action: "updated", data: { id: "sub-9" } },
      signature: signature("sub-9", "request-9"), requestId: "request-9", queryDataId: "sub-9", secret,
      client: { getSubscription: vi.fn(async () => ({ id: "sub-9", status: providerStatus })), getPayment: vi.fn(), cancelSubscription: vi.fn() }, repo,
    });
    expect(result.status).toBe(200);
    expect(repo.updateSubscription).toHaveBeenCalledWith("sub-9", expect.objectContaining({ localId: 5, status: expectedStatus }));
  });

  it("rejects an invalid webhook before touching persistence", async () => {
    const repo = makeRepo();
    const result = await processMercadoPagoWebhook({
      event: { type: "payment", data: { id: "pay-1" } }, signature: "ts=1,v1=00", requestId: "request", queryDataId: "pay-1", secret,
      client: { getPayment: vi.fn(), getSubscription: vi.fn(), cancelSubscription: vi.fn() }, repo,
    });
    expect(result.status).toBe(401);
    expect(repo.begin).not.toHaveBeenCalled();
  });

  it("acknowledges duplicate webhook events without refetching the provider", async () => {
    const repo = makeRepo({ begin: vi.fn(async () => false) });
    const getPayment = vi.fn();
    const result = await processMercadoPagoWebhook({
      event: { id: "event-duplicate", type: "payment", data: { id: "pay-2" } }, signature: signature("pay-2", "request-2"), requestId: "request-2", queryDataId: "pay-2", secret,
      client: { getPayment, getSubscription: vi.fn(), cancelSubscription: vi.fn() }, repo,
    });
    expect(result).toMatchObject({ status: 200, duplicate: true });
    expect(getPayment).not.toHaveBeenCalled();
  });
});
