import { describe, expect, it } from "vitest";
import { albertPaperFormat } from "../lib/receipts/parsers/albertPaper";
import { albertPdfFormat } from "../lib/receipts/parsers/albertPdf";
import { ikeaParser } from "../lib/receipts/parsers/ikea";
import { kauflandParser } from "../lib/receipts/parsers/kaufland";
import { lidlParser } from "../lib/receipts/parsers/lidl";
import { pennyFormat } from "../lib/receipts/parsers/penny";

// Tesseract (`ces`) output for receipts/penny/IMG_4560.jpg, a photo of a paper
// Penny receipt shot at an angle (OCR confidence 46). Captured once so this
// test never re-runs OCR. Personal data past the total is scrubbed: terminal
// id, transaction id, Auth Code and the PENNY KARTA number are zeroed.
const fixture = `a : mt% ký
LT]
A A b/0W
n *
00 UD PENNY. K L
PENNY MARKET 5.R.0. Ď — —
: r POČERNICKÁ 257, 25073 RADONICE ) A
(HHHHHHHHHHHHHH 727 OSTRAVA SOKOLSKÁ o o
[C0: 64945860
u U Dblě: CZ64945680 1
m : MĚST,S0UD PRAHA C/42812 AA
MaR- Datum: 07.10.2026 Čas: 20:06:17 M
s Kč o A | — TE t4
| 1 Aň PAS +. v VA / be p m mn r
| UVU Ko A | | „90 KC /K o A | | | f
| Í í jkurka salátová t 11,90 i 0 LL] | |
| m [M 1.000 ks x 47.90 Kč /ks | vo | | | l
| Arambory 2kg konzumní ; U A790 A KD A AL né
| [A | 1 .000ks. x 2x: KČ- /ZKS CSM :
| | Radegast Rázná 10 0,51 j 0 23,90 K“
| 1.000 ks x 33.90 Kč /ks ; Ů
| | čočka červená 5009 |*$*$%$0b 33.90 | |
| | ČOČKA ČERV .POL.LOUP, 5006 áeA p—-o—7 L |
SE [L] (Přaňk Xoarvoná BDD 24,90) n- | |
(GOČKa Červená oVVyj ť s. M | i
| 2.000 ks x | 14.90 Kč /ka o? Pon, n
A [o tyčinka Twix 509g C 29,80 M 1 |
| | 2.000 ks x 14.90 Kč /kš K | | -P
| : j Milko jog.bílý řecký 14 MUŽ 29.00 Ý T - L
| 1.000 ks x 19.90 Kč /Ko T ě WW M | PLL LTL
7 A luce nO ALKÉ 100g- Ř Aš 19.90 K HELLA
V- 1.000 ks x | 20,90 Kč /KS 0) © r 2 mo nA
: | Křen jabl. 1750 Avokádů | L 20,90 tn“ Zd -—
| M 1.000 ks x 54.90 Kč /ko de (dava emnee po -TÍ
- ; HHHHHHHHHHHHH dvoc.směs 4509 Mraz čerš. G : skicy | | |
s ; st dh nec 00 : : - FT:FTT4
c Doron e Ikem Kč : éb9:2í — . A | | | ]
— sseeononyí oo" k 0 065.00 Se) MHZ Sm
o0o0000 () B) PŘIJATO | plateb.karla 265.90 99YYPYY PD | B
oocoo0o Penny aldeen1)/031 ké ké k ti [A z
: Sokolská 3210/93 koddod l
= =] Ea Moravská Ostrava č č oALASKO ip ——
: o „020260 : oops | —
: Í 802095 / 349 / L. A ———
C in CARDHOLDER COPY of- "PTL
í —— Clerk X; Dashier000013 ro] | i: i- em
: [Dní ferminal: 000000 d JÁ O o v S
| z (000000000,/000000) i coOO0600 —
) T Dontact less =] i HO-
: | Card: Mastercard z S
) c | (| KXXXX XXXA SLO A0 A T n 00
| ATD; A0000000041010 E 5
p = ě DEBIT MASTERCARD K 2 9 Č—0—
Š : Sale ěbĚ M KE: R
o | kolo WK Abočlí Í
o | <A L Auth Code: 000000 -
l s n Please retain for your oco m
á i records : m o
; j II 4 Iharik: vou : MA : | :
2 | esem = o: 128 DPH z 214.29 = 25.71 PTY m u =
zk Ď ;.2]4 DPH z 21.40 = 450 SN)
| DEKUJEME ZA VÁŠ NÁKUP! sumu ae
| | WWW, PENNY CZ —
: | Llllá Jka; PDU Z POKLADNA Z ČC. (OKI 1646 PoP l" 77T
UL | : : Pos 1/1 Jméno pok.: pokladní: 13 ká Pp E
AV 9ř) NI97-2026 1007-02 1kG4F 4“ /l9 Pb m, “-.
m pV»Ď) 0727-2026]1007+02- 1646 Po | m
mm bom! PENNY KARTA: 00000000 PE ais r. :
| é 7- R. sE A = I | 2 :
A . ny u z>kt++k+k+kk A +444 kf k+ + kdtek4x4d k) bika o—— LH | | o-
A mame 18: 110) ; aa [7 S PENNY KARTOU jste dnes ušepeý sRNÝ RO š
=) A 9.00 Kč! i Nem
= Z A ked kk kt kt tokio NA O o O C
emu p r Nyní 1+1 plyšák za 99,90kz "+ N | či -
Více na pehhy.cz 3
| o-
4 LÉ I) (žl jydal O1: 7 námel | ———
© : | dei —)-
l TA E | R ton bozi 1) SA —Z)“
j H hn : | | | | : | m bh 4 R NĚŽNÍ
`;

describe("pennyFormat", () => {
  it("detects a photographed Penny receipt", () => {
    expect(pennyFormat.detect(fixture)).toBe(true);
  });

  it("does not collide with the other shop formats", () => {
    // registry order would otherwise silently decide which parser runs
    for (const other of [albertPaperFormat, albertPdfFormat, ikeaParser, kauflandParser, lidlParser])
      expect(other.detect(fixture)).toBe(false);
  });

  it("does not detect other shops", () => {
    expect(pennyFormat.detect("Kaufland\nSoucet 123,00")).toBe(false);
    expect(pennyFormat.detect("Lidl\nK PLATBE 99,00")).toBe(false);
    expect(pennyFormat.detect("Albert Česká republika\nCelkem 302,60")).toBe(false);
  });

  it("parses the receipt", () => {
    const p = pennyFormat.parse(fixture);
    expect(p.shop).toBe("Penny");
    // `Celkem Kč 265,90` is destroyed twice over (`Ikem Kč : éb9:2í`, `065.00`);
    // the only readable copy is on the `PŘIJATO | plateb.karla 265.90` line
    expect(p.total).toBe(265.9);
    expect(p.purchasedAt).toEqual(new Date(2026, 9, 7, 20, 6, 17));
    // Names carry the OCR's own damage (`jkurka` for `Okurka`, `5009` for
    // `500g`) — the review form is where the user fixes them. Prices are what
    // must be right, and the qty line above each item repairs three of them:
    // `A790` (Brambory), `29.00` (Milko) and a missing price (Ovoc.směs).
    expect(p.items).toEqual([
      { name: "jkurka salátová", quantity: 1, totalPrice: 11.9 },
      { name: "Arambory 2kg konzumní", quantity: 1, unitPrice: 47.9, totalPrice: 47.9 },
      { name: "Radegast Rázná 10 0,51", quantity: 1, totalPrice: 23.9 },
      // 33,90 printed above, 24,90 restated in parentheses after the discount:
      // the parenthesised net wins, so the lost `-9,00` line is not needed
      { name: "čočka červená 5009", quantity: 1, unitPrice: 24.9, totalPrice: 24.9 },
      { name: "tyčinka Twix 509g", quantity: 2, unitPrice: 14.9, totalPrice: 29.8 },
      { name: "Milko jog.bílý řecký 14", quantity: 2, unitPrice: 14.9, totalPrice: 29.8 },
      { name: "luce nO", quantity: 1, unitPrice: 19.9, totalPrice: 19.9 },
      { name: "Křen jabl. 1750 Avokádů", quantity: 1, unitPrice: 20.9, totalPrice: 20.9 },
      { name: "dvoc.směs 4509 Mraz čerš.", quantity: 1, unitPrice: 54.9, totalPrice: 54.9 },
    ]);
  });

  it("is short by exactly the one unrecoverable price", () => {
    // Two values on this photo cannot be recovered by any amount of parsing:
    //   * Radegast's 25,90 OCR'd as `23,90` and its qty line is garbled
    //     (`1 .000ks. x 2x: KČ- /ZKS`), so there is no second reading of it;
    //   * the `-9,00` discount line is absent from the OCR entirely — harmless,
    //     because the parenthesised 24,90 net price covers it.
    // Hence a 2,00 shortfall, asserted rather than papered over: see the
    // ponytail note in penny.ts on why withRemainder is deliberately not used.
    const p = pennyFormat.parse(fixture);
    const sum = p.items.reduce((s, i) => s + i.totalPrice, 0);
    expect(Math.round(sum * 100) / 100).toBe(263.9);
    expect(Math.round((sum - p.total) * 100) / 100).toBe(-2);
  });
});
