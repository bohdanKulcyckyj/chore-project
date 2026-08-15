import { DraftItem, DraftPurchase, ShopParser } from '../types';

// `4 * 29,90 119,60 C` or `2,177 kg * 249,90 544,03 F` (name is on the previous line)
const QTY_LINE = /^(\d+(?:,\d+)?)\s*(?:kg\s*)?\*\s*(-?\d+(?:,\d+)?)\s+(-?\d+(?:,\d+)?)\s+[A-Z]$/;
// `Marináda 80ml 15,90 F` (negative for returns: `Přepravka pivo -100,00 A`)
const ONE_LINER = /^(.+?)\s+(-?\d+,\d{2})\s+[A-Z]$/;
const TOTAL_LINE = /^Součet\s+(-?\d+(?:,\d{2})?)$/;
const DATE_LINE = /^Datum:\s*(\d{2})\.(\d{2})\.(\d{2})\s+Čas:\s*(\d{2}):(\d{2}):(\d{2})/;

const num = (s: string): number => parseFloat(s.replace(',', '.'));

export const kauflandParser: ShopParser = {
  shop: 'Kaufland',
  detect: (text: string) => text.includes('Kaufland'),
  parse: (text: string): DraftPurchase => {
    const lines = text.split('\n').map((l) => l.trim());
    const items: DraftItem[] = [];
    let total = 0;
    let purchasedAt = new Date(NaN);
    let inItems = false;
    let pendingName = '';

    for (const line of lines) {
      if (line === 'Cena CZK') {
        inItems = true;
        continue;
      }
      const totalMatch = line.match(TOTAL_LINE);
      if (totalMatch) {
        total = num(totalMatch[1]);
        inItems = false;
        continue;
      }
      const dateMatch = line.match(DATE_LINE);
      if (dateMatch) {
        const [, dd, mm, yy, hh, min, ss] = dateMatch;
        purchasedAt = new Date(2000 + +yy, +mm - 1, +dd, +hh, +min, +ss);
        continue;
      }
      if (!inItems) continue;
      const qtyMatch = line.match(QTY_LINE);
      if (qtyMatch) {
        if (pendingName) {
          items.push({
            name: pendingName,
            quantity: num(qtyMatch[1]),
            unitPrice: num(qtyMatch[2]),
            totalPrice: num(qtyMatch[3]),
          });
          pendingName = '';
        }
        continue;
      }
      const oneMatch = line.match(ONE_LINER);
      if (oneMatch) {
        items.push({ name: oneMatch[1], quantity: 1, totalPrice: num(oneMatch[2]) });
        pendingName = '';
        continue;
      }
      pendingName = line;
    }

    return { shop: 'Kaufland', purchasedAt, total, items };
  },
};
