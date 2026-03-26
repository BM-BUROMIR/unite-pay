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

// Root — landing page stub + favicon
app.get('/', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>aipinion pay</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#111827;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:48px;max-width:420px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    .icon{width:48px;height:48px;margin:0 auto 20px;background:#dbeafe;border-radius:12px;display:flex;align-items:center;justify-content:center}
    .icon svg{width:24px;height:24px;color:#2563eb}
    h1{font-size:20px;font-weight:700;margin-bottom:8px}
    p{font-size:14px;color:#6b7280;line-height:1.6}
    .badge{display:inline-block;margin-top:16px;padding:4px 12px;background:#dcfce7;color:#16a34a;border-radius:9999px;font-size:12px;font-weight:500}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    </div>
    <h1>aipinion pay</h1>
    <p>Платёжный сервис для проектов aipinion.ru</p>
    <span class="badge">API</span>
  </div>
</body>
</html>`),
);

app.get('/favicon.svg', (c) => {
  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'public, max-age=31536000');
  return c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#2563eb"/>
  <text x="50" y="68" font-family="system-ui,sans-serif" font-size="50" font-weight="700" fill="white" text-anchor="middle">P</text>
</svg>`);
});

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
