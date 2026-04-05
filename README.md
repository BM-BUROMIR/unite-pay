# unite-pay

Universal payment microservice for aipinion projects. Handles payments via YooKassa, manages subscriptions, and distributes fan-out webhooks to client services.

## Stack

- **Runtime:** Hono 4 on Node.js (>=22)
- **Database:** Supabase (PostgreSQL)
- **Language:** TypeScript
- **Payment provider:** YooKassa
- **Tests:** Vitest

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase and YooKassa credentials
npm run dev
```

## Commands

| Command                | Description                            |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Dev server with hot reload (tsx watch) |
| `npm run build`        | Compile TypeScript                     |
| `npm run start`        | Run compiled server                    |
| `npm run lint`         | ESLint                                 |
| `npm run lint:fix`     | ESLint with auto-fix                   |
| `npm run format`       | Prettier format                        |
| `npm run format:check` | Prettier check                         |
| `npm test`             | Run tests (Vitest)                     |
| `npm run test:watch`   | Tests in watch mode                    |
| `npm run push-test`    | Deploy via Coolify                     |

## Architecture

```
src/
  providers/   — payment provider adapters (YooKassa)
  routes/      — API endpoints
  services/    — business logic
  middleware/  — auth middleware (API key validation)
```

### Flow

1. Client service (e.g. FNS) creates a payment via API
2. `pay` forwards the request to YooKassa
3. YooKassa sends a webhook on status change
4. `pay` verifies the webhook by re-fetching payment status from YooKassa API
5. `pay` updates the database and sends fan-out webhooks to the client service

## Key rules

- **Amounts in kopecks** (integer). Convert to rubles only at the provider API boundary.
- **Never trust webhook body** — always re-verify via provider API.
- **Per-project API keys** — each client project has its own key in `pay_projects` table.
- **Fan-out webhooks** — notify client services after payment status changes.

## Deployment

```bash
npm run push-test        # deploy via scripts/coolify.sh
```

Deployed to `pay.aipinion.ru` via Coolify on VPS. Resource limits: 256MB RAM, 0.5 CPU.

Health check: `GET /health` returns `{"status":"ok","service":"pay"}`.
