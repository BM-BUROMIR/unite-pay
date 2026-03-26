import type { MiddlewareHandler } from 'hono';
import { config } from '../config.js';

export const cronAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const secret = c.req.header('X-Cron-Secret');
  if (!secret || secret !== config.cronSecret) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await next();
};
