import {
  beginMercadoPagoWebhookEvent, finishMercadoPagoWebhookEvent, getSubscriptionByExternalReference, getSubscriptionByProviderId,
  updateSubscriptionByProviderId, upsertSubscriptionPayment,
} from "./db";
import {
  makeWebhookEventKey, MercadoPagoClient, normalizeSubscriptionStatus, paymentResultStatus,
  verifyMercadoPagoSignature,
} from "./mercadopago";

type WebhookEvent = { id?: string | number; type?: string; topic?: string; action?: string; date_created?: string; data?: { id?: string | number } };
type Repo = {
  begin: typeof beginMercadoPagoWebhookEvent;
  finish: typeof finishMercadoPagoWebhookEvent;
  findSubscription: typeof getSubscriptionByProviderId;
  findByExternalReference: typeof getSubscriptionByExternalReference;
  updateSubscription: typeof updateSubscriptionByProviderId;
  upsertPayment: typeof upsertSubscriptionPayment;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function processMercadoPagoWebhook(input: {
  event: WebhookEvent;
  signature?: string;
  requestId?: string;
  queryDataId?: string;
  secret: string;
  client: Pick<MercadoPagoClient, "getSubscription" | "getPayment" | "cancelSubscription">;
  repo?: Repo;
}) {
  const dataId = String(input.queryDataId ?? input.event.data?.id ?? "");
  if (!verifyMercadoPagoSignature({ signature: input.signature, requestId: input.requestId, dataId, secret: input.secret })) {
    return { ok: false as const, status: 401, message: "Invalid Mercado Pago signature" };
  }
  const topic = String(input.event.type ?? input.event.topic ?? "").toLowerCase();
  const resourceId = dataId;
  if (!resourceId || !["payment", "subscription_preapproval", "preapproval"].includes(topic)) {
    return { ok: true as const, status: 200, ignored: true };
  }
  const eventKey = makeWebhookEventKey(topic, resourceId, input.event.action, input.event.id, input.event.date_created);
  const repo = input.repo ?? {
    begin: beginMercadoPagoWebhookEvent,
    finish: finishMercadoPagoWebhookEvent,
    findSubscription: getSubscriptionByProviderId,
    findByExternalReference: getSubscriptionByExternalReference,
    updateSubscription: updateSubscriptionByProviderId,
    upsertPayment: upsertSubscriptionPayment,
  };
  const shouldProcess = await repo.begin({ eventKey, topic, resourceId });
  if (!shouldProcess) return { ok: true as const, status: 200, duplicate: true };
  try {
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      const remote = await input.client.getSubscription(resourceId);
      const existing = await repo.findSubscription(resourceId) ?? (typeof remote.external_reference === "string" ? await repo.findByExternalReference(remote.external_reference) : null);
      if (existing) {
        const status = normalizeSubscriptionStatus(remote.status);
        await repo.updateSubscription(resourceId, {
          localId: existing.id,
          status,
          periodStart: parseDate(remote.date_created),
          periodEnd: parseDate(remote.next_payment_date),
          cancelledAt: status === "cancelled" ? new Date() : undefined,
          expiredAt: status === "expired" ? new Date() : undefined,
        });
      }
    } else {
      const payment = await input.client.getPayment(resourceId);
      const subscriptionId = typeof payment.preapproval_id === "string" ? payment.preapproval_id : null;
      const subscription = (subscriptionId ? await repo.findSubscription(subscriptionId) : null) ?? (typeof payment.external_reference === "string" ? await repo.findByExternalReference(payment.external_reference) : null);
      if (subscription && payment.id != null) {
        const paymentStatus = String(payment.status ?? "unknown").toLowerCase();
        let status = subscription.status === "cancelled" || subscription.status === "expired"
          ? subscription.status
          : paymentResultStatus(paymentStatus, subscription.status);
        if (paymentStatus === "rejected" && subscription.status === "pending" && subscriptionId) {
          const cancellation = await input.client.cancelSubscription(subscriptionId);
          status = cancellation.status === "cancelled" || cancellation.status === "canceled" ? "error" : "payment_pending";
        }
        const amount = typeof payment.transaction_amount === "number" ? payment.transaction_amount.toFixed(2) : null;
        const currency = typeof payment.currency_id === "string" ? payment.currency_id : null;
        const paymentId = String(payment.id);
        await repo.upsertPayment({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          providerPaymentId: paymentId,
          status: paymentStatus,
          amount,
          currency,
          paidAt: parseDate(payment.date_approved),
        });
        await repo.updateSubscription(subscriptionId ?? "", { localId: subscription.id, status, lastPaymentId: paymentId, lastPaymentStatus: paymentStatus });
      }
    }
    await repo.finish(eventKey, "processed");
    return { ok: true as const, status: 200, duplicate: false };
  } catch (error) {
    await repo.finish(eventKey, "failed").catch(() => undefined);
    throw error;
  }
}
