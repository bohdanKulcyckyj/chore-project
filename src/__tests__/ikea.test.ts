import { describe, expect, it } from 'vitest';
import { ikeaParser } from '../lib/receipts/parsers/ikea';

// pdfjs text of a real IKEA PDF receipt, card/loyalty numbers scrubbed.
// Covers both item layouts: qty-1 (price on the name line) and qty-n (`2 * 69,00 138,00`).
const FIXTURE = `IKEA Česká republika, s.r.o.
Skandinávská 131/1, 155 00 Praha 5
IČO 27081052, DIČ CZ27081052
****************************************
IKEA Family 0000000xxxxxxxx0000
Položka 70213550
KORKEN doza/vik 1.8 50157
2 * 69,00 138,00
Položka 30213552
KORKEN lahev s uzav. 50157
2 * 49,00 98,00
Položka 60632316 21535
KUSTFYR 2026 form.pe 59,00
Položka 70476363 17938
RINNIG chnapka/ruk š 89,00 0
-------------
Součet 384,00
Celkem položek: 6
Mastercard 384,00 CZK
SEPA-FAST RBI
NÁKUP BEZKONTAKTNÍ
IKEA\\Rudna 110\\Ostrava\\
70030 80 CZ
DEBIT MASTERCARD
XXXXXXXXXXXX0000 00
06/09/2026 16:11:22
ONLINE BEZKONTAKTNÍ
ČÁSTKA: 384,00 CZK
PLATBA POTVRZENO
Rekapitulace DPH:
KÓD SAZB BEZ DPH DPH
0 21,0 % 317,35 66,65
Číslo pokladní: 82 1
Datum Čas Obchod POS Transak
06.09.26 16:11:29 309 82 113
`;

describe('ikeaParser', () => {
  it('detects IKEA receipts', () => {
    expect(ikeaParser.detect(FIXTURE)).toBe(true);
  });

  it('does not detect other shops', () => {
    expect(ikeaParser.detect('Albert Česká republika\nCelkem 100.00 Kč')).toBe(false);
    expect(ikeaParser.detect('Lidl provozovna:\nK PLATBĚ 100,00')).toBe(false);
  });

  it('parses the receipt', () => {
    const p = ikeaParser.parse(FIXTURE);
    expect(p.shop).toBe('IKEA');
    expect(p.purchasedAt).toEqual(new Date(2026, 8, 6, 16, 11));
    expect(p.total).toBe(384);
    expect(p.items).toEqual([
      { name: 'KORKEN doza/vik 1.8', quantity: 2, unitPrice: 69, totalPrice: 138 },
      { name: 'KORKEN lahev s uzav.', quantity: 2, unitPrice: 49, totalPrice: 98 },
      { name: 'KUSTFYR 2026 form.pe', quantity: 1, totalPrice: 59 },
      { name: 'RINNIG chnapka/ruk š', quantity: 1, totalPrice: 89 },
    ]);
    const sum = p.items.reduce((a, i) => a + i.totalPrice, 0);
    expect(Math.abs(sum - p.total)).toBeLessThan(0.01);
  });
});
