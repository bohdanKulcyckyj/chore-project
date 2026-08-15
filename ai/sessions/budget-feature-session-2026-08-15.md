# Task: Budget Feature (Grocery Spending Tracking & Bill Splitting)
Date: 2026-08-15
Session: 001
Status: Phases 0 and 1 implemented — both awaiting manual verification (see test-plan.md).

## Objective

Track household purchases (mainly groceries), assign each item to a member or
"shared", visualize spending (week / month / past months), compute who-owes-whom
with settle-up, import receipts from per-shop PDF parsers, and optionally attach
a receipt when completing a Shopping task.

## Decisions (agreed with user)

| Decision | Choice |
|---|---|
| PDF parsing | Deterministic per-shop parsers (pdfjs-dist text extraction + regex per shop). No LLM. |
| PNG receipts (Lidl) | tesseract.js client-side OCR (`ces` traineddata), lazy-loaded on image drop. Verified on real receipt — see Phase 4 notes. |
| Settlement | Yes — track `paid_by`, show running balance, settle-up button |
| Shared split | Even split among all household members only (50/50 for 2). No custom percentages. |
| Currency | CZK, display-only formatting (`Intl.NumberFormat('cs-CZ')`), no currency column |
| Qty edge cases | Handled by **splitting item rows**, not an allocation table (2 beers → two rows of 1) |
| Charts | CSS/Tailwind bars, no chart library |

## What already exists (reuse)

- `task_categories` already seeds a **"Shopping"** category → "task with tag shopping" = existing `tasks.category_id`, zero new tagging infra
- Task CRUD + `CompleteTaskModal` — the hook point for "attach receipt on completion"
- Storage bucket pattern (`task-completion-photos` migration) → copy for `receipts` bucket (but **private** + signed URLs, receipts are financial data)
- RLS helper `is_household_member(uuid)` → reuse in all new policies
- shadcn ui primitives (dialog, input, select, table, button), date-fns, framer-motion patterns
- Tab navigation: add `budget` tab in `Sidebar.tsx` + branch in `App.tsx`

## Data model (1 migration, 2 tables + 1 bucket)

```sql
-- one receipt / shopping trip
purchases (
  id uuid PK,
  household_id uuid NOT NULL → households ON DELETE CASCADE,
  shop_name text NOT NULL DEFAULT '',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid NOT NULL → users,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,   -- receipt total; UI warns if ≠ items sum
  receipt_url text,                                 -- storage path of PDF, nullable
  task_completion_id uuid → task_completions ON DELETE SET NULL,
  settled_at timestamptz,                           -- NULL = counts toward open balance
  created_by uuid → users,
  created_at timestamptz DEFAULT now()
)

purchase_items (
  id uuid PK,
  purchase_id uuid NOT NULL → purchases ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric(9,3) NOT NULL DEFAULT 1,         -- fractional for kg items
  unit_price numeric(10,2),                         -- nullable, not on all receipts
  total_price numeric(10,2) NOT NULL,               -- negative allowed (discounts, bottle returns)
  owner_id uuid → users                             -- NULL = shared (even split)
)
```

Indexes: `purchases(household_id, purchased_at DESC)`, `purchase_items(purchase_id)`.

RLS (mirror existing patterns):
- `purchases`: SELECT/INSERT/UPDATE for household members via `is_household_member(household_id)`; INSERT also `created_by = auth.uid()`; DELETE creator or admin. UPDATE open to all members deliberately — settle-up touches both parties' purchases.
- `purchase_items`: all ops via `EXISTS (purchases p WHERE p.id = purchase_id AND is_household_member(p.household_id))`.
- Storage: `receipts` bucket, `public = false`, authenticated insert/select, path `householdId/purchaseId.pdf`, viewed via `createSignedUrl`.

## Core math (client-side, data volume is tiny)

Definitions:
- **My spending** (consumption, independent of who paid) = Σ items I own + Σ shared items / N
- **Shared spending** = Σ shared items
- **Balance** — for each purchase with `settled_at IS NULL`, payer P:
  - item owned by O ≠ P → O owes P `total_price`
  - shared item → each member M ≠ P owes P `total_price / N`
  - net pairwise; for 2 members it's a single "X owes Y n Kč" number
- **Settle-up** = set `settled_at = now()` on all unsettled purchases; history stays for stats.

Rounding: store exact numerics, round halves only at display. `N` = current member count (acceptable ceiling; irrelevant for 2 brothers).

## Edge cases covered (splitting)

1. Qty 2, one each → "Split row" button duplicates the row (qty/price halved, editable), each row gets its own owner
2. Fractional/uneven (1.4 kg apples, 1 kg shared + 0.4 mine) → split row, edit qty + price per row
3. Whole receipt for one person → "Assign all to…" bulk action in editor
4. Discount / deposit-return lines → negative-price rows, owner assigned like any row
5. Item bought entirely for the *other* user → owner = them → they owe full price
6. Purchase entered after settle-up with an older date → still unsettled, appears in balance (correct)
7. Both paid parts of one trip → out of scope; enter as two purchases (note in UI copy not needed)
8. Odd haléře on 50/50 → display rounding only

## Phases (each shippable alone)

### Phase 0 — Receipt-parsing POC (implemented 2026-08-15, NOT yet verified manually)

Standalone lib code + tests, zero app integration. Goal: all 9 real receipts in
`receipts/` parse correctly, and every piece is runnable/verifiable via `npm run test`.

- [x] deps: `pdfjs-dist`, `tesseract.js`; dev dep: `vitest` + `"test": "vitest run"` script
- [x] `src/lib/receipts/types.ts` — `DraftPurchase { shop, purchasedAt, total, items }`, `DraftItem { name, quantity, unitPrice?, totalPrice }`
- [x] `src/lib/receipts/extractText.ts` — file/buffer → text lines: PDF via pdfjs-dist text layer, PNG/JPG via tesseract.js (`ces`). Node path verified by tests; **browser worker path deferred to Phase 4** (code branches on `typeof window`, nothing imports it from the app yet)
- [x] `src/lib/receipts/parsers/{albert,kaufland,lidl}.ts` + `index.ts` registry with `detect(text)` per shop
- [x] Resolve during POC (with fixtures as evidence): discount lines (fold into final item price vs. negative rows), Lidl OCR price artifact (`68,709 B`), `kg` vs `ks` quantity lines, deposit/bottle-return lines, multi-line item names — see Phase 0 notes
- [x] Tests — **everything testable, two layers**:
  - per-shop `src/__tests__/<shop>.test.ts` (instead of one `parsers.test.ts` — built in parallel) — committed **sanitized** text fixtures (personal data scrubbed) per shop → exact expected item arrays
  - `src/__tests__/pipeline.local.test.ts` — full file→extract→parse run over ALL 9 real receipts, `describe.skipIf` when `receipts/` absent (folder is gitignored, so this layer runs locally only)
- [x] **Pass gate, per receipt: shop detected, date parsed, every item has name + price, and |Σ item totals − receipt total| < 0.01 Kč. Required: 9/9.** → **9/9 PASS**, sum delta 0.0000 on every receipt
- [ ] Manual verification passed (test-plan.md) → then mark phase complete

### Phase 1 — Migration + manual entry + purchase list (implemented 2026-08-15, NOT yet verified manually)
- [x] Migration: tables, indexes, RLS, `receipts` bucket — `supabase/migrations/20260815000000_add_budget_tables.sql`
- [x] `src/types/database.ts`: add `purchases`, `purchase_items`
- [x] `src/components/budget/Budget.tsx` — page: purchases list (grouped by date, shop, total, payer, owners breakdown), Add button
- [x] `src/components/budget/PurchaseEditorModal.tsx` — shop, date, paid-by (default me); item rows: name / qty / price / owner (Me | \<member\> | Shared segmented control); split-row; add-row; bulk "assign all"; items-sum vs total warning; optional PDF attach (upload only, no parsing yet)
- [x] `src/components/budget/hooks/usePurchases.tsx` — fetch + refetch on mutation (no realtime; add if simultaneous editing ever hurts)
- [x] `src/lib/api/purchases.ts` — create/update/delete, PDF upload, settle-up (follows `lib/api/tasks.ts` pattern)
- [x] Sidebar + App.tsx: `budget` tab (Wallet icon, `text-teal-500`)
- [ ] Manual verification passed (test-plan.md) → then mark phase complete

### Phase 2 — Overviews + balance + settle-up
- [ ] Balance card: "Brother owes you X Kč" + Settle up (confirm dialog)
- [ ] This week / this month cards: total, mine, shared (my half)
- [ ] Past ~6 months comparison — Tailwind stacked bars
- [ ] All aggregation client-side with date-fns

### Phase 3 — Shopping task integration
- [ ] `CompleteTaskModal.tsx`: when task category = Shopping, optional "Add receipt from this trip" → opens `PurchaseEditorModal`, saves purchase with `task_completion_id`
- [ ] Purchase list shows a badge/link when tied to a task completion

### Phase 4 — Receipt import UI (wires Phase 0 lib into the editor)
- [ ] Editor: drop zone accepting `.pdf/.png/.jpg` → extract → parse → prefilled rows for review (parser mistakes are editable, never fatal)
- [ ] Lazy-load pdfjs-dist / tesseract.js only when a file is dropped (tesseract downloads ~15 MB WASM + `ces` traineddata on first use, browser-cached after)
- [ ] Unknown shop (`detect` misses) → toast, fall back to manual entry
- [ ] Upload original file to `receipts` bucket on save

**Verified against real examples (2026-08-15, basis for Phase 0):**
- Albert + Kaufland PDFs have clean text layers (`pdftotext` confirmed) — no OCR needed
- Lidl PNG through tesseract.js `ces`: names/diacritics near-perfect, qty lines (`3 ks x 22,90 Kč/ks`, `N 1,010 kg x 29,990 Kč/kg`), discounts (`SLEVA 20% -13,74` + `Cena po slevě`), and `K PLATBĚ` total all extract cleanly
- Known OCR artifact: stray digit glued to price before tax letter (`68,709 B` = `68,70 B`) → Lidl parser normalizes via `(\d+,\d{2})\d*\s+[A-C]` (keep 2 decimals, drop rest); items-sum vs `K PLATBĚ` check flags residual misreads
- Parser anchors: Albert `<qty> x <unit> Kč` under item name; Kaufland `<qty> * <unit>` under item name, total at `Součet`; Lidl per above

## Complexity / risk

- **Phase 0 first** — de-risks the whole feature; if a shop can't hit the 9/9 pass gate we find out before writing any DB/UI code. **Phase 1 is the bulk** (editor UI). Phases 2–4 are small.
- RLS recursion burned this repo 3 times before → stick to `is_household_member()`, verify with two accounts.
- Parsers brittle by nature → review step is the safety net; fixture test per shop catches format drift only when re-run against a fresh receipt (accepted ceiling of deterministic parsing).
- Skipped: custom split percentages, multi-payer trips, currency setting, realtime sync, chart lib — add only when a real need shows up.

## Open items
- ~~Which shops?~~ → Albert (PDF), Kaufland (PDF), Lidl (PNG) — examples in `receipts/`
- `receipts/` is untracked and contains real data (card fragments, loyalty info, addresses) → add to `.gitignore`; commit only anonymized extracted-text fixtures for parser tests

## Implementation Notes

### Phase 0 (2026-08-15, session 001)

Implemented after Phase 1 (user request). Each shop parser built by a separate
parallel subagent against real extracted text dumps.

**Files:**
- `src/lib/receipts/types.ts`, `src/lib/receipts/extractText.ts`
- `src/lib/receipts/parsers/{albert,kaufland,lidl}.ts` + `index.ts` (`detectParser`)
- Tests: `src/__tests__/` — `{albert,kaufland,lidl}.test.ts` (sanitized fixtures), `pipeline.local.test.ts` (real files, local-only)
- `package.json`: `pdfjs-dist`, `tesseract.js`, `vitest`, `"test": "vitest run"`; `.gitignore`: `*.traineddata` (tesseract Node cache lands in repo root)

**Decisions / findings:**
- pdfjs line reconstruction: group text items by y (2pt tolerance), sort by x, join without a space when glyphs touch — pdfjs splits Czech words at diacritics (`P|ř|epravka`); naive joining produced `P ř epravka`
- Node vs browser split in `extractText.ts`: Node imports `pdfjs-dist/legacy/build/pdf.mjs` (fake worker, zero setup); browser branch lazily imports `pdfjs-dist` + `pdf.worker.min.mjs?url` — the `?url` path is only exercised in Phase 4
- Discount lines (Lidl `SLEVA … -13,74` + `Cena po slevě`): **folded** into the previous item's totalPrice (not negative rows) — keeps sum == `K PLATBĚ`. Kaufland deposit/bottle returns stay as **negative rows** (they're real receipt lines with tax codes)
- Lidl OCR artifacts went beyond the known glued-digit-in-decimals case: stray digit in the *integer* part (`709,84` = 70,84) and glued digits on unit prices. One deterministic fix: qty lines reconcile the previous item by trying single-digit-deletion candidates of unit/total until `qty × unit ≈ total` (±0.015); if nothing reconciles, keep item-line total, drop unitPrice
- Kaufland one-liner items: `quantity: 1`, `unitPrice` undefined
- Shop detection anchors: Albert `Albert Česká republika` (footer), Kaufland/Lidl their names; cross-checked negative on the other shops' texts

**Programmatic verification (all pass):**
- `npm test` — 18/18: 9 sanitized-fixture assertions + 9/9 real receipts through full pipeline (Lidl via actual tesseract.js OCR); date parsed, all items named+priced, sum delta 0.0000 everywhere
- `npx tsc --noEmit` clean for `src/lib/receipts/`; `npx eslint src/lib/receipts/` clean; `npm run build` ✓
- Committed fixtures grep-checked free of phone/card/loyalty/auth/account values
- Not testable programmatically: parsed names/prices vs. the paper receipts (ground truth only human has) → test-plan.md; browser worker path → Phase 4

### Phase 1 (2026-08-15, session 001)

Implemented out of order (before Phase 0) on user request — Phase 1 has no
dependency on the parsing POC (PDF attach is upload-only).

**Files:**
- `supabase/migrations/20260815000000_add_budget_tables.sql` — tables, indexes, RLS, private `receipts` bucket + 4 storage policies
- `src/types/database.ts` — `purchases`, `purchase_items` types
- `src/lib/api/purchases.ts` — create/update/delete, receipt upload + signed URL, settle-up, `formatCzk`
- `src/components/budget/hooks/usePurchases.tsx`, `src/components/budget/Budget.tsx`, `src/components/budget/PurchaseEditorModal.tsx`
- `src/components/layout/Sidebar.tsx`, `src/App.tsx` — `budget` tab (Wallet, teal)

**Decisions / findings:**
- `is_household_member()` had been **dropped** by `20250914150616_remote_schema.sql` — the plan's "reuse it" assumption was stale. Recreated the original SECURITY DEFINER helper in the budget migration (recursion risk gone anyway: `household_members` SELECT is now `USING (true)`).
- Item update = delete + reinsert rows (tiny data volume, no diffing).
- Split-row keeps the sum exact: first half rounded to 2 decimals, second half gets the remainder.
- Receipt total input left blank → `total_amount` auto-filled from items sum (no warning possible in that case, by design).
- Price/qty inputs accept comma decimals (`parseFloat(v.replace(',', '.'))`).
- Receipt upload failure after purchase save is non-fatal (toast, purchase kept) — mirrors photo-upload behavior in `lib/api/tasks.ts`.
- Removed pre-existing unused `UserPlus` import in Sidebar (touched that import block anyway).

**Programmatic verification (all pass):**
- `npm run build` ✓; `npx eslint` clean on all new/changed files (repo has 60+ pre-existing errors elsewhere)
- `npx supabase migration up` applied cleanly on local stack
- psql checks: both tables RLS-enabled, 5 table policies, `receipts` bucket `public=false`, 4 storage policies, helper fn + both indexes exist
- SQL RLS smoke test (`SET LOCAL role authenticated` + JWT claims, real local users): member A insert purchase+items ✓; member B same household sees it and can settle-up ✓; B (non-creator, non-admin) delete blocked (DELETE 0) ✓; outsider sees 0 rows and insert blocked ✓; creator delete ✓ with item cascade ✓
- Not testable programmatically: browser UI flows + storage signed-URL path → `test-plan.md`
