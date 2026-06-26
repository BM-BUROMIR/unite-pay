---
project: aipinion-pay
load_strategy: alpha
tracker: 'github:BM-BUROMIR/unite-pay'
---

# AGENTS.md — pay

> Стандарты: [`../CLAUDE.md`](../CLAUDE.md)

## Обзор

Платёжный микросервис aipinion. ЮKassa, webhooks, fan-out уведомления клиентам.

## Tech Stack

Hono 4 + TypeScript + Supabase + YooKassa SDK

## Структура

```
src/
├── providers/    # Адаптеры (YooKassa)
├── routes/       # API endpoints
├── services/     # Бизнес-логика
├── middleware/    # Auth
├── config.ts / db.ts / index.ts
```

## Команды

```bash
npm run dev / build / lint / test
```

## Зависимости

- **auth/** — JWT через JWKS
- **fns/** и клиенты — создают платежи, получают fan-out webhooks

## Правила

1. **Суммы в копейках** (integer). Конвертация — на границе API провайдера
2. **Не доверять телу webhook** — перепроверять через API ЮKassa
3. **Per-project API keys** в `pay_projects`
4. **Fan-out webhooks** — уведомления зарегистрированным клиентам

## Docker / RU-зеркала

Базовые образы и пакетные менеджеры идут через RU-зеркала (Fastly edge `199.232.174.132` режется провайдером):

- `FROM mirror.gcr.io/library/node:22-alpine`
- `RUN sed -i 's|https\?://dl-cdn.alpinelinux.org|https://mirror.yandex.ru/mirrors|g' /etc/apk/repositories` перед `apk add`

Полный rule: `~/unite/rules/docker-mirrors.md`. Issue: [`BM-BUROMIR/YaD_Agent#10`](https://github.com/BM-BUROMIR/YaD_Agent/issues/10).
