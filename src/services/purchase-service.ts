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

  if (error) {
    throw new Error(`getActivePurchase failed: ${error.message}`);
  }

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

  if (error) {
    throw new Error(`Failed to create purchase: ${error.message}`);
  }

  return data as Purchase;
}

export async function markPurchasePaid(providerPaymentId: string): Promise<Purchase | null> {
  const { data: updated, error } = await getSupabase()
    .from('pay_purchases')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('provider_payment_id', providerPaymentId)
    .eq('status', 'pending')
    .select('*');

  if (error) {
    throw new Error(`Failed to mark paid: ${error.message}`);
  }

  if (!updated || updated.length === 0) {
    console.warn(`markPurchasePaid: no pending row for ${providerPaymentId}`);
    return null;
  }

  const purchase = updated[0] as Purchase;
  const durationDays = purchase.metadata?.durationDays as number | undefined;
  const expiresAt = durationDays
    ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
    : null;

  await getSupabase()
    .from('pay_purchases')
    .update({ expires_at: expiresAt })
    .eq('provider_payment_id', providerPaymentId);

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

  if (error) {
    throw new Error(`Failed to mark canceled: ${error.message}`);
  }
}

export async function getExpiringPurchases(withinDays: number): Promise<Purchase[]> {
  const now = new Date();
  const future = new Date(Date.now() + withinDays * 86_400_000);

  const { data, error } = await getSupabase()
    .from('pay_purchases')
    .select('*')
    .eq('status', 'paid')
    .not('expires_at', 'is', null)
    .gte('expires_at', now.toISOString())
    .lte('expires_at', future.toISOString());

  if (error) {
    throw new Error(`getExpiringPurchases failed: ${error.message}`);
  }

  return (data || []) as Purchase[];
}

export async function getExpiredPurchases(): Promise<Purchase[]> {
  const { data, error } = await getSupabase()
    .from('pay_purchases')
    .select('*')
    .eq('status', 'paid')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString());

  if (error) {
    throw new Error(`getExpiredPurchases failed: ${error.message}`);
  }

  return (data || []) as Purchase[];
}

export async function markPurchaseExpired(id: string): Promise<void> {
  await getSupabase()
    .from('pay_purchases')
    .update({ status: 'expired' })
    .eq('id', id);
}
