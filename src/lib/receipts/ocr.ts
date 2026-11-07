import { DraftItem } from "./types";

// Numeric helpers shared by the OCR-facing parsers.
//
// OCR of thermal paper mangles numbers in two specific ways that regexes alone
// cannot fix: Czech comma decimals get read as dots (or colons), and stray
// digits get glued into prices (`29,990` for `29,90`, `709,84` for `70,84`).
// The repair strategy is to generate candidates and keep the arithmetically
// consistent one — a receipt line carries its own checksum in qty * unit = total.

/** Tolerance for "these two money values are the same", in Kč. */
export const TOL = 0.015;

/** Czech habit: comma decimals. Also tolerates spaces as thousand separators. */
export const num = (s: string): number =>
  parseFloat(s.replace(/\s/g, "").replace(",", "."));

/** The value as-is, plus every single-digit deletion. The as-is reading always
 * comes first, so callers that take the first consistent candidate prefer it. */
export function variants(s: string): number[] {
  const out = [num(s)];
  for (let i = 0; i < s.length; i++) {
    if (/\d/.test(s[i])) {
      const v = num(s.slice(0, i) + s.slice(i + 1));
      if (Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

export interface ReconciledTriple {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Albert prints qty, unit price and total on ONE line, so OCR can glue a digit
 * into any of the three. Pick the candidate triple where qty * unit ≈ total;
 * null when nothing reconciles and the caller must fall back to the raw read. */
export function reconcileTriple(
  qtyRaw: string,
  unitRaw: string,
  totalRaw: string,
): ReconciledTriple | null {
  for (const quantity of variants(qtyRaw)) {
    if (quantity <= 0) continue;
    for (const unitPrice of variants(unitRaw)) {
      for (const totalPrice of variants(totalRaw)) {
        if (Math.abs(quantity * unitPrice - totalPrice) < TOL) {
          return {
            quantity,
            unitPrice,
            totalPrice: round2(totalPrice),
          };
        }
      }
    }
  }
  return null;
}

/** A receipt carries its own checksum: the printed total. When OCR destroyed
 * exactly one item's price (`59,90` read as `59, p-`), the shortfall is that
 * price, so it is surfaced as ONE labelled row for the user to name rather than
 * silently under-reporting the purchase. Two or more lost prices collapse into
 * a single row — the arithmetic cannot separate them. */
export function withRemainder(
  items: DraftItem[],
  total: number,
  label = "Unrecognised item",
): DraftItem[] {
  if (!(total > 0)) return items;
  const sum = items.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const remainder = round2(total - sum);
  if (remainder < TOL) return items;
  return [...items, { name: label, quantity: 1, totalPrice: remainder }];
}
