import type { Payment, WebhookEvent } from './types.js';

interface YooKassaWebhookBody {
  object: {
    id: string;
    status: string;
    amount: { value: string; currency: string };
    metadata?: Record<string, unknown>;
    created_at?: string;
    captured_at?: string;
    confirmation?: { confirmation_url: string };
  };
}

export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const event = record.event;
  const object = record.object;

  if (typeof event !== 'string' || typeof object !== 'object' || object === null) {
    return null;
  }

  const raw = object as YooKassaWebhookBody['object'];
  if (!raw.id || !raw.status || !raw.amount) {
    return null;
  }

  if (event !== 'payment.succeeded' && event !== 'payment.canceled') {
    return null;
  }

  const kopecks = Math.round(parseFloat(raw.amount.value) * 100);
  if (!Number.isFinite(kopecks)) {
    return null;
  }

  const meta = raw.metadata;
  if (!meta?.project || !meta?.productType || !meta?.productId || !meta?.userId) {
    return null;
  }

  const payment: Payment = {
    id: raw.id,
    status: raw.status as Payment['status'],
    amount: { amount: kopecks, currency: 'RUB' },
    metadata: meta as Payment['metadata'],
    confirmationUrl: raw.confirmation?.confirmation_url,
    provider: 'yookassa',
    providerPaymentId: raw.id,
    createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
    paidAt: raw.captured_at ? new Date(raw.captured_at) : undefined,
  };

  return { type: event as WebhookEvent['type'], payment };
}
