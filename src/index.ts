import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { config } from './config.js';
import { apiKeyMiddleware } from './middleware/api-key.js';
import { cronAuthMiddleware } from './middleware/cron-auth.js';
import createRoute from './routes/create.js';
import cronRoute from './routes/cron.js';
import healthRoute from './routes/health.js';
import statusRoute from './routes/status.js';
import webhookRoute from './routes/webhook.js';

const app = new Hono();

app.use('*', logger());

app.route('/health', healthRoute);
app.route('/webhook', webhookRoute);

app.use('/create', apiKeyMiddleware);
app.use('/status', apiKeyMiddleware);
app.route('/create', createRoute);
app.route('/status', statusRoute);

app.use('/cron/*', cronAuthMiddleware);
app.route('/cron', cronRoute);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

console.log(`unite-pay starting on port ${config.port}...`);
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`unite-pay running at http://localhost:${info.port}`);
});
