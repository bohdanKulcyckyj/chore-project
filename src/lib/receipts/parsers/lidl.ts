import { DraftItem, DraftPurchase, ShopParser } from '../types';

// Item line: `Name 68,70 B` — keep-2-decimals drops glued OCR digits (`68,709 B`).
const ITEM_LINE = /^(.+?)\s+(\d+,\d{2})\d*\s+[ABC]$/;
const KS_LINE = /^(\d+)\s+ks\s+x\s*(\d+,\d+)\s*Kč\/ks/;
const KG_LINE = /^N'?\s+(\d+,\d+)\s+kg\s+x\s*(\d+,\d+)\s*Kč\/kg/;
const SLEVA_LINE = /sleva\b.*?-(\d+,\d{2})\s*$/i;
const CENA_PO_SLEVE = /^Cena po slevě\s+(\d+,\d{2})/;
const TOTAL_LINE = /^K PLATBĚ\s+((?:\d\s?)*\d,\d{2})/;
const DATE_LINE = /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+Účtenka/;
const DATE_FALLBACK = /(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/;

const TOL = 0.015;

const num = (s: string): number => parseFloat(s.replace(/\s/g, '').replace(',', '.'));
const round2 = (n: number): number => Math.round(n * 100) / 100;

// OCR glues stray digits into prices (`29,990` = 29,90; `709,84` = 70,84).
// Candidates = the value as-is plus every single-digit deletion.
function variants(s: string): number[] {
  const out = [num(s)];
  for (let i = 0; i < s.length; i++) {
    if (/\d/.test(s[i])) {
      const v = num(s.slice(0, i) + s.slice(i + 1));
      if (Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

// Qty line sets quantity/unitPrice of the previous item; pick the first
// total/unit candidate pair where qty * unit ≈ total.
function reconcile(item: DraftItem, qty: number, unitRaw: string, totalRaw: string): void {
  item.quantity = qty;
  for (const u of variants(unitRaw)) {
    if (Math.abs(qty * u - item.totalPrice) < TOL) {
      item.unitPrice = u;
      return;
    }
  }
  for (const t of variants(totalRaw)) {
    for (const u of variants(unitRaw)) {
      if (Math.abs(qty * u - t) < TOL) {
        item.totalPrice = round2(t);
        item.unitPrice = u;
        return;
      }
    }
  }
  // ponytail: irreconcilable OCR — keep the item-line total, drop unitPrice
}

export const lidlParser: ShopParser = {
  shop: 'Lidl',
  detect: (text: string) => text.includes('Lidl'),
  parse: (text: string): DraftPurchase => {
    const lines = text.split('\n').map((l) => l.trim());
    const items: DraftItem[] = [];
    const rawTotals: string[] = [];
    let total = 0;
    let inItems = false;

    for (const line of lines) {
      if (!inItems) {
        if (line === 'Kč') inItems = true;
        continue;
      }
      const totalMatch = line.match(TOTAL_LINE);
      if (totalMatch) {
        total = num(totalMatch[1]);
        break; // everything after K PLATBĚ is payment/DPH/legal noise
      }
      const last = items[items.length - 1];
      let m: RegExpMatchArray | null;
      if ((m = line.match(KS_LINE))) {
        if (last) reconcile(last, +m[1], m[2], rawTotals[items.length - 1]);
      } else if ((m = line.match(KG_LINE))) {
        if (last) reconcile(last, num(m[1]), m[2], rawTotals[items.length - 1]);
      } else if ((m = line.match(SLEVA_LINE))) {
        if (last) last.totalPrice = round2(last.totalPrice - num(m[1]));
      } else if ((m = line.match(CENA_PO_SLEVE))) {
        if (last) last.totalPrice = num(m[1]); // authoritative post-discount price
      } else if (line.startsWith('PT:')) {
        // tára line — skip
      } else if ((m = line.match(ITEM_LINE))) {
        items.push({ name: m[1], quantity: 1, totalPrice: num(m[2]) });
        rawTotals.push(m[2]);
      }
      // anything else in the section is OCR noise — skip
    }

    let purchasedAt = new Date(NaN);
    const d = text.match(DATE_LINE) ?? text.match(DATE_FALLBACK);
    if (d) purchasedAt = new Date(2000 + +d[3], +d[2] - 1, +d[1], +d[4], +d[5]);

    return { shop: 'Lidl', purchasedAt, total, items };
  },
};
