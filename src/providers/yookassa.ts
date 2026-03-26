import type { CreatePaymentParams, Money, Payment, PaymentProvider } from './types.js';

const YOOKASSA_API = 'https://api.yookassa.ru/v3';

export interface YooKassaConfig {
  shopId: string;
  secretKey: string;
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url: string };
  metadata?: Record<string, unknown>;
  created_at?: string;
  captured_at?: string;
}

function kopecksToRubles(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}

function rublesToKopecks(rubles: string): number {
  return Math.round(parseFloat(rubles) * 100);
}

export class YooKassaProvider implements PaymentProvider {
  readonly name = 'yookassa';
  private readonly authHeader: string;

  constructor(private readonly config: YooKassaConfig) {
    this.authHeader = `Basic ${btoa(`${config.shopId}:${config.secretKey}`)}`;
  }

  async createPayment(params: CreatePaymentParams): Promise<Payment> {
    const body: Record<string, unknown> = {
      amount: { value: kopecksToRubles(params.amount.amount), currency: params.amount.currency },
      confirmation: { type: 'redirect', return_url: params.returnUrl },
      capture: params.capture ?? true,
      description: params.description,
      metadata: params.metadata,
    };

    if (params.receipt) {
      body.receipt = params.receipt;
    }

    const res = await this.request<YooKassaPaymentResponse>('POST', '/payments', body, {
      'Idempotence-Key': crypto.randomUUID(),
    });

    return this.mapPayment(res);
  }

  async getPayment(providerPaymentId: string): Promise<Payment> {
    const res = await this.request<YooKassaPaymentResponse>('GET', `/payments/${providerPaymentId}`);
    return this.mapPayment(res);
  }

  async capturePayment(providerPaymentId: string, amount: Money): Promise<Payment> {
    const body = { amount: { value: kopecksToRubles(amount.amount), currency: amount.currency } };
    const res = await this.request<YooKassaPaymentResponse>(
      'POST',
      `/payments/${providerPaymentId}/capture`,
      body,
      { 'Idempotence-Key': `capture-${providerPaymentId}` },
    );
    return this.mapPayment(res);
  }

  private mapPayment(raw: YooKassaPaymentResponse): Payment {
    return {
      id: raw.id,
      status: raw.status as Payment['status'],
      amount: { amount: rublesToKopecks(raw.amount.value), currency: 'RUB' },
      metadata: (raw.metadata ?? {}) as Payment['metadata'],
      confirmationUrl: raw.confirmation?.confirmation_url,
      provider: 'yookassa',
      providerPaymentId: raw.id,
      createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
      paidAt: raw.captured_at ? new Date(raw.captured_at) : undefined,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const res = await fetch(`${YOOKASSA_API}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`YooKassa API error: ${res.status} ${res.statusText} — ${text}`);
    }

    return (await res.json()) as T;
  }
}
