-- Budget feature: purchases, purchase_items, private receipts bucket

-- remote_schema (20250914150616) dropped is_household_member(); recreate the
-- original SECURITY DEFINER helper so new policies can't hit RLS recursion.
CREATE OR REPLACE FUNCTION is_household_member(household_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE user_id = auth.uid()
    AND household_id = household_uuid
  );
$$;

-- One receipt / shopping trip
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  shop_name text NOT NULL DEFAULT '',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount numeric(10,2) NOT NULL DEFAULT 0, -- receipt total; UI warns if != items sum
  receipt_url text,                              -- storage path in receipts bucket
  task_completion_id uuid REFERENCES task_completions(id) ON DELETE SET NULL,
  settled_at timestamptz,                        -- NULL = counts toward open balance
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric(9,3) NOT NULL DEFAULT 1,      -- fractional for kg items
  unit_price numeric(10,2),                      -- nullable, not on all receipts
  total_price numeric(10,2) NOT NULL,            -- negative allowed (discounts, bottle returns)
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL -- NULL = shared (even split)
);

CREATE INDEX idx_purchases_household_date ON purchases(household_id, purchased_at DESC);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view purchases"
  ON purchases FOR SELECT TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can create purchases"
  ON purchases FOR INSERT TO authenticated
  WITH CHECK (is_household_member(household_id) AND created_by = auth.uid());

-- UPDATE open to all members deliberately: settle-up touches both parties' purchases
CREATE POLICY "Household members can update purchases"
  ON purchases FOR UPDATE TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Creator or admin can delete purchases"
  ON purchases FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM household_members
      WHERE household_id = purchases.household_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Household members can manage purchase items"
  ON purchase_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.id = purchase_id AND is_household_member(p.household_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.id = purchase_id AND is_household_member(p.household_id)
    )
  );

-- Private bucket for receipt files (financial data -> signed URLs, not public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

-- Path convention: householdId/purchaseId.pdf -> first folder is household_id
CREATE POLICY "Household members can upload receipts" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND is_household_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Household members can view receipts" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND is_household_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Household members can update receipts" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'receipts'
  AND is_household_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Household members can delete receipts" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'receipts'
  AND is_household_member(((storage.foldername(name))[1])::uuid)
);
