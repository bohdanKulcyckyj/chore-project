import { describe, expect, it } from 'vitest';
import { lidlParser } from '../lib/receipts/parsers/lidl';

// Real tesseract.js OCR of a Lidl receipt, personal data scrubbed
// (card fragment, SEO ID, Autoriz. kód, terminal ID, fiscal line).
const FIXTURE = `To se vyplatí.
Lidl provozovna:
Ostrava, K Lávce 1181/3
Kč
Cottage Light 68,709 B
3 ks x 22,90 Kč/ks
SLEVA 20% -13,74
Cena po slevě 54,96
Coca-Cola Zero 34,90 C
Vejce "M", 30ks 144,90 B
Cottage Light 22,90 B
Guacamole Chunky 49,90 B
Hummus s rest.cib 26,90 B
Banány 30,20 B
N 1,010 kg x 29,990 Kč/kg
Kobliha pistáciová 49,80 B
2 ks x 24,90 Kč/ks
Jahody volné 75,39 B
N 0,506 kg x 149,00 Kč/kg
PT: 0,028 kg
Meloun vodní baby 117,15 B
N 3,918 kg  x29,990 Kč/kg
Papír. taška střed 8,909 C
Knoppers NutBar 33,80 B
2 ks x 16,90 Kč/ks
K PLATBĚ 649,70
Karta 649,70
Celková zaplacená částka 649,70
15/08/26 12:36 Účtenka číslo 08205
Terminál: (LI000000-00000000)
PRODEJ 649.70 Kč
*kkk *k**x ***x* 0000 / 00 (L) MASTERCARD
AO 00 00 00 04 10 10 DEBIT MASTERCARD
SEO ID: 000:000:000, Autoriz. kód 000000
Mobile Pin *NO REFUND*
Celková sleva 13,74
B 12% DPH z 605,90 64,92
C 21% DPH z 43,80 7,60
0000  000000/000/00 15.08.26 12:33:21
PT = Předvolená tára
N = Netto váha
Záruční a další údaje - zadní strana
Lidl Česká republika s.r.o.
Nárožní 1359/11, 158 00 Praha 5
IČ: 26178541, DIČ: CZ26178541
`;

describe('lidlParser', () => {
  it('detects Lidl receipts', () => {
    expect(lidlParser.detect(FIXTURE)).toBe(true);
  });

  it('does not detect other shops', () => {
    expect(lidlParser.detect('Albert Česká republika\nCelkem 100.00 Kč')).toBe(false);
    expect(lidlParser.detect('Kaufland ČR v.o.s.\nSUMA 100,00')).toBe(false);
  });

  it('parses the receipt', () => {
    const p = lidlParser.parse(FIXTURE);
    expect(p.shop).toBe('Lidl');
    expect(p.purchasedAt).toEqual(new Date(2026, 7, 15, 12, 36));
    expect(p.total).toBe(649.7);
    expect(p.items).toEqual([
      { name: 'Cottage Light', quantity: 3, unitPrice: 22.9, totalPrice: 54.96 },
      { name: 'Coca-Cola Zero', quantity: 1, totalPrice: 34.9 },
      { name: 'Vejce "M", 30ks', quantity: 1, totalPrice: 144.9 },
      { name: 'Cottage Light', quantity: 1, totalPrice: 22.9 },
      { name: 'Guacamole Chunky', quantity: 1, totalPrice: 49.9 },
      { name: 'Hummus s rest.cib', quantity: 1, totalPrice: 26.9 },
      { name: 'Banány', quantity: 1.01, unitPrice: 29.9, totalPrice: 30.2 },
      { name: 'Kobliha pistáciová', quantity: 2, unitPrice: 24.9, totalPrice: 49.8 },
      { name: 'Jahody volné', quantity: 0.506, unitPrice: 149, totalPrice: 75.39 },
      { name: 'Meloun vodní baby', quantity: 3.918, unitPrice: 29.9, totalPrice: 117.15 },
      { name: 'Papír. taška střed', quantity: 1, totalPrice: 8.9 },
      { name: 'Knoppers NutBar', quantity: 2, unitPrice: 16.9, totalPrice: 33.8 },
    ]);
    const sum = p.items.reduce((a, i) => a + i.totalPrice, 0);
    expect(Math.abs(sum - p.total)).toBeLessThan(0.01);
  });
});
