import { supabase, Tables } from '../supabase';

export type PurchaseWithItems = Tables<'purchases'> & {
  purchase_items: Tables<'purchase_items'>[];
};

export interface PurchaseItemInput {
  name: string;
  quantity: number;
  unit_price?: number | null;
  total_price: number;
  owner_id: string | null; // null = shared
}

export interface PurchaseInput {
  household_id: string;
  shop_name: string;
  purchased_at: string;
  paid_by: string;
  total_amount: number;
  task_completion_id?: string | null;
}

export const formatCzk = (amount: number): string =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(amount);

export async function createPurchase(
  input: PurchaseInput,
  items: PurchaseItemInput[]
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: purchase, error } = await supabase
    .from('purchases')
    .insert({ ...input, created_by: user.id })
    .select('id')
    .single();

  if (error) throw error;

  const { error: itemsError } = await supabase
    .from('purchase_items')
    .insert(items.map(item => ({ ...item, purchase_id: purchase.id })));

  if (itemsError) {
    // best-effort cleanup so a failed insert doesn't leave an empty purchase
    await supabase.from('purchases').delete().eq('id', purchase.id);
    throw itemsError;
  }

  return purchase.id;
}

export async function updatePurchase(
  purchaseId: string,
  input: PurchaseInput,
  items: PurchaseItemInput[]
): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update(input)
    .eq('id', purchaseId);

  if (error) throw error;

  // ponytail: delete + reinsert items instead of diffing; item counts are tiny
  const { error: deleteError } = await supabase
    .from('purchase_items')
    .delete()
    .eq('purchase_id', purchaseId);

  if (deleteError) throw deleteError;

  const { error: itemsError } = await supabase
    .from('purchase_items')
    .insert(items.map(item => ({ ...item, purchase_id: purchaseId })));

  if (itemsError) throw itemsError;
}

export async function deletePurchase(purchase: Tables<'purchases'>): Promise<void> {
  if (purchase.receipt_url) {
    await supabase.storage.from('receipts').remove([purchase.receipt_url]);
  }

  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('id', purchase.id); // items cascade

  if (error) throw error;
}

export async function uploadReceipt(
  householdId: string,
  purchaseId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${householdId}/${purchaseId}.${ext}`;

  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { error: updateError } = await supabase
    .from('purchases')
    .update({ receipt_url: path })
    .eq('id', purchaseId);

  if (updateError) throw updateError;

  return path;
}

export async function getReceiptSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}

export async function settleUp(householdId: string): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update({ settled_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .is('settled_at', null);

  if (error) throw error;
}
