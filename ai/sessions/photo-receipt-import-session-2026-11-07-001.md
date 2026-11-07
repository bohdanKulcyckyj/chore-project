# Task: Load bought items from a photographed receipt
Date: 2026-11-07
Session: 001

## Objective
Muj Albert (the vendor app the user exports PDF receipts from) is down, leaving manual entry of
every line item. Make photographing a paper receipt a working import path.

## Subtasks
- [x] Shared OCR numerics (`ocr.ts`)
- [x] Extractor registry + single runtime seam
- [x] `ShopParser` → `ReceiptFormat`; split Albert into two formats
- [x] `albertPaper.ts` for photographed paper receipts
- [x] `generic.ts` last-resort scraper
- [x] `importReceipt.ts` facade
- [x] Modal: capture targets, multi-page, facade wiring
- [x] Fixtures, tests, browser verification

## What exploration found (and why scope shrank)
The photo path already existed: `extractText` dispatched images to tesseract, the file input
already accepted PNG/JPG, and `receipts/lidl/*.png` are real photos passing the pipeline gate.
Baseline before any change: **12/12 receipts green**. The gap was narrower than the story implied.

## Measured OCR, before writing any parser
| photo | pixels | confidence | result |
|---|---|---|---|
| photo-receipt.jpeg | 387x516 | 14 | unusable (`alběrt / Ska. / NJN HW HDP…`) |
| photo-receipt2.jpg | 1200x900 | 46 | unusable — prices mangled (`29:90"A`) |
| photo-receipt3.jpg | 3024x4032 | 49 | good item block |

Two decisions fell out of this data:
1. **No downscaling.** Only the full-resolution photo worked; reducing pixels is the wrong
   direction. The originally planned canvas downscale was dropped.
2. **Paper is a different layout, not a noisy PDF.** `NAME PRICE TAXLETTER` one-liners plus a kg
   line — Kaufland/Lidl shaped, comma decimals, no `Kč` on the total. Hence two Albert formats
   rather than one loosened regex.

Also tested tesseract page-segmentation modes: PSM 3/4 report higher confidence (78) but **drop
most item lines**. Default PSM kept.

## Key technical decision: recovering a destroyed price
OCR read `59,90` as `59, p-`, so items summed to 242.70 against a `Celkem` of 302.60. A receipt
carries its own checksum, so `withRemainder()` (in `ocr.ts`) turns the shortfall into ONE labelled
`Unrecognised item` row for the user to name, rather than silently under-reporting the purchase.
Two or more lost prices collapse into a single row — the arithmetic cannot separate them.

This is why `photo-receipt3.jpg` passes the strict sum gate: 5 parsed items + 1 remainder row.

## Architecture (user asked for loose coupling)
| Problem | Change |
|---|---|
| `extractText` if/else on `/\.pdf$/i` | Strategy + registry in `extractors/`, symmetric with `parsers[]` |
| `isNode` sniffing inline, two concerns | one `extractors/runtime.ts` seam |
| 590-line modal owned orchestration + toasts + mapping | `importReceipt()` facade returning an `ImportOutcome` union |
| `ShopParser` conflated shop with layout | renamed `ReceiptFormat`; `albertPdf` + `albertPaper` register independently |

Not applied on purpose: no classes, no DI container, no event bus, no preprocessing framework.
The only injection is `importReceipt(sources, selectFor = selectExtractor)` for testing.

`draftToRows`/`ItemRow`/`newRow` moved to `receiptRows.ts` — exporting them from the component
tripped `react-refresh/only-export-components`, and the rule was right.

## Verification
- `npm test`: 14 files, 117 tests. Pipeline **12 → 13 receipts**, no regressions.
- `npm run lint`: 0 errors (11 pre-existing warnings). `npm run build`: clean, `pdf` still a
  separate 409 kB chunk, so pdfjs/tesseract stayed lazy.
- Real browser (Playwright MCP, dev server): `importReceipt` on the photo → `parsed`, Albert,
  302.60, 6 items summing to 302.60, **4.0s**; on the PDF → `parsed`, 618.60, 12 items, **0.5s**.
  No pipeline console errors.
- 375px: capture targets stack full-width, 46px tall, no horizontal overflow.

## Known gaps
- `albertPaper` is tuned to ONE photo; expect follow-up fixes against real receipts.
- Multi-page import OCRs every page but archives only page 1 (`purchases.receipt_url` is a single
  text column). Marked `// ponytail:` with the upgrade path.
- Leading OCR junk occasionally survives in names (`AOR EMMA KOKOS STROU200G`). Stripping harder
  would eat real names; the form is the review step.
- App-level e2e (auth → budget → upload) was NOT run: port 54321 hosts a different project's
  Supabase with no `purchases` table, and the CLI is not on PATH.
