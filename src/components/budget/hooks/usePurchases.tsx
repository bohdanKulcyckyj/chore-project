import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useHousehold } from '../../../hooks/useHousehold';
import { PurchaseWithItems } from '../../../lib/api/purchases';

// ponytail: fetch + refetch on mutation, no realtime; add if simultaneous editing ever hurts
export function usePurchases() {
  const { currentHousehold } = useHousehold();
  const [purchases, setPurchases] = useState<PurchaseWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    if (!currentHousehold) {
      setPurchases([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, purchase_items(*)')
        .eq('household_id', currentHousehold.id)
        .order('purchased_at', { ascending: false });

      if (error) throw error;
      setPurchases((data || []) as PurchaseWithItems[]);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  }, [currentHousehold]);

  useEffect(() => {
    setLoading(true);
    fetchPurchases();
  }, [fetchPurchases]);

  return { purchases, loading, refetch: fetchPurchases };
}
