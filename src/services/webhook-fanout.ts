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

      if (res.ok) {
        break;
      }
    } catch (err) {
      responseBody = String(err);
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(5, attempt) * 1000));
    }
  }

  await getSupabase().from('pay_webhook_log').insert({
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
