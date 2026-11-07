import { describe, expect, it } from "vitest";
import { genericFormat } from "../lib/receipts/parsers/generic";
import { detectParser } from "../lib/receipts/parsers";

// A shop with no dedicated format. Shape is deliberately unlike the four known
// layouts: mixed-case names, a VAT block, and a payment line.
const fixture = `BILLA Praha 4
Houskovy knedlik 24,90 A
Mleko Pilos 1l 19,90 A
Rohlik 3,50 B
Celkem 48,30
Platebni karty 48,30
12% DPH z 43,12 5,18
Datum 07.11.26 Cas 18:22
ICO: 00000000`;

describe("genericFormat", () => {
  it("is not in the registry — unknown shops stay undetected", () => {
    expect(detectParser(fixture)).toBeUndefined();
    expect(genericFormat.detect(fixture)).toBe(false);
  });

  it("scrapes the items and ignores the VAT/payment block", () => {
    const p = genericFormat.parse(fixture);
    expect(p.items).toEqual([
      { name: "Houskovy knedlik", quantity: 1, totalPrice: 24.9 },
      { name: "Mleko Pilos 1l", quantity: 1, totalPrice: 19.9 },
      { name: "Rohlik", quantity: 1, totalPrice: 3.5 },
    ]);
  });

  it("reads the total and leaves the shop for the user", () => {
    const p = genericFormat.parse(fixture);
    expect(p.total).toBe(48.3);
    expect(p.shop).toBe("");
    expect(p.purchasedAt).toEqual(new Date(2026, 10, 7, 12, 0));
  });

  it("falls back to the items sum when no total line is present", () => {
    expect(genericFormat.parse("Chleb 20,00\nMaslo 50,00").total).toBe(70);
  });

  it("finds nothing in text with no prices", () => {
    expect(genericFormat.parse("albert\nSka.\nNJN HW HDP").items).toEqual([]);
  });
});
