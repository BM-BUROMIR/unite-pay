/** Money amount — always in kopecks (integer). 29900 = 299₽ */
export interface Money {
  amount: number;
  currency: 'RUB';
}

export type PaymentStatus = 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';

export interface PaymentMetadata {
  project: string;
  productType: string;
  productId: string;
  userId: string;
  [key: string]: unknown;
}

export interface Payment {
  id: string;
  status: PaymentStatus;
  amount: Money;
  metadata: PaymentMetadata;
  confirmationUrl?: string;
  provider: string;
  providerPaymentId: string;
  createdAt: Date;
  paidAt?: Date;
}

export interface CreatePaymentParams {
  amount: Money;
  description: string;
  returnUrl: string;
  metadata: PaymentMetadata;
  capture?: boolean;
  receipt?: {
    customer: { email?: string; phone?: string };
    items: Array<{
      description: string;
      amount: { value: string; currency: string };
      quantity: number;
      vat_code: number;
      payment_subject?: string;
      payment_mode?: string;
    }>;
  };
}

export interface WebhookEvent {
  type: 'payment.succeeded' | 'payment.canceled';
  payment: Payment;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<Payment>;
  getPayment(providerPaymentId: string): Promise<Payment>;
  capturePayment(providerPaymentId: string, amount: Money): Promise<Payment>;
}
