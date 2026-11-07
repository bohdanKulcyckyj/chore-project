import { describe, expect, it } from "vitest";
import { albertPaperFormat } from "../lib/receipts/parsers/albertPaper";
import { albertPdfFormat } from "../lib/receipts/parsers/albertPdf";

// Tesseract (`ces`) output for receipts/albert/photo-receipt3.jpg, a
// photo of a paper Albert receipt. Captured once so this test never re-runs
// OCR; pipeline.test.ts covers the real image end to end.
const fixture = `| T) jo o NY: i > s pe a
ae () | | km
HEHE 1801] E l
„a | | | | | = Pojákný
X | K E
B b
h. p bí [] T o
Sumo
13) | | Báze o
[2
ji s : ea oč
a C 6, -1 c
| A z albe rt ee. o
m ký ma: Nádražní 2855/147 : ey 0
oe 702 00 Ostrava č o
| ALBERT TP SVR BR 69,90 B a —
nEL 85% CoC.SO. 1006 59, p- a
ko 8 o DR. O. HOLAN.KAKAO100G 54,90 A K 1 5 ků.
ko O AOR EMMA KOKOS STROU200G 31,90 A ]
Eko c-oe  EMMA DATL BEZ P.200G 34,90 A AA]
OooBobnBA 0) PREMIUM VEPŘ.ŠUN.NJ vd E :
0,214 kg x 289,00 Kč/kg 51,10 A |
| Celkem 302,60 r-
os VA tok čo (20. I č
Ň | 9 a | Torminál: (PVTC0000-00000000) >] je]
NEPA PRODEJ 302,60 Kč yn
1 E xxx xxx xxxx 0000 Z 00 (L) MASTERCARD -A |
Fekae AO 00 00 00 04 10 10 DEBIT MASTERCARD |
:| F SEG ID: 000:000:000, Autoriz. kód 000000 o ý |
| G Pp o pin. NO REFUND: nooo“ K)
i Ned C | s |
| je Z Platební karty Kč 302,60 m 26 f
P PRO MEA R O: o o o S ei A o ení | o a
MA) 12% DPH 2 207,77 24,93 n Ja Ů Mi
B 21% DPH z 57,77 12,13 0D0 my,
7 Rai: :
m- Datum KaK Obch Pokl Obsl Aoooý l ee) 1] [7
HH innn „oje U 2 | =
Jáop HnRnn Mn 17.10.26 1 0382 37 1017 k 7 T
SEE HE TEL: | Děkujeme za váš nákup o n
i l 1 Stáhněte si aplikaci Můj Albert -u =
1 A2 | a ušetřete Vždy nejvíc. p | o
Í 1] -4 oo
i Í a
dddoddA0AnA A [5] + [s] 000 ©
| dlji) | a k) r
o) = [s] „ k] | BS
KA | | i čncm | L]
: získáváte 1 bod. Ao
| | | Z i Timto nákupem m
Pee | 7 : Sbírejte body na kolekci Perla ——- -O
M -—"2M ten“ Ť
0) A U  Mtknctné
| 660000382gg0370000229920261017i81323 jiš mm. I |
iy RE
KA dh | Pop W LI11]1111111] A 2Mh c.. A
v AVT V or | | Keep vo teda dd. SAY AK I
`;

describe("albertPaperFormat", () => {
  it("detects a photographed paper receipt", () => {
    expect(albertPaperFormat.detect(fixture)).toBe(true);
  });

  it("does not collide with the PDF export format", () => {
    // the two Albert formats must stay mutually exclusive, since registry
    // order would otherwise silently decide which one parses a receipt
    expect(albertPdfFormat.detect(fixture)).toBe(false);
  });

  it("does not detect other shops", () => {
    expect(albertPaperFormat.detect("Kaufland\nSoucet 123,00")).toBe(false);
    expect(albertPaperFormat.detect("Lidl\nK PLATBE 99,00")).toBe(false);
  });

  it("parses the receipt", () => {
    const p = albertPaperFormat.parse(fixture);
    expect(p.shop).toBe("Albert");
    expect(p.total).toBe(302.6);
    expect(p.purchasedAt).toEqual(new Date(2026, 9, 17, 12, 0));
    expect(p.items).toEqual([
      { name: "ALBERT TP SVR BR", quantity: 1, totalPrice: 69.9 },
      { name: "DR. O. HOLAN.KAKAO100G", quantity: 1, totalPrice: 54.9 },
      { name: "AOR EMMA KOKOS STROU200G", quantity: 1, totalPrice: 31.9 },
      { name: "EMMA DATL BEZ P.200G", quantity: 1, totalPrice: 34.9 },
      { name: "PREMIUM VEPŘ.ŠUN.NJ", quantity: 0.214, unitPrice: 289, totalPrice: 51.1 },
      // OCR destroyed `59,90` on the `85% CoC.SO.` line; recovered from Celkem
      { name: "Unrecognised item", quantity: 1, totalPrice: 59.9 },
    ]);
    const sum = p.items.reduce((s, i) => s + i.totalPrice, 0);
    expect(Math.abs(sum - p.total)).toBeLessThan(0.01);
  });
});
