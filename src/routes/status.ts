import { Hono } from 'hono';
import { getActivePurchase } from '../services/purchase-service.js';

const status = new Hono();

status.get('/', async (c) => {
  const userId = c.req.query('userId');
  const project = c.req.query('project');

  if (!userId || !project) {
    return c.json({ error: 'Missing userId or project' }, 400);
  }

  try {
    const purchase = await getActivePurchase(userId, project);
    return c.json({
      isPremium: !!purchase,
      productId: purchase?.product_id ?? null,
      expiresAt: purchase?.expires_at ?? null,
      metadata: purchase?.metadata ?? null,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return c.json({ error: 'Status check failed' }, 500);
  }
});

export default status;
