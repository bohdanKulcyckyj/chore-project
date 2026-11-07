import { DraftItem, DraftPurchase, ReceiptFormat } from "../types";
import { num, reconcileTriple } from "../ocr";

// A photographed paper Penny Market receipt. Two things differ from every other
// format here:
//   * the quantity line is printed ABOVE the name+price line (Kaufland and IKEA
//     print it below), so a quantity is carried FORWARD to the next item;
//   * tax letters are C/D, and OCR loses them often enough to be useless, so a
//     price is matched without one — unlike albertPaper.ts, which anchors on
//     the letter.
// The qty line above each item is a second reading of the same money, which is
// what repairs the three item-line prices OCR destroyed on this photo.

// `1.000 ks x 47.90 Kč /ks`, with a stray pipe between `x` and the price.
const QTY_LINE =
  /(\d+[.,]\d{3})\s*ks\.?\s*[xX×]\s*\|?\s*(\d+[.,]\d{2})\d*\s*K[čceě]/;
// Every price on the line. The LAST one is the line total; earlier ones belong
// to the name (`Radegast Rázná 10 0,5l`, whose `0,5l` reads as `0,51`). Keeping
// 2 decimals drops digits OCR glues on the right (`29,900`).
const PRICES = /(\d+[,.]\d{2})\d*/g;
// `(Čočka červená 500g … 24,90)` — Penny restates an item's price AFTER the
// discount in parentheses. That net figure is authoritative, exactly as Lidl's
// `Cena po slevě`: the 12% DPH base (214,29 + 25,71 = 240,00) balances only
// with 24,90 for this item, never with the 33,90 printed above it.
const NET_LINE = /(\d+[,.]\d{2})\s*\)/;
const DISCOUNT_LINE = /-\s*(\d+[,.]\d{2})/;
// Past any of these the receipt is payment/DPH/legal/advert noise. Matching
// `kem Kč` and not `Celkem`, because this OCR reads `Celkem Kč` as `Ikem Kč`;
// stopping here is what keeps the mangled total (`065.00`), the card slip and
// the footer advert (`1+1 plyšák za 99,90`) out of the items.
const END_LINE = /kem\s*K[čceě]|P[ŘR]IJATO|Total:\s*CZK|DPH\s*z/i;
// 4-digit year, unlike Albert/Kaufland. Also skipped inside the item loop:
// `07.10.2026` otherwise reads as the price 07.10.
const DATE_ANY = /(\d{2})\.(\d{2})\.(\d{4})/;
const DATE_TIME = /Datum:\s*(\d{2})\.(\d{2})\.(\d{4})[^\d]{0,12}(\d{2}):(\d{2}):(\d{2})/;
const TOTAL_CELKEM = /kem[ ]*K[čceě][ :]*((?:\d ?)*\d[,.]\d{2})/;
const TOTAL_PAID = /(?:P[ŘR]IJATO|plateb|Total:[ ]*CZK)[^\d\n]{0,20}((?:\d ?)*\d[,.]\d{2})/i;

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Penny prints mixed-case names (`Okurka salátová`, `Brambory 2kg konzumní`),
// so albertPaper's all-caps heuristic does not apply. A name is the first run
// of word-like tokens: 2+ chars, starting alphanumeric, carrying a lowercase
// letter or a digit. That keeps `jog.bílý`, `500g` and `0,5l`, and drops the
// pipes, single letters and all-caps fragments OCR wraps the line in
// (`| Í í …`, `[o`, `HHHHHHHHHHHHH`, `… 14 MUŽ`, `; U A790 A KD A AL né`).
const WORDISH = /^[\p{L}\p{N}][\p{L}\p{N}.,%()/-]*$/u;
const wordish = (t: string): boolean =>
  t.length > 1 && WORDISH.test(t) && /[\p{Ll}\d]/u.test(t);

function stripNoise(s: string): string {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  const start = tokens.findIndex(wordish);
  if (start === -1) return "";
  let end = start;
  while (end < tokens.length && wordish(tokens[end])) end++;
  return tokens.slice(start, end).join(" ");
}

export const pennyFormat: ReceiptFormat = {
  shop: "Penny",
  // The logo renders as `PENNY. K L` and the company line as
  // `PENNY MARKET 5.R.0.`, but the word itself is printed six times (header,
  // store address, `WWW, PENNY CZ`, loyalty footer), so one of them survives.
  detect: (text: string) => /penny/i.test(text),
  parse: (text: string): DraftPurchase => {
    const items: DraftItem[] = [];
    let pending: { qty: string; unit: string } | null = null;

    for (const line of text.split("\n").map((l) => l.trim())) {
      if (END_LINE.test(line)) break;
      if (DATE_ANY.test(line)) continue;

      const qtyMatch = line.match(QTY_LINE);
      if (qtyMatch) {
        pending = { qty: qtyMatch[1], unit: qtyMatch[2] };
        continue;
      }

      const last = items[items.length - 1];
      const net = line.match(NET_LINE);
      if (net && last) {
        // authoritative post-discount price; replaces the pre-discount line and
        // makes any -X,XX line for the same item redundant
        last.totalPrice = num(net[1]);
        last.unitPrice = round2(last.totalPrice / last.quantity);
        continue;
      }
      const discount = line.match(DISCOUNT_LINE);
      if (discount && last) {
        // `ČOČKA ČERV.PŮL.LOUP.500G  -9,00` under the discounted item. OCR lost
        // the amount on this photo, so this branch does not fire on the
        // fixture; a cleaner scan hits it, and the NET_LINE above (printed
        // after it) overwrites the result either way.
        last.totalPrice = round2(last.totalPrice - num(discount[1]));
        continue;
      }

      const prices = [...line.matchAll(PRICES)];
      const price = prices[prices.length - 1];
      const name = stripNoise(price ? line.slice(0, price.index) : line);
      if (!name) continue;

      if (pending) {
        // qty * unit from the line above is a second reading of the same money:
        // prefer the triple that reconciles, else trust it over the item line,
        // which is where OCR damage lands (`A790`, `29.00`, no price at all).
        const triple = price
          ? reconcileTriple(pending.qty, pending.unit, price[1])
          : null;
        const quantity = num(pending.qty);
        const unitPrice = num(pending.unit);
        items.push({
          name,
          ...(triple ?? {
            quantity,
            unitPrice,
            totalPrice: round2(quantity * unitPrice),
          }),
        });
        pending = null;
      } else if (price) {
        items.push({ name, quantity: 1, totalPrice: num(price[1]) });
      }
    }

    const dt = text.match(DATE_TIME);
    const d = dt ?? text.match(DATE_ANY);
    const total = text.match(TOTAL_CELKEM) ?? text.match(TOTAL_PAID);

    // ponytail: no withRemainder here, unlike albertPaper.ts. There, a shortfall
    // means OCR ate one whole price, so a labelled remainder row is the honest
    // reconstruction. Here the only shortfall this photo produces is a MISREAD
    // line price (Radegast 25,90 read as 23,90) — an extra 2,00 row would hide
    // a wrong price instead of surfacing it, and the review form's amber
    // sum-mismatch warning is the signal the user needs.
    return {
      shop: "Penny",
      purchasedAt: d
        ? new Date(+d[3], +d[2] - 1, +d[1], dt ? +dt[4] : 12, dt ? +dt[5] : 0, dt ? +dt[6] : 0)
        : new Date(NaN),
      total: total ? num(total[1]) : 0,
      items,
    };
  },
};
