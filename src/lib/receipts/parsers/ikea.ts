import { DraftItem, DraftPurchase, ShopParser } from '../types';

// Each item is a `Položka <art.no.> [<dept>]` header followed by a name line:
//   `SOJABÖNA kvetinac 9 29,00 0`  — name, price, optional VAT code
//   `KORKEN doza/vik 1.8 50157`    — name + dept, price comes on the qty line
const NAME_PRICE = /^(.+?)\s+(\d+,\d{2})(?:\s+\d)?$/;
const DEPT_SUFFIX = /\s+\d{4,}$/;
const QTY_LINE = /^(\d+)\s+\*\s+(\d+,\d{2})\s+(\d+,\d{2})$/;
const TOTAL_LINE = /^Součet\s+(\d+,\d{2})$/;
const DATE_LINE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):\d{2}$/;

const num = (s: string): number => parseFloat(s.replace(',', '.'));

export const ikeaParser: ShopParser = {
  shop: 'IKEA',
  detect: (text: string) => text.includes('IKEA Česká republika'),
  parse: (text: string): DraftPurchase => {
    const lines = text.split('\n').map((l) => l.trim());
    const items: DraftItem[] = [];
    let total = 0;
    let purchasedAt = new Date(NaN);
    let expectName = false;

    for (const line of lines) {
      if (line.startsWith('Položka')) {
        expectName = true;
        continue;
      }
      const totalMatch = line.match(TOTAL_LINE);
      if (totalMatch) {
        total = num(totalMatch[1]);
        continue;
      }
      const dateMatch = line.match(DATE_LINE);
      if (dateMatch) {
        const [, dd, mm, yyyy, hh, min] = dateMatch;
        purchasedAt = new Date(+yyyy, +mm - 1, +dd, +hh, +min);
        continue;
      }
      const qtyMatch = line.match(QTY_LINE);
      if (qtyMatch) {
        const last = items[items.length - 1];
        if (last) {
          last.quantity = +qtyMatch[1];
          last.unitPrice = num(qtyMatch[2]);
          last.totalPrice = num(qtyMatch[3]);
        }
        continue;
      }
      if (!expectName) continue;
      expectName = false;
      const m = line.match(NAME_PRICE);
      if (m) items.push({ name: m[1], quantity: 1, totalPrice: num(m[2]) });
      // no price on the name line → multi-quantity item, priced by the qty line
      else items.push({ name: line.replace(DEPT_SUFFIX, ''), quantity: 1, totalPrice: 0 });
    }

    return { shop: 'IKEA', purchasedAt, total, items };
  },
};
