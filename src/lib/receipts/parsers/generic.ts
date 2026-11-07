import { DraftItem, DraftPurchase, ReceiptFormat } from "../types";
import { num, withRemainder } from "../ocr";

// Last-resort scraper for a receipt no shop format recognises. It knows nothing
// about any layout: it takes the last money-looking value on a line as a price
// and whatever precedes it as a name. That over-collects on unusual layouts,
// which is fine — the purchase form is the review step and already warns when
// the items do not sum to the total.
//
// Deliberately NOT registered in parsers[]: detectParser() must keep returning
// undefined for unknown shops, so callers opt into guessing explicitly.

const PRICE = /(-?\d+[,.]\d{2})/g;

// Totals, tax, payment and footer lines. Anything matching is not an item.
const NOISE =
  /Celkem|Součet|Soucet|K\s*PLATB|DPH|Sazba|Základ|Zaklad|Platební|Platebni|Karta|Karty|Hotovost|Zaplaceno|Záloha|Datum|Čas|Cas|IČO|ICO|DIČ|DIC|Terminál|Terminal|SEQ|Účtenka|Uctenka|PRODEJ|Autoriz|MASTERCARD|VISA|DEBIT|Kredit|bod/i;

const TOTAL_LINE =
  /(?:Celkem|Součet|Soucet|K\s*PLATBĚ|K\s*PLATBE|Total)\s*:?\s*(-?\d+[,.]\d{2})/i;
const DATE_LINE = /\b(\d{2})[./](\d{2})[./](\d{2}|\d{4})\b/;
// a name needs real letters, not just stray OCR marks
const HAS_WORD = /[A-Za-zÁ-Žá-ž]{2,}/;

export const genericFormat: ReceiptFormat = {
  // blank so the form leaves the Shop field for the user to fill in
  shop: "",
  // never auto-detected; see the note above
  detect: () => false,
  parse: (text: string): DraftPurchase => {
    const lines = text.split("\n").map((l) => l.trim());
    const items: DraftItem[] = [];

    for (const line of lines) {
      if (!line || NOISE.test(line)) continue;
      const prices = [...line.matchAll(PRICE)];
      if (prices.length === 0) continue;
      const last = prices[prices.length - 1];
      const name = line.slice(0, last.index).trim();
      if (!HAS_WORD.test(name)) continue;
      items.push({ name, quantity: 1, totalPrice: num(last[1]) });
    }

    const totalMatch = text.match(TOTAL_LINE);
    const total = totalMatch
      ? num(totalMatch[1])
      : items.reduce((s, i) => s + i.totalPrice, 0);

    let purchasedAt = new Date();
    const date = text.match(DATE_LINE);
    if (date) {
      const year = date[3].length === 2 ? 2000 + +date[3] : +date[3];
      purchasedAt = new Date(year, +date[2] - 1, +date[1], 12, 0);
    }

    return { shop: "", purchasedAt, total, items: withRemainder(items, total) };
  },
};
