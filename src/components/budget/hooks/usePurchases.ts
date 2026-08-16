import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useHousehold } from '../../../hooks/useHousehold';
import { PurchaseWithItems } from '../../../lib/api/purchases';

// ponytail: fetch + refetch on mutation, no realtime; add if simultaneous editing ever hurts
export function usePurchases() {
  const { currentHousehold } = useHousehold();
  const [purchases, setPurchases] = useState<PurchaseWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async (): Promise<PurchaseWithItems[]> => {
    if (!currentHousehold) return [];

    const { data, error } = await supabase
      .from('purchases')
      .select('*, purchase_items(*)')
      .eq('household_id', currentHousehold.id)
      .order('purchased_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PurchaseWithItems[];
  }, [currentHousehold]);

  useEffect(() => {
    let ignore = false; // guard against a stale response after household switch
    setLoading(true);
    fetchPurchases()
      .then(data => {
        if (!ignore) setPurchases(data);
      })
      .catch(error => console.error('Error fetching purchases:', error))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchPurchases]);

  // silent refetch after mutations (no loading flicker)
  const refetch = useCallback(() => {
    fetchPurchases()
      .then(setPurchases)
      .catch(error => console.error('Error fetching purchases:', error));
  }, [fetchPurchases]);

  return { purchases, loading, refetch };
}
