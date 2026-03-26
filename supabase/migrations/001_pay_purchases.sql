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
