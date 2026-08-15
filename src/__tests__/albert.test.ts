import { describe, expect, it } from 'vitest';
import { albertParser } from '../lib/receipts/parsers/albert';

// Real Albert receipt with personal data scrubbed (phone, card, SEQ/Autoriz,
// ID účtu, terminal, barcode replaced with fake values).
const fixture = `219.50 Kč • 0 kreditů • 1 bod 14. 8. 2026
Díky akcím jste ušetřili 20.00 Kč
Položka Cena
GUS WOK SMĚS 450G A
1 x 32.90 Kč 32.90 Kč
MG NUDL.PÁN.KUŘE185G A
1 x 63.90 Kč 63.90 Kč
ALB SUŠ.ČESNEK 30G A
1 x 7.90 Kč 7.90 Kč
EIDAM 30% BL. 2X100G A
1 x 36.90 Kč 36.90 Kč
ALB NITĚ NEUZENÉ100G A
1 x 28.90 Kč 28.90 Kč
BRAMBORY KONZ. RANÉ P A
0.83 x 24.90 Kč 20.70 Kč
NEKTARINKY P A
0.515 x 54.90 Kč 28.30 Kč
Celkem 219.50 Kč
Získané kredity 0 kreditů
Získané body 1 bod
PRODEJNA KLIENT
Ostrava, Poruba, 1. Čs. arm. sboru +420 000 000 000
1. československého armádního sboru 1333, Ostrava Poruba
Platební metoda Hodnota
Platební karty 219.50 Kč
Kód Sazba Základ DPH Výše DPH
A 12 % 195.98 Kč 23.52 Kč
14/08/26 11:10 Účtenka číslo 00467
Terminál: (PVTC0000-00000000)
PRODEJ 219.50 Kč
**** **** **** 0000 / 00 (L) MASTERCARD
A0 00 00 00 04 10 10 DEBIT MASTERCARD
SEQ ID: 000:000:000, Autoriz. kód 000000
No Pin *NO REFUND*
ID účtu: 00000000000000000
Datum Čas Obch Pokl Obsl Trans
14. 08. 26 11:06 383 103 103 32634
Albert Česká republika, s.r.o.
Radlická 520/117, 158 00 Praha 5
IČO: 44012373, DIČ: CZ44012373
Legenda způsobu vážení položek:
“M” - Ruční zadání, “P” - Váženo na pokladně, “E” - Váženo etiketovací váhou
000000000000000000000000000000000000`;

describe('albertParser', () => {
  it('detects Albert receipts', () => {
    expect(albertParser.detect(fixture)).toBe(true);
  });

  it('does not detect non-Albert receipts', () => {
    expect(albertParser.detect('Kaufland v.o.s.\nSoučet 123.00\nLidl K PLATBĚ')).toBe(false);
  });

  it('parses the receipt', () => {
    const p = albertParser.parse(fixture);
    expect(p.shop).toBe('Albert');
    expect(p.purchasedAt).toEqual(new Date(2026, 7, 14, 11, 10));
    expect(p.total).toBe(219.5);
    expect(p.items).toEqual([
      { name: 'GUS WOK SMĚS 450G', quantity: 1, unitPrice: 32.9, totalPrice: 32.9 },
      { name: 'MG NUDL.PÁN.KUŘE185G', quantity: 1, unitPrice: 63.9, totalPrice: 63.9 },
      { name: 'ALB SUŠ.ČESNEK 30G', quantity: 1, unitPrice: 7.9, totalPrice: 7.9 },
      { name: 'EIDAM 30% BL. 2X100G', quantity: 1, unitPrice: 36.9, totalPrice: 36.9 },
      { name: 'ALB NITĚ NEUZENÉ100G', quantity: 1, unitPrice: 28.9, totalPrice: 28.9 },
      { name: 'BRAMBORY KONZ. RANÉ', quantity: 0.83, unitPrice: 24.9, totalPrice: 20.7 },
      { name: 'NEKTARINKY', quantity: 0.515, unitPrice: 54.9, totalPrice: 28.3 },
    ]);
    const sum = p.items.reduce((s, it) => s + it.totalPrice, 0);
    expect(Math.abs(sum - p.total)).toBeLessThan(0.01);
  });
});
