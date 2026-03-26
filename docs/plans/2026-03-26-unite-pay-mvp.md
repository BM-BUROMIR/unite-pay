# unite-pay MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a universal payment microservice based on gims-pay, with project-based auth, fan-out webhooks, and subscription expiry monitoring.

**Architecture:** Fork gims-pay into standalone service. Replace single API key with project-based auth (`pay_projects` table). Add fan-out webhook delivery after payment processing. Add cron endpoint for subscription expiry monitoring. Inline the `@gims/payments` package as `src/providers/`.

**Tech Stack:** Hono 4, Supabase (PostgreSQL), TypeScript 5.7, Node.js 22, YooKassa API, Docker (multi-stage alpine build).

**Source reference:** `/Users/oxi/cc/oxi/gims/gims-pay` — original codebase to adapt from.

**Spec:** `/Users/oxi/unite/aipinion/fns/docs/superpowers/specs/2026-03-26-unite-pay-design.md`

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `src/index.ts` | Hono app, route registration, middleware |
| `src/config.ts` | Env config loader |
| `src/db.ts` | Supabase client singleton |
| `src/providers/yookassa.ts` | YooKassa API client (from shared/packages/payments) |
| `src/providers/webhook-parser.ts` | Parse YooKassa webhook body |
| `src/providers/types.ts` | Payment interfaces |
| `src/routes/create.ts` | POST /create — create payment |
| `src/routes/webhook.ts` | POST /webhook/yookassa — handle + fan-out |
| `src/routes/status.ts` | GET /status — check subscription |
| `src/routes/health.ts` | GET /health |
| `src/routes/cron.ts` | GET /cron/check-expiring |
| `src/services/purchase-service.ts` | pay_purchases CRUD |
| `src/services/project-service.ts` | pay_projects CRUD |
| `src/services/webhook-fanout.ts` | Fan-out delivery + retry + logging |
| `src/middleware/api-key.ts` | Project-based API key auth |
| `src/middleware/cron-auth.ts` | CRON_SECRET auth |
| `supabase/migrations/001_pay_purchases.sql` | Purchases table |
| `supabase/migrations/002_pay_projects.sql` | Projects table |
| `supabase/migrations/003_pay_webhook_log.sql` | Webhook log table |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `Dockerfile` | Multi-stage Docker build |
| `.env.example` | Environment template |
| `CLAUDE.md` | Project instructions |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `.env.example`, `CLAUDE.md`, `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "unite-pay",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22",
    "npm": ">=10"
  },
  "scripts": {
    "dev": "tsx watch --env-file=.env src/index.ts",
    "lint": "eslint src/",
    "lint:fix": "eslint --fix src/",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "build": "tsc",
    "start": "node --env-file=.env dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "@supabase/supabase-js": "^2.49.1",
    "hono": "^4.6.14"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "eslint": "^10.0.2",
    "prettier": "^3.5.3",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.56.1",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .env.example**

```bash
PORT=3003
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=test_xxx
RECEIPT_FALLBACK_EMAIL=support@aipinion.ru
CRON_SECRET=random-secret-for-cron
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.task-runner/
```

- [ ] **Step 5: Create CLAUDE.md**

```markdown
# unite-pay

Universal payment microservice for aipinion projects.

## Stack
Hono 4 + Supabase + TypeScript + YooKassa

## Commands
- `npm run dev` — dev server with hot reload
- `npm run build` — compile TypeScript
- `npm run lint` — ESLint
- `npm test` — Vitest

## Architecture
- `src/providers/` — payment provider adapters (YooKassa)
- `src/routes/` — API endpoints
- `src/services/` — business logic
- `src/middleware/` — auth middleware

## Key rules
- Amounts always in kopecks (integer). Convert to rubles only at provider API boundary.
- Never trust webhook body — always re-verify via provider API.
- Each project (FNS, trainer, etc.) has its own API key in `pay_projects` table.
- Fan-out webhooks to clients after payment processing.
```

- [ ] **Step 6: Install dependencies and commit**

```bash
cd /Users/oxi/unite/pay && npm install
git add -A && git commit -m "feat: project scaffolding"
```

---

## Task 2: Database Migrations

**Files:**
- Create: `supabase/migrations/001_pay_purchases.sql`
- Create: `supabase/migrations/002_pay_projects.sql`
- Create: `supabase/migrations/003_pay_webhook_log.sql`

- [ ] **Step 1: Create pay_purchases migration**

```sql
-- 001_pay_purchases.sql
CREATE TABLE pay_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project text NOT NULL,
  product_type text NOT NULL,
  product_id text NOT NULL,
  amount_kop integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL,
  provider_payment_id text,
  paid_at timestamptz,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_pay_purchases_provider_id
  ON pay_purchases(provider, provider_payment_id);
CREATE INDEX idx_pay_purchases_user_project
  ON pay_purchases(user_id, project, status);
CREATE UNIQUE INDEX idx_pay_purchases_active_product
  ON pay_purchases(user_id, project, product_id) WHERE status = 'paid';

ALTER TABLE pay_purchases ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Create pay_projects migration**

```sql
-- 002_pay_projects.sql
CREATE TABLE pay_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  webhook_url text NOT NULL,
  webhook_secret text NOT NULL,
  api_key text NOT NULL UNIQUE,
  notify_before_days integer DEFAULT 7,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pay_projects_api_key ON pay_projects(api_key);
```

- [ ] **Step 3: Create pay_webhook_log migration**

```sql
-- 003_pay_webhook_log.sql
CREATE TABLE pay_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status_code integer,
  response_body text,
  attempts integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pay_webhook_log_project
  ON pay_webhook_log(project_slug, created_at);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/ && git commit -m "feat: database migrations for purchases, projects, webhook log"
```

---

## Task 3: Provider Layer (from gims-pay shared/packages/payments)

**Files:**
- Create: `src/providers/types.ts`
- Create: `src/providers/yookassa.ts`
- Create: `src/providers/webhook-parser.ts`

- [ ] **Step 1: Create types.ts**

Adapted from gims-pay `shared/packages/payments/src/types.ts`. Key change: `project` type is `string` (not union).

```typescript
// src/providers/types.ts

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
```

- [ ] **Step 2: Create yookassa.ts**

Copy from gims-pay `shared/packages/payments/src/providers/yookassa.ts`, update imports:

```typescript
// src/providers/yookassa.ts
import type { PaymentProvider, Payment, CreatePaymentParams, Money } from './types.js';

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
      'POST', `/payments/${providerPaymentId}/capture`, body,
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
    method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const res = await fetch(`${YOOKASSA_API}${path}`, {
      method,
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json', ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`YooKassa API error: ${res.status} ${res.statusText} — ${text}`);
    }
    return (await res.json()) as T;
  }
}
```

- [ ] **Step 3: Create webhook-parser.ts**

Copy from gims-pay `shared/packages/payments/src/webhook.ts`, update imports:

```typescript
// src/providers/webhook-parser.ts
import type { WebhookEvent, Payment } from './types.js';

interface YooKassaWebhookBody {
  object: {
    id: string;
    status: string;
    amount: { value: string; currency: string };
    metadata?: Record<string, unknown>;
    created_at?: string;
    captured_at?: string;
    confirmation?: { confirmation_url: string };
  };
}

export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  if (typeof body !== 'object' || body === null) return null;

  const record = body as Record<string, unknown>;
  const event = record.event;
  const object = record.object;

  if (typeof event !== 'string' || typeof object !== 'object' || object === null) return null;

  const raw = object as YooKassaWebhookBody['object'];
  if (!raw.id || !raw.status || !raw.amount) return null;
  if (event !== 'payment.succeeded' && event !== 'payment.canceled') return null;

  const kopecks = Math.round(parseFloat(raw.amount.value) * 100);
  if (!Number.isFinite(kopecks)) return null;

  const meta = raw.metadata;
  if (!meta?.project || !meta?.productType || !meta?.productId || !meta?.userId) return null;

  const payment: Payment = {
    id: raw.id,
    status: raw.status as Payment['status'],
    amount: { amount: kopecks, currency: 'RUB' },
    metadata: meta as Payment['metadata'],
    confirmationUrl: raw.confirmation?.confirmation_url,
    provider: 'yookassa',
    providerPaymentId: raw.id,
    createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
    paidAt: raw.captured_at ? new Date(raw.captured_at) : undefined,
  };

  return { type: event as WebhookEvent['type'], payment };
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/providers/ && git commit -m "feat: payment provider layer (YooKassa + webhook parser)"
```

---

## Task 4: Core Infrastructure (config, db, middleware)

**Files:**
- Create: `src/config.ts`, `src/db.ts`, `src/middleware/api-key.ts`, `src/middleware/cron-auth.ts`

- [ ] **Step 1: Create config.ts**

```typescript
// src/config.ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  port: Number(optional('PORT', '3003')),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),
  yookassaShopId: required('YOOKASSA_SHOP_ID'),
  yookassaSecretKey: required('YOOKASSA_SECRET_KEY'),
  receiptEmail: required('RECEIPT_FALLBACK_EMAIL'),
  cronSecret: required('CRON_SECRET'),
} as const;
```

- [ ] **Step 2: Create db.ts**

```typescript
// src/db.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey);
  }
  return client;
}
```

- [ ] **Step 3: Create api-key.ts (project-based)**

```typescript
// src/middleware/api-key.ts
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

  // Store project info in context for downstream use
  c.set('project', project);
  await next();
};
```

- [ ] **Step 4: Create cron-auth.ts**

```typescript
// src/middleware/cron-auth.ts
import type { MiddlewareHandler } from 'hono';
import { config } from '../config.js';

export const cronAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const secret = c.req.header('X-Cron-Secret') || c.req.query('secret');
  if (!secret || secret !== config.cronSecret) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
};
```

- [ ] **Step 5: Verify build and commit**

```bash
npx tsc --noEmit
git add src/config.ts src/db.ts src/middleware/ && git commit -m "feat: config, db, middleware (project-based API key + cron auth)"
```

---

## Task 5: Services (purchase, project, webhook-fanout)

**Files:**
- Create: `src/services/purchase-service.ts`, `src/services/project-service.ts`, `src/services/webhook-fanout.ts`

- [ ] **Step 1: Create purchase-service.ts**

Adapted from gims-pay — identical logic, no `@gims/payments` import:

```typescript
// src/services/purchase-service.ts
import { getSupabase } from '../db.js';

export interface Purchase {
  id: string;
  user_id: string;
  project: string;
  product_type: string;
  product_id: string;
  amount_kop: number;
  status: string;
  provider: string;
  provider_payment_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getActivePurchase(userId: string, project: string): Promise<Purchase | null> {
  const { data, error } = await getSupabase()
    .from('pay_purchases')
    .select('*')
    .eq('user_id', userId)
    .eq('project', project)
    .eq('status', 'paid')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('expires_at', { ascending: false, nullsFirst: true })
    .limit(1);
  if (error) throw new Error(`getActivePurchase failed: ${error.message}`);
  return (data?.[0] as Purchase) ?? null;
}

export async function createPurchaseRecord(params: {
  userId: string;
  project: string;
  productId: string;
  productType: string;
  amountKop: number;
  durationDays: number;
  provider: string;
  providerPaymentId: string;
  metadata?: Record<string, unknown>;
}): Promise<Purchase> {
  const { data, error } = await getSupabase()
    .from('pay_purchases')
    .insert({
      user_id: params.userId,
      project: params.project,
      product_type: params.productType,
      product_id: params.productId,
      amount_kop: params.amountKop,
      status: 'pending',
      provider: params.provider,
      provider_payment_id: params.providerPaymentId,
      metadata: { durationDays: params.durationDays, ...params.metadata },
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create purchase: ${error.message}`);
  return data as Purchase;
}

export async function markPurchasePaid(providerPaymentId: string): Promise<Purchase | null> {
  const { data: updated, error } = await getSupabase()
    .from('pay_purchases')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('provider_payment_id', providerPaymentId)
    .eq('status', 'pending')
    .select('*');

  if (error) throw new Error(`Failed to mark paid: ${error.message}`);
  if (!updated || updated.length === 0) {
    console.warn(`markPurchasePaid: no pending row for ${providerPaymentId}`);
    return null;
  }

  const purchase = updated[0] as Purchase;
  const durationDays = purchase.metadata?.durationDays as number | undefined;
  const expiresAt = durationDays
    ? new Date(Date.now() + durationDays * 86400_000).toISOString()
    : null;

  await getSupabase()
    .from('pay_purchases')
    .update({ expires_at: expiresAt })
    .eq('provider_payment_id', providerPaymentId);

  // Expire previous paid purchases for same user/project/product
  await getSupabase()
    .from('pay_purchases')
    .update({ status: 'expired' })
    .eq('user_id', purchase.user_id)
    .eq('project', purchase.project)
    .eq('product_id', purchase.product_id)
    .eq('status', 'paid')
    .neq('provider_payment_id', providerPaymentId);

  return { ...purchase, expires_at: expiresAt };
}

export async function markPurchaseCanceled(providerPaymentId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('pay_purchases')
    .update({ status: 'canceled' })
    .eq('provider_payment_id', providerPaymentId)
    .eq('status', 'pending');
  if (error) throw new Error(`Failed to mark canceled: ${error.message}`);
}

export async function getExpiringPurchases(withinDays: number): Promise<Purchase[]> {
  const now = new Date();
  const future = new Date(Date.now() + withinDays * 86400_000);

  const { data, error } = await getSupabase()
    .from('pay_purchases')
    .select('*')
    .eq('status', 'paid')
    .not('expires_at', 'is', null)
    .gte('expires_at', now.toISOString())
    .lte('expires_at', future.toISOString());

  if (error) throw new Error(`getExpiringPurchases failed: ${error.message}`);
  return (data || []) as Purchase[];
}

export async function getExpiredPurchases(): Promise<Purchase[]> {
  const { data, error } = await getSupabase()
    .from('pay_purchases')
    .select('*')
    .eq('status', 'paid')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString());

  if (error) throw new Error(`getExpiredPurchases failed: ${error.message}`);
  return (data || []) as Purchase[];
}

export async function markPurchaseExpired(id: string): Promise<void> {
  await getSupabase()
    .from('pay_purchases')
    .update({ status: 'expired' })
    .eq('id', id);
}
```

- [ ] **Step 2: Create project-service.ts**

```typescript
// src/services/project-service.ts
import { getSupabase } from '../db.js';

export interface Project {
  id: string;
  slug: string;
  name: string;
  webhook_url: string;
  webhook_secret: string;
  api_key: string;
  notify_before_days: number;
  active: boolean;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const { data } = await getSupabase()
    .from('pay_projects')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();
  return data as Project | null;
}

export async function getAllActiveProjects(): Promise<Project[]> {
  const { data } = await getSupabase()
    .from('pay_projects')
    .select('*')
    .eq('active', true);
  return (data || []) as Project[];
}
```

- [ ] **Step 3: Create webhook-fanout.ts**

```typescript
// src/services/webhook-fanout.ts
import { getSupabase } from '../db.js';
import { getProjectBySlug } from './project-service.js';

export interface FanOutEvent {
  event: string;
  userId: string;
  project: string;
  productId: string;
  productType: string;
  durationDays?: number;
  expiresAt?: string;
  daysLeft?: number;
  metadata: Record<string, unknown>;
}

export async function fanOutWebhook(projectSlug: string, event: FanOutEvent): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  if (!project) {
    console.warn(`fanOutWebhook: project ${projectSlug} not found or inactive`);
    return;
  }

  const payload = JSON.stringify(event);
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    attempts = attempt;
    try {
      const res = await fetch(project.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': project.webhook_secret,
        },
        body: payload,
      });
      statusCode = res.status;
      responseBody = await res.text();

      if (res.ok) break;
    } catch (err) {
      responseBody = String(err);
    }

    // Exponential backoff: 1s, 5s, 25s
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, Math.pow(5, attempt) * 1000));
    }
  }

  // Log webhook delivery
  await getSupabase()
    .from('pay_webhook_log')
    .insert({
      project_slug: projectSlug,
      event_type: event.event,
      payload: event,
      status_code: statusCode,
      response_body: responseBody?.slice(0, 1000),
      attempts,
    });

  if (!statusCode || statusCode >= 400) {
    console.error(`fanOutWebhook failed: ${projectSlug} ${event.event} status=${statusCode}`);
  }
}
```

- [ ] **Step 4: Verify build and commit**

```bash
npx tsc --noEmit
git add src/services/ && git commit -m "feat: services (purchase, project, webhook fan-out)"
```

---

## Task 6: Routes (create, webhook, status, health, cron)

**Files:**
- Create: `src/routes/create.ts`, `src/routes/webhook.ts`, `src/routes/status.ts`, `src/routes/health.ts`, `src/routes/cron.ts`

- [ ] **Step 1: Create health.ts**

```typescript
// src/routes/health.ts
import { Hono } from 'hono';

const health = new Hono();
health.get('/', (c) => c.json({ status: 'ok', service: 'pay' }));
export default health;
```

- [ ] **Step 2: Create create.ts**

```typescript
// src/routes/create.ts
import { Hono } from 'hono';
import { YooKassaProvider } from '../providers/yookassa.js';
import { config } from '../config.js';
import { createPurchaseRecord, getActivePurchase } from '../services/purchase-service.js';

const create = new Hono();

create.post('/', async (c) => {
  let providerPaymentId: string | undefined;

  try {
    const body = await c.req.json();
    const { userId, project, productId, productType, amountKop, durationDays, description, returnUrl, metadata } = body;

    if (!userId || !project || !productId || !productType || !description || !returnUrl) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    if (typeof amountKop !== 'number' || amountKop <= 0) {
      return c.json({ error: 'amountKop must be a positive number' }, 400);
    }

    // Check for existing active purchase (skip for addons)
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
        items: [{
          description,
          amount: { value: rubles, currency: 'RUB' },
          quantity: 1,
          vat_code: 1,
          payment_subject: 'service',
          payment_mode: 'full_payment',
        }],
      },
    });

    providerPaymentId = payment.providerPaymentId;

    await createPurchaseRecord({
      userId, project, productId, productType, amountKop,
      durationDays: durationDays || 0,
      provider: 'yookassa',
      providerPaymentId: payment.providerPaymentId,
      metadata: metadata || {},
    });

    return c.json({ confirmationUrl: payment.confirmationUrl });
  } catch (error) {
    console.error(`Payment create error${providerPaymentId ? ` (orphaned: ${providerPaymentId})` : ''}:`, error);
    return c.json({ error: 'Payment creation failed' }, 500);
  }
});

export default create;
```

- [ ] **Step 3: Create webhook.ts (with fan-out)**

```typescript
// src/routes/webhook.ts
import { Hono } from 'hono';
import { parseWebhookEvent } from '../providers/webhook-parser.js';
import { YooKassaProvider } from '../providers/yookassa.js';
import { config } from '../config.js';
import { markPurchasePaid, markPurchaseCanceled } from '../services/purchase-service.js';
import { fanOutWebhook } from '../services/webhook-fanout.js';

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
        console.warn(`Webhook: payment ${event.payment.providerPaymentId} status=${verified.status}`);
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
```

- [ ] **Step 4: Create status.ts (with metadata)**

```typescript
// src/routes/status.ts
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
```

- [ ] **Step 5: Create cron.ts**

```typescript
// src/routes/cron.ts
import { Hono } from 'hono';
import {
  getExpiringPurchases,
  getExpiredPurchases,
  markPurchaseExpired,
} from '../services/purchase-service.js';
import { getProjectBySlug } from '../services/project-service.js';
import { fanOutWebhook } from '../services/webhook-fanout.js';

const cron = new Hono();

cron.get('/check-expiring', async (c) => {
  try {
    let notified = 0;
    let expired = 0;

    // 1. Find purchases expiring within notify_before_days
    // We check for max 30 days — each project has its own notify_before_days
    const expiring = await getExpiringPurchases(30);
    for (const purchase of expiring) {
      const project = await getProjectBySlug(purchase.project);
      if (!project) continue;

      const daysLeft = Math.ceil(
        (new Date(purchase.expires_at!).getTime() - Date.now()) / 86400_000,
      );

      if (daysLeft > project.notify_before_days) continue;

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

    // 2. Expire overdue purchases
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
```

- [ ] **Step 6: Verify build and commit**

```bash
npx tsc --noEmit
git add src/routes/ && git commit -m "feat: all routes (create, webhook+fanout, status, health, cron)"
```

---

## Task 7: App Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { config } from './config.js';
import { apiKeyMiddleware } from './middleware/api-key.js';
import { cronAuthMiddleware } from './middleware/cron-auth.js';
import healthRoute from './routes/health.js';
import createRoute from './routes/create.js';
import statusRoute from './routes/status.js';
import webhookRoute from './routes/webhook.js';
import cronRoute from './routes/cron.js';

const app = new Hono();

// Global middleware
app.use('*', logger());

// Public routes
app.route('/health', healthRoute);
app.route('/webhook', webhookRoute);

// Protected routes (project API key)
app.use('/create', apiKeyMiddleware);
app.use('/status', apiKeyMiddleware);
app.route('/create', createRoute);
app.route('/status', statusRoute);

// Cron routes (CRON_SECRET)
app.use('/cron/*', cronAuthMiddleware);
app.route('/cron', cronRoute);

// Error handling
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
console.log(`unite-pay starting on port ${config.port}...`);
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`unite-pay running at http://localhost:${info.port}`);
});
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/index.ts && git commit -m "feat: app entry point with all routes and middleware"
```

---

## Task 8: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile && git commit -m "feat: multi-stage Dockerfile"
```

---

## Task 9: Full Build + Push

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Push to remote**

```bash
git push origin main
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Project scaffolding (package.json, tsconfig, etc.) | None |
| 2 | Database migrations | None |
| 3 | Provider layer (YooKassa + webhook parser) | 1 |
| 4 | Core infrastructure (config, db, middleware) | 1 |
| 5 | Services (purchase, project, webhook-fanout) | 4 |
| 6 | Routes (create, webhook, status, health, cron) | 3, 4, 5 |
| 7 | App entry point | 6 |
| 8 | Dockerfile | 7 |
| 9 | Full build + push | All |

**Parallelizable:** Tasks 1+2, Tasks 3+4 (after 1).
