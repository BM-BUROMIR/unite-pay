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
