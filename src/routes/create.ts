import { Hono } from 'hono';
import { config } from '../config.js';
import { YooKassaProvider } from '../providers/yookassa.js';
import { createPurchaseRecord, getActivePurchase } from '../services/purchase-service.js';

const create = new Hono();

create.post('/', async (c) => {
  let providerPaymentId: string | undefined;

  try {
    const body = await c.req.json();
    const {
      userId,
      project,
      productId,
      productType,
      amountKop,
      durationDays,
      description,
      returnUrl,
      metadata,
    } = body;

    if (!userId || !project || !productId || !productType || !description || !returnUrl) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (typeof amountKop !== 'number' || amountKop <= 0) {
      return c.json({ error: 'amountKop must be a positive number' }, 400);
    }

    if (!metadata?.addSlots) {
      const existing = await getActivePurchase(userId, project);
      if (existing) {
        return c.json({ error: 'Already subscribed' }, 409);
      }
    }

    const provider = new YooKassaProvider({
      shopId: config.yookassaShopId,
      secretKey: config.yookassaSecretKey,
    });

    const rubles = (amountKop / 100).toFixed(2);
    const customerEmail = body.email || config.receiptEmail;

    const payment = await provider.createPayment({
      amount: { amount: amountKop, currency: 'RUB' },
      description,
      returnUrl,
      metadata: { project, productType, productId, userId, ...metadata },
      receipt: {
        customer: { email: customerEmail },
        items: [
          {
            description,
            amount: { value: rubles, currency: 'RUB' },
            quantity: 1,
            vat_code: 1,
            payment_subject: 'service',
            payment_mode: 'full_payment',
          },
        ],
      },
    });

    providerPaymentId = payment.providerPaymentId;

    await createPurchaseRecord({
      userId,
      project,
      productId,
      productType,
      amountKop,
      durationDays: durationDays || 0,
      provider: 'yookassa',
      providerPaymentId: payment.providerPaymentId,
      metadata: metadata || {},
    });

    return c.json({ confirmationUrl: payment.confirmationUrl });
  } catch (error) {
    console.error(
      `Payment create error${providerPaymentId ? ` (orphaned: ${providerPaymentId})` : ''}:`,
      error,
    );
    return c.json({ error: 'Payment creation failed' }, 500);
  }
});

export default create;
