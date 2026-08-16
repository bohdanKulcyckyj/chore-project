# Task: Fix members unable to view receipts

Date: 2026-08-16
Session: 001

## Objective

Non-admin household members couldn't display receipts after uploading them; admin could view everyone's.

## Diagnosis

- Suspected Supabase storage RLS first. Checked `20260815000000_add_budget_tables.sql`: all four `storage.objects` policies for the `receipts` bucket use `is_household_member(...)` — identical for admin and member. Verified live policies in local DB matched.
- Reproduced the full backend flow via curl (two fresh users, one household): the **member** could upload to `receipts/` AND create a signed URL. Backend permissions are NOT the problem.
- Real cause: [Budget.tsx](../../src/components/budget/Budget.tsx) `openReceipt` called `window.open(url, '_blank')` **after** `await getReceiptSignedUrl(path)`. iOS Safari blocks `window.open` outside the synchronous user-gesture call stack. Admin tested on desktop (works); members use phones (silently blocked — `window.open` returns `null`, no error, no toast).

## Fix

Open the tab synchronously inside the click handler, then redirect it once the signed URL arrives:

```ts
const win = window.open('', '_blank');
const url = await getReceiptSignedUrl(path);
if (win) win.location.href = url;
else window.location.href = url; // popup blocked entirely -> same-tab fallback
```

On error: `win?.close()` + toast.

## Testing

- Playwright (local Supabase + Vite dev): logged in as a synthetic non-admin member, Budget page, clicked "View receipt" → new tab opened with the signed URL. Console errors present were unrelated (`user_points` 406 for the synthetic user).
- `getReceiptSignedUrl` has no other callers; no other `window.open` in src.
- All repro data (users, household, purchase, storage object) deleted afterwards.

## E2E test (added later this session)

- `e2e/receipt-view-member.spec.ts` (Playwright, existing `e2e/` convention — `src/__tests__/` is the vitest convention):
  - Seeds two users (admin + **member**) via GoTrue admin API, household + memberships via service-role client, then purchase + receipt upload **as the member client** (exercises member-facing RLS: purchases INSERT, storage INSERT, purchases UPDATE).
  - UI: member signs in → Budget → clicks "View receipt" → asserts popup opens, the signed `/storage/v1/object/sign/receipts/...` GET fires, and the URL serves the exact uploaded bytes.
  - Headless Chromium treats the PDF navigation as a download (aborts page load), so the test asserts on the network request, not the popup's final URL.
  - Negative check: neutering `openReceipt` makes the test fail (popup timeout). Limitation: Chromium's transient-activation window (~5 s) means the test can NOT reproduce the iOS-only async-`window.open` blocking itself; it guards the flow/RLS, the code comment guards the sync-open invariant.
  - Cleans up all seeded data in `afterAll`; verified DB has no leftovers.
- New migration `20260816000000_grant_service_role.sql`: local parity with hosted — grants `service_role` table access (previous grants migration only covered anon/authenticated; service-role PostgREST calls failed locally with `permission denied`).
- Run: `npx playwright test receipt-view-member --reporter=list` (needs `supabase start` + `npm run dev`).

## Notes

- Real-device iOS confirmation still worth doing by the user.
