import { DraftPurchase } from "../../lib/receipts/types";

/** One editable line in the purchase form. `owner_id: null` means shared. */
export interface ItemRow {
  key: number;
  name: string;
  quantity: string;
  total_price: string;
  owner_id: string | null;
}

let nextKey = 0;

export const newRow = (partial: Partial<ItemRow> = {}): ItemRow => ({
  key: nextKey++,
  name: "",
  quantity: "1",
  total_price: "",
  owner_id: null,
  ...partial,
});

/** Parsed receipt → editable form rows. `unitPrice` is intentionally dropped:
 * the form has no field for it and the DB column is nullable. */
export const draftToRows = (draft: DraftPurchase): ItemRow[] =>
  draft.items.map((item) =>
    newRow({
      name: item.name,
      quantity: String(item.quantity),
      total_price: item.totalPrice.toFixed(2),
    }),
  );
