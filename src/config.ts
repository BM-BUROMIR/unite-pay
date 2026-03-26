function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
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
