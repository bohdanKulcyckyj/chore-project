import { describe, expect, it } from "vitest";
import { num, reconcileTriple, variants } from "../lib/receipts/ocr";

describe("num", () => {
  it("reads Czech comma decimals", () => {
    expect(num("29,90")).toBe(29.9);
  });

  it("reads dot decimals (the Muj Albert PDF export uses them)", () => {
    expect(num("29.90")).toBe(29.9);
  });

  it("strips spaces used as thousand separators", () => {
    expect(num("1 234,50")).toBe(1234.5);
  });
});

describe("variants", () => {
  it("puts the as-is reading first", () => {
    expect(variants("29,90")[0]).toBe(29.9);
  });

  it("offers the single-digit deletion that repairs a glued price", () => {
    // OCR read 29,90 as 29,990
    expect(variants("29,990")).toContain(29.9);
  });

  it("only deletes digits, never the separator", () => {
    expect(variants("5,00").every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("reconcileTriple", () => {
  it("keeps a clean line untouched", () => {
    expect(reconcileTriple("1", "32.90", "32.90")).toEqual({
      quantity: 1,
      unitPrice: 32.9,
      totalPrice: 32.9,
    });
  });

  it("handles fractional quantities for weighed goods", () => {
    // 0.83 x 24.90 = 20.667 -> receipt prints 20.70, outside TOL, so the
    // as-is triple must NOT be accepted on arithmetic grounds alone
    expect(reconcileTriple("0.83", "24.90", "20.70")).toBeNull();
  });

  it("repairs a glued digit in the total", () => {
    // qty 2, unit 69,00 -> 138,00, but OCR read the total as 1380,0
    expect(reconcileTriple("2", "69,00", "1380,0")).toEqual({
      quantity: 2,
      unitPrice: 69,
      totalPrice: 138,
    });
  });

  it("repairs a glued digit in the unit price", () => {
    expect(reconcileTriple("3", "10,900", "32.70")).toEqual({
      quantity: 3,
      unitPrice: 10.9,
      totalPrice: 32.7,
    });
  });

  it("returns null when nothing reconciles", () => {
    expect(reconcileTriple("2", "11,11", "99,99")).toBeNull();
  });
});
