import type { MiddlewareHandler } from 'hono';
import { getSupabase } from '../db.js';

export const apiKeyMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKey = c.req.header('X-API-Key');
  if (!apiKey) {
    return c.json({ error: 'Missing API key' }, 401);
  }

  const { data: project } = await getSupabase()
    .from('pay_projects')
    .select('slug, name, active')
    .eq('api_key', apiKey)
    .single();

  if (!project || !project.active) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  c.set('project', project);
  await next();
};
