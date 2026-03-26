import { Hono } from 'hono';
import { config } from '../config.js';
import { parseWebhookEvent } from '../providers/webhook-parser.js';
import { YooKassaProvider } from '../providers/yookassa.js';
import { fanOutWebhook } from '../services/webhook-fanout.js';
import { markPurchaseCanceled, markPurchasePaid } from '../services/purchase-service.js';

const webhook = new Hono();

webhook.post('/yookassa', async (c) => {
  try {
    const body = await c.req.json();
    const event = parseWebhookEvent(body);

    if (!event) {
      return c.json({ error: 'Unknown event' }, 400);
    }

    if (event.type === 'payment.succeeded') {
      const provider = new YooKassaProvider({
        shopId: config.yookassaShopId,
        secretKey: config.yookassaSecretKey,
      });
      const verified = await provider.getPayment(event.payment.providerPaymentId);
      if (verified.status !== 'succeeded') {
        console.warn(
          `Webhook: payment ${event.payment.providerPaymentId} status=${verified.status}`,
        );
        return c.json({ ok: true });
      }

      const purchase = await markPurchasePaid(event.payment.providerPaymentId);

      if (purchase) {
        await fanOutWebhook(event.payment.metadata.project, {
          event: 'payment.succeeded',
          userId: event.payment.metadata.userId,
          project: event.payment.metadata.project,
          productId: event.payment.metadata.productId,
          productType: event.payment.metadata.productType,
          durationDays: purchase.metadata?.durationDays as number | undefined,
          metadata: purchase.metadata,
        });
      }

      console.log(`Payment verified+activated: ${event.payment.providerPaymentId}`);
    }

    if (event.type === 'payment.canceled') {
      await markPurchaseCanceled(event.payment.providerPaymentId);

      await fanOutWebhook(event.payment.metadata.project, {
        event: 'payment.canceled',
        userId: event.payment.metadata.userId,
        project: event.payment.metadata.project,
        productId: event.payment.metadata.productId,
        productType: event.payment.metadata.productType,
        metadata: event.payment.metadata,
      });

      console.log(`Payment canceled: ${event.payment.providerPaymentId}`);
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default webhook;
