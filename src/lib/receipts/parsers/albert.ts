import { DraftItem, DraftPurchase, ShopParser } from '../types';

const ITEM_LINE = /^(\d+(?:\.\d+)?) x (\d+(?:\.\d+)?) Kč (\d+(?:\.\d+)?) Kč$/;
const TOTAL_LINE = /^Celkem (\d+(?:\.\d+)?) Kč/;
const DATE_LINE = /^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}) Účtenka/;
// ponytail: trailing weighing letter (M/P/E) and/or tax letter (A/B/C) stripped from name
const NAME_SUFFIX = /(?:\s+[MPE])?\s+[ABC]$/;

export const albertParser: ShopParser = {
  shop: 'Albert',
  detect: (text: string) => text.includes('Albert Česká republika'),
  parse: (text: string): DraftPurchase => {
    const lines = text.split('\n').map((l) => l.trim());
    const items: DraftItem[] = [];
    let total = 0;
    let purchasedAt = new Date(NaN);
    let inItems = false;
    let pendingName = '';

    for (const line of lines) {
      if (line.startsWith('Položka')) {
        inItems = true;
        continue;
      }
      const totalMatch = line.match(TOTAL_LINE);
      if (totalMatch) {
        total = parseFloat(totalMatch[1]);
        inItems = false;
        continue;
      }
      const dateMatch = line.match(DATE_LINE);
      if (dateMatch) {
        const [, dd, mm, yy, hh, min] = dateMatch;
        purchasedAt = new Date(2000 + +yy, +mm - 1, +dd, +hh, +min);
        continue;
      }
      if (!inItems) continue;
      const itemMatch = line.match(ITEM_LINE);
      if (itemMatch && pendingName) {
        items.push({
          name: pendingName,
          quantity: parseFloat(itemMatch[1]),
          unitPrice: parseFloat(itemMatch[2]),
          totalPrice: parseFloat(itemMatch[3]),
        });
        pendingName = '';
      } else {
        pendingName = line.replace(NAME_SUFFIX, '');
      }
    }

    return { shop: 'Albert', purchasedAt, total, items };
  },
};
