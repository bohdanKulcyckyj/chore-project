import { describe, expect, it } from 'vitest';
import { kauflandParser } from '../lib/receipts/parsers/kaufland';

// Real receipt structure, personal data scrubbed (card/loyalty/terminal ids, barcode).
const fixture = `You earned 3 points for this purchase.
Kaufland Česká republika v.o.s.
Bělohorská 2428/203, Praha 6
IČ 25110161 / DIČ CZ25110161
Prodejna: Ostrava-Mar. Hory
Ostrava, Grmelova 2032/2
******
Cena CZK
Marináda 80ml 15,90 F
Přepravka pivo -100,00 A
Láhev pivo 0,5l
20 * 3,00 -60,00 A
Láhev pivo 0,4l
5 * 3,00 -15,00 A
Hovězí kližka
2,177 kg * 249,90 544,03 F
Součet 384,93
Platba kartou 384,93
Daň % Brutto Netto Daň
A=0,00% -175,00 -175,00 0,00
F=12,00% 559,93 499,94 59,99
Kaufland Card: xxxxx0000
Platby kartou
Kaufland CZ 1700
D o k l a d z á k a z n í k a
TID:00000000 MID:00000000
Platba
DEBIT MASTERCARD CTLS
Online ############0000
TRX:000000 REC:0000
RRN:0000 000000 AUTCOD:000000
AID: A0000000041010
Date: 09.08.26 Time: 10:36
Transakce úspěšná
Částka 384,93 CZK
Data EMV:0000008001/A800/3F0002/
//00/A0000000041010
00 Platba proběhla
Uložte si doklad
Datum:09.08.26 Čas: 10:27:22 Účt: 4800
Obchod: 1700 Kasa: 56 Obsluha: 9856
Bezplatná zákaznická linka 800 165 894
RP = recyklační příspěvek v CZK / 1ks
Informace o otevírací době naleznete
na www.kaufland.cz
Na Informacích obdržíte "1" ks bodů.
0000000000000000000000000000`;

describe('kauflandParser', () => {
  it('detects Kaufland receipts', () => {
    expect(kauflandParser.detect(fixture)).toBe(true);
  });

  it('does not detect non-Kaufland receipts', () => {
    expect(kauflandParser.detect('Albert Česká republika\nCelkem 179.30 Kč\nK PLATBĚ')).toBe(false);
  });

  it('parses shop, date, total and items', () => {
    const p = kauflandParser.parse(fixture);
    expect(p.shop).toBe('Kaufland');
    expect(p.purchasedAt).toEqual(new Date(2026, 7, 9, 10, 27, 22));
    expect(p.total).toBe(384.93);
    expect(p.items).toEqual([
      { name: 'Marináda 80ml', quantity: 1, totalPrice: 15.9 },
      { name: 'Přepravka pivo', quantity: 1, totalPrice: -100 },
      { name: 'Láhev pivo 0,5l', quantity: 20, unitPrice: 3, totalPrice: -60 },
      { name: 'Láhev pivo 0,4l', quantity: 5, unitPrice: 3, totalPrice: -15 },
      { name: 'Hovězí kližka', quantity: 2.177, unitPrice: 249.9, totalPrice: 544.03 },
    ]);
    const sum = p.items.reduce((a, i) => a + i.totalPrice, 0);
    expect(Math.abs(sum - p.total)).toBeLessThan(0.01);
  });
});
