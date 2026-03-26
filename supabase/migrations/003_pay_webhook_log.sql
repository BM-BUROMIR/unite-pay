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
