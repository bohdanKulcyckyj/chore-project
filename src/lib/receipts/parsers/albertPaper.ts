import { DraftItem, DraftPurchase, ReceiptFormat } from "../types";
import { num, withRemainder } from "../ocr";

// A photographed paper Albert receipt, which is a DIFFERENT layout from the
// Muj Albert PDF export (see albertPdf.ts): comma decimals, `NAME PRICE LETTER`
// one-liners instead of `1 x 32.90 Kč 32.90 Kč`, and no `Kč` on the total.
//
// OCR picks up the receipt edges and the surface it was photographed on, so
// every line arrives wrapped in junk:
//   `| ALBERT TP SVR BR 69,90 B a —`
//   `ko 8 o DR. O. HOLAN.KAKAO100G 54,90 A K 1 5 ků.`
// Hence: match the price + tax letter anywhere in the line, not anchored.

// `… 69,90 B …` — the tax letter is followed by more noise, so no `$` anchor.
const ITEM_LINE = /(\d+[,.]\d{2})\s+([AB])(?:\s|$)/;
// `0,214 kg x 289,00 Kč/kg 51,10 A` — name sits on the preceding line.
const KG_LINE =
  /(\d+[,.]\d+)\s*kg\s*[xX×]\s*(\d+[,.]\d{2})\s*K[čceě]?\/kg\s+(\d+[,.]\d{2})\s+([AB])/;
const TOTAL_LINE = /Celkem\s+(\d+[,.]\d{2})/;
const DATE_LINE = /\b(\d{2})\.(\d{2})\.(\d{2})\b/;

// Item names are printed in caps. Drop leading tokens until one starts with two
// capitals — that strips `| `, `ko 8 o `, `Eko c-oe ` without eating `DR. O.`
// or `EMMA …`. Deliberately conservative: leftover noise is visible in the
// review form, whereas an over-eager strip silently loses the real name.
const CAPS_START = /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{2,}/;

// Trailing junk has no price to cut at on a name-only line (`PREMIUM
// VEPŘ.ŠUN.NJ vd E :`). Drop stray tails but keep short all-caps fragments,
// which are real name parts (`… ŠUN.NJ`, `ALBERT TP SVR BR`).
const isTailNoise = (t: string): boolean =>
  !/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9]/.test(t) || t.length === 1 || /[a-z]/.test(t);

function stripNoise(prefix: string): string {
  const tokens = prefix.trim().split(/\s+/).filter(Boolean);
  const start = tokens.findIndex((t) => CAPS_START.test(t));
  if (start === -1) return "";
  let end = tokens.length;
  while (end > start + 1 && isTailNoise(tokens[end - 1])) end--;
  return tokens.slice(start, end).join(" ");
}

export const albertPaperFormat: ReceiptFormat = {
  shop: "Albert",
  // Albert plus a comma-decimal total. The PDF export prints `Celkem 219.50 Kč`
  // with a dot, so the two Albert formats never both match.
  detect: (text: string) => /albert/i.test(text) && /Celkem\s+\d+,\d{2}/.test(text),
  parse: (text: string): DraftPurchase => {
    const lines = text.split("\n").map((l) => l.trim());
    const items: DraftItem[] = [];
    let total = 0;
    let purchasedAt = new Date(NaN);
    let pendingName = "";

    for (const line of lines) {
      const totalMatch = line.match(TOTAL_LINE);
      if (totalMatch) {
        total = num(totalMatch[1]);
        break; // past the total it is all payment/DPH/legal noise
      }

      const kg = line.match(KG_LINE);
      if (kg && pendingName) {
        items.push({
          name: pendingName,
          quantity: num(kg[1]),
          unitPrice: num(kg[2]),
          totalPrice: num(kg[3]),
        });
        pendingName = "";
        continue;
      }

      const item = line.match(ITEM_LINE);
      if (item) {
        const name = stripNoise(line.slice(0, item.index));
        if (name) {
          items.push({ name, quantity: 1, totalPrice: num(item[1]) });
          pendingName = "";
          continue;
        }
      }

      const candidate = stripNoise(line);
      if (candidate) pendingName = candidate;
    }

    const date = text.match(DATE_LINE);
    if (date) {
      // no reliable clock on the row that carries the date; noon dodges DST
      purchasedAt = new Date(2000 + +date[3], +date[2] - 1, +date[1], 12, 0);
    }

    return {
      shop: "Albert",
      purchasedAt,
      total,
      items: withRemainder(items, total),
    };
  },
};
