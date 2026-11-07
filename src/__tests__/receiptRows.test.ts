import { describe, expect, it } from "vitest";
import { draftToRows } from "../components/budget/receiptRows";
import { DraftPurchase } from "../lib/receipts/types";

const draft = (items: DraftPurchase["items"]): DraftPurchase => ({
  shop: "Albert",
  purchasedAt: new Date(2026, 9, 17, 12, 0),
  total: 0,
  items,
});

describe("draftToRows", () => {
  it("formats prices to 2 decimals and defaults every row to shared", () => {
    const rows = draftToRows(
      draft([{ name: "ALBERT TP SVR BR", quantity: 1, totalPrice: 69.9 }]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "ALBERT TP SVR BR",
      quantity: "1",
      total_price: "69.90",
      owner_id: null,
    });
  });

  it("keeps fractional quantities for weighed goods", () => {
    const rows = draftToRows(
      draft([
        { name: "PREMIUM VEPŘ.ŠUN.NJ", quantity: 0.214, unitPrice: 289, totalPrice: 51.1 },
      ]),
    );
    expect(rows[0].quantity).toBe("0.214");
    // unitPrice has no field in the form and is dropped on purpose
    expect(rows[0]).not.toHaveProperty("unit_price");
  });

  it("gives every row a distinct key so React can track them", () => {
    const rows = draftToRows(
      draft([
        { name: "A", quantity: 1, totalPrice: 1 },
        { name: "B", quantity: 1, totalPrice: 2 },
      ]),
    );
    expect(rows[0].key).not.toBe(rows[1].key);
  });
});
