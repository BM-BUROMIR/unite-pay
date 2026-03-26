import { Hono } from 'hono';
import {
  getExpiredPurchases,
  getExpiringPurchases,
  markPurchaseExpired,
} from '../services/purchase-service.js';
import { getProjectBySlug } from '../services/project-service.js';
import { fanOutWebhook } from '../services/webhook-fanout.js';

const cron = new Hono();

cron.get('/check-expiring', async (c) => {
  try {
    let notified = 0;
    let expired = 0;

    const expiring = await getExpiringPurchases(30);
    for (const purchase of expiring) {
      const project = await getProjectBySlug(purchase.project);
      if (!project) {
        continue;
      }

      const daysLeft = Math.ceil(
        (new Date(purchase.expires_at!).getTime() - Date.now()) / 86_400_000,
      );

      if (daysLeft > project.notify_before_days) {
        continue;
      }

      await fanOutWebhook(purchase.project, {
        event: 'subscription.expiring',
        userId: purchase.user_id,
        project: purchase.project,
        productId: purchase.product_id,
        productType: purchase.product_type,
        expiresAt: purchase.expires_at!,
        daysLeft,
        metadata: purchase.metadata,
      });
      notified++;
    }

    const overdue = await getExpiredPurchases();
    for (const purchase of overdue) {
      await markPurchaseExpired(purchase.id);

      await fanOutWebhook(purchase.project, {
        event: 'subscription.expired',
        userId: purchase.user_id,
        project: purchase.project,
        productId: purchase.product_id,
        productType: purchase.product_type,
        expiresAt: purchase.expires_at!,
        metadata: purchase.metadata,
      });
      expired++;
    }

    return c.json({ ok: true, notified, expired });
  } catch (error) {
    console.error('Cron check-expiring error:', error);
    return c.json({ error: 'Cron failed' }, 500);
  }
});

export default cron;
