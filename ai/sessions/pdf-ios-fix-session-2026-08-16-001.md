# Task: Fix PDF receipt parsing on iPhone (Chrome/iOS)
Date: 2026-08-16
Session: 001

## Objective
Receipt PDF upload works on desktop but fails on iPhone Chrome with:
- `PDF extraction failed: No "GlobalWorkerOptions.workerSrc" specified`
- `PDF extraction failed: undefined is not a function (near '...i of t...')`

## Root cause
1. **pdfjs-dist@6.2.108 requires modern WebKit even in its legacy build** —
   uses `Promise.withResolvers` (iOS 17.4+) and `Iterator.prototype` helpers
   (iOS 18.4+) plus non-transpilable syntax. Chrome on iOS uses the system
   WebKit, so older iOS crashes with Safari's `for...of`-over-undefined error.
   Verified: v4.10.38 legacy build bundles core-js polyfills (incl.
   `withResolvers`); supports Safari/iOS 15.4+.
2. **Broken worker URL** — `new URL("pdfjs-dist/legacy/build/pdf.worker.mjs",
   import.meta.url)` uses a bare specifier Vite doesn't rewrite → 404 →
   the original `workerSrc` error. Canonical Vite fix: `?url` asset import.

Prior attempts (es2015 build target, terser safari10, spread→apply) couldn't
work: the worker file is fetched by URL at runtime and never transpiled, and
the missing APIs aren't a syntax issue.

## Subtasks
- [x] Downgrade pdfjs-dist 6.2.108 → 4.10.38, remove terser
- [x] Rewire worker via `?url` import in extractText.ts, drop debug logs
- [x] Restore vite.config.ts (drop es2015/terser)
- [x] vitest run (all receipt parser tests) — 30/30 pass
- [x] npm run build + verify polyfill present in shipped worker asset
- [x] Playwright verification of upload flow — Kaufland receipt, 11 items, 680.55
- [ ] User confirms on actual iPhone

## Implementation notes
- `isNode` detection changed from `typeof window` to `process.versions.node`:
  vitest's happy-dom env has a window but no real Worker, so it must take
  pdfjs's Node fake-worker path like the plain-node tests do.
- Added `test.exclude: ["e2e/**"]` to vite config — vitest was trying to run
  the Playwright spec (pre-existing failure, unrelated to PDF).
- Static iOS proof on dist artifacts: `withResolvers: function` polyfill
  present in both pdf chunk and worker asset; zero `Iterator.prototype`
  references (v6 had 14); worker emitted as hashed asset
  `pdf.worker.min-*.mjs` and its URL baked into the main bundle.
- Cannot emulate old-iOS WebKit locally; final confirmation = user's phone.
