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
