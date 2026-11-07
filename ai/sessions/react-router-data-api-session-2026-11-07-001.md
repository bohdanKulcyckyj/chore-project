# Task: Refactor to React Router data API
Date: 2026-11-07
Session: 001

## Objective
Replace the `activeTab` useState pseudo-router in `src/App.tsx` with a real
`createBrowserRouter` route tree using the React Router 7 data API (loaders,
`useLoaderData`, `errorElement`, revalidation).

## Why this isn't speculative
- `src/App.tsx` renders every page by `activeTab === '...'` — no URLs, no deep
  links, no back button, no shareable state.
- `e2e/pdf-receipt-upload.spec.ts:97` already does `page.goto('/budget')`,
  which today falls through `/*` and renders the dashboard. The e2e suite
  already assumes routes that do not exist.
- react-router-dom 7.8.1 is already installed. No new dependency.

## Scope (ladder-checked)
IN:
- `src/router.tsx`: `createBrowserRouter`, root layout route, `lazy()` child
  routes, `errorElement`.
- Layout route owns sidebar + mobile header (moved out of `AppContent`).
- Gates as route elements: unauthenticated -> `AuthForm`, no household ->
  `HouseholdManager`.
- Routes: `/dashboard` `/tasks` `/calendar` `/budget` `/household`
  `/approvals` (admin) `/leaderboard` `/settings` `/invite/:inviteCode`.
- `Sidebar` uses `NavLink` (drops `activeTab`/`onTabChange` props).
- `QuickActions` / `Dashboard` use `useNavigate` (drops `onNavigate` prop).
- Loaders for page-level reads, reusing the existing `src/lib/api/*` data
  layer — no new fetch code.
- Loader-side household/session resolution via one small helper so loaders
  (which run outside React) can read what the contexts know.

OUT (deliberate, flagged):
- Migrating mutations to `action` + `<Form>` / `useFetcher`. Every mutation
  today lives in a modal with optimistic UI and toasts; rewriting them is a
  second refactor with its own risk. Loaders + `revalidate()` give the
  freshness benefit at a fraction of the diff.
- Deleting `AuthProvider` / `HouseholdProvider`. They carry the Supabase
  `onAuthStateChange` subscription and the recurrence materialization. Routes
  and contexts coexist; collapsing them is not required for the data API.
- Framework mode / RSC. Not asked for, and a Vite SPA does not need it.

## Subtasks
- [x] 1. Router skeleton + layout route + nav (single writer: App.tsx,
      main.tsx, router.tsx, Sidebar.tsx, QuickActions.tsx, Dashboard.tsx)
- [x] 2. Loader-side session helper (`src/lib/api/session.ts`, `requireUser()`)
- [x] 3. Per-page loaders — parallel, one agent per page, each touching only
      its own page module: dashboard, tasks (+ action), budget,
      approvals (+ action). Calendar is DEFERRED: its query is keyed to
      FullCalendar's visible range (`datesSet`), not the URL, so a loader
      needs `?from=&to=` synced to the grid — a render-loop risk in a
      component already tuned for 375px. `useCalendarData` stays.
- [x] 4. Review pass (correctness + over-engineering)
- [x] 5. Verification: `npm run lint`, `npm run build`, `npm test`, then
      Playwright against the dev server (deep link each route, back/forward,
      console clean, 375px mobile check)

## Risks
- Route tree conflicts if agents write `router.tsx` concurrently -> routes use
  `lazy: () => import(...)` pulling `loader` from the page module, so loader
  agents never touch `router.tsx`.
- Loaders cannot read React context. Mitigated by the step-2 helper.
- `useHousehold` keeps current household in React state; loaders need it by
  id. Helper persists the selected id and falls back to first membership.
- Existing vitest suite is pure-logic (parsers, math) and should be unaffected;
  `src/__tests__/tasksApi.test.ts` is the one to watch.

## Decisions (user, 2026-11-07)
- Depth: **loaders only**. No `action`/`<Form>` migration; mutations stay in
  their modals and call `revalidate()`. Contexts kept.
- URL shape: **household id in the URL** -> `/h/:householdId/<page>`.
  This replaces subtask 2 (loader-side household helper): loaders read
  `params.householdId`. Loaders still need the user id, so one small
  `requireUser()` helper remains.
- No legacy flat-path redirects (`/budget` etc. never shipped; only the e2e
  spec assumed them) -> `e2e/pdf-receipt-upload.spec.ts:97` gets fixed instead.

## Amendment (2026-11-07, after scope Q&A)
Two mutations DO get route `action`s, because they are plain submits and the
fetcher version is the same size while being correct on the stale-data edge:
- `AddTaskModal` -> action on the `/h/:householdId/tasks` route, driven by
  `useFetcher` (not `<Form>`: the modal closes programmatically).
- `TaskApprovalInterface` approve/reject (+ notes) -> action on the
  `/h/:householdId/approvals` route, via `fetcher.submit` per row.
Everything else stays imperative + `revalidate()`:
- `useTaskCompletion` is a sequence (storage upload -> insert -> celebration ->
  optional purchase-editor chain), not a submit, and is rendered from BOTH
  /tasks and /calendar, so no single route owns it.
- Receipt import (OCR/pdfjs) runs in the browser before any write.
- Purchase editor / delete, household create/join/leave: imperative, return
  `{data,error}` consumed inline.

## Route tree
```
/                       -> loader: redirect to /h/<first household>/dashboard,
                           or /households if none, or /auth if no session
/auth                   -> AuthForm (loader: redirect / if already signed in)
/households             -> HouseholdManager (reads ?invite=)
/invite/:inviteCode     -> loader redirect: /auth?invite=X or /households?invite=X
/h/:householdId         -> layout: sidebar + mobile header
  dashboard  tasks  calendar  budget  household  approvals
  leaderboard  settings
```

## Implementation Notes

### Phase 1 — route skeleton (done)
New: `src/router.tsx`, `src/components/layout/HouseholdLayout.tsx`,
`src/lib/api/session.ts`. `src/App.tsx` went 206 -> ~40 lines (providers +
`RouterProvider` + `Toaster`); `AppContent` and `InviteHandler` deleted.
Sidebar uses `motion.create(NavLink)`; the `onNavigate`/`activeTab` prop chains
are gone.

Route-module contract (the reason loader agents never touched `router.tsx`):
a page module exports `default` (the component) plus optional `loader`/`action`,
and the `page()` helper in `router.tsx` forwards whichever exist.

Out-of-scope change that was necessary: `src/hooks/useAuth.tsx` re-wrapped
Supabase's `{ data, error }`, which collapsed the discriminated union so
`data.session` was unreadable. AuthForm needs it — with email confirmation on
(production), sign-up returns no session, and navigating to `/` would bounce
the user back to `/auth` and drop `?invite=`. Now returns the Supabase promise
directly, typed `AuthTokenResponsePassword` / `AuthResponse`.

### Phase 2 — loaders + the two actions (done)
| Page | What landed |
|---|---|
| Dashboard | loader (3 reads in one `Promise.all`); `loading` skeleton + `DashboardStats` deleted; `attachAssignees` stays a `useMemo` because `members` is context |
| Tasks | loader via new `fetchHouseholdTaskRows()` in `lib/api/tasks.ts` (additive); `action` owns create + edit; `AddTaskModal` drives it with `useFetcher`; `buildRecurrencePattern` shared so preview and stored rule cannot drift |
| Budget | loader via new `getPurchases()` in `lib/api/purchases.ts`; `usePurchases` hook DELETED (-49 lines); 3 mutation sites now `revalidate()` |
| Approvals | loader + action; admin re-checked server-side in BOTH; completion's household re-read from DB, points from the task row, compare-and-set on `approval_status='pending'`; `TaskApprovalInterface` -204 lines |
| Calendar | unchanged, as decided |

Orchestrator-owned fixes after the agents landed:
1. `page()` forwarded only `loader`, not `action` — fixed mid-flight, both
   action agents told.
2. `react-refresh/only-export-components` fires once per route module. Fixed at
   the root with `allowExportNames: ['loader', 'action']` in
   `eslint.config.js`, and the four local `eslint-disable` workarounds the
   agents had added were deleted.
3. `errorElement` was a fixed "Something went wrong". Loaders/actions refuse by
   throwing a `Response` (approvals throws 403), so it now reads
   `useRouteError()` and shows that message — otherwise a non-admin
   deep-linking to `/approvals` cannot tell a permission problem from a crash.
   This also replaced the `AdminGuard` fallback the approvals agent deleted as
   unreachable.

State after phase 2: `npx tsc -b` exit 0; `npm test` 15 files / 122 tests
passing; `npm run build` clean; `npm run lint` **9 warnings, 0 errors** (down
from the 11-warning baseline — two `exhaustive-deps` warnings went away with
the deleted `useEffect`s).

### Phase 3 — review + verification
Three agents in parallel: adversarial correctness review, real-browser
Playwright verification of every route, unit tests for the newly-extracted
logic. Four blockers between them; the browser agent found the one the code
review missed.

**Blockers found and fixed**

1. *Deep-linking a loader-less route silently bounced to `/dashboard`* (browser
   agent; measured over 4 full loads each: leaderboard/settings/household 0/4
   stayed, calendar 3/4, every loader-backed route 4/4). Root cause: at boot
   `user` is null while auth resolves, so `HouseholdProvider`'s else-branch set
   `loading = false` with `households === []`; the layout effect then saw a
   stale `false`, found no matching membership and ran `navigate('/')`. Routes
   with a loader escaped only because the initial loader round-trip gave the
   contexts time to settle — a race, not a design.
   Fix took two attempts. Attempt 1 guarded the `[user, authLoading]` effect
   with `if (authLoading) return;` — browser re-test said leaderboard/settings
   were STILL 0/6. The agent instrumented `window.fetch` and found a second
   writer: the `[householdId, userId]` effect, where a `setLoading(true)` added
   in that same round was skipped at mount (`householdId` undefined) while its
   `.finally(() => setLoading(false))` still fired. Attempt 2 returns from that
   effect before touching `loading` at all when there is no household, leaving
   `refreshData` as the only writer at boot.
   Confirmed: 72 deep loads over two independent rounds, 8 routes, 0 bounces
   (leaderboard and settings had been 0/6 in both earlier rounds), each route
   asserted to render real content rather than parking on a spinner.
2. *`/households` was a dead end.* The screen used to render only while
   `currentHousehold` was null, so setting the context WAS the navigation. As a
   route it has none, and `HouseholdManager` had no `useNavigate` at all — a
   new user who created a household was stuck there permanently.
   Fix: one `enter(id)` helper (switch context + navigate) behind create, join
   and card-click.
3. *`members` was `[]` on the first paint of every page.* `refreshData` ran
   `Promise.all([fetchHouseholds(), fetchMembers()])` and `fetchMembers`
   early-returned on a null `currentHousehold` closure. Pre-refactor the pages
   held their own skeleton until `members` arrived; loaders resolve first, so
   the bad paint became guaranteed: "Unknown" assignees, "Rank #1 of 0", and
   `isAdmin === false` showing an admin the member view before it swapped.
   Fix: `fetchMembers(id)` takes the id; `refreshData` awaits it after
   `fetchHouseholds()` (sequential on purpose). A switch holds `loading` until
   the new members land, which also closes the switch-desync finding.
4. *Approving another member's completion awarded nothing, silently.* The only
   write policy is `user_points FOR ALL USING (user_id = auth.uid())`, so the
   update matched 0 rows and returned no error — admin saw "approved!", balance
   never moved. **Pre-existing**: `git show HEAD` has the identical write. The
   refactor made it unretryable, because the new compare-and-set consumes
   `approval_status='pending'` first.
   Fix here: chain `.select('id')` and return a real error on 0 rows. The
   proper fix is a migration (admin RLS policy, or a SECURITY DEFINER rpc doing
   CAS + award in one transaction) and is NOT done — see Open items.

**Also deleted**: debug logging in `useHousehold` — it dumped the user object,
the session, and every household row the caller could read (invite codes
included) to the console on each join, behind a full-table query that served
nothing. See Open items for the part of that which is still unexplained.

**Should-fixes applied**: `requireUser()` loader on `/households` (it was the
only unguarded route); `authLoader` no longer drops `?invite=` for an
already-signed-in user; all approval buttons lock while any submit is in flight
(one shared fetcher was aborting and discarding a concurrent submit); sign-up
with email confirmation on now says "check your email" and flips to sign-in.

**Verified clean by the browser agent**: no one is ever thrown to `/auth` on
reload (session recovery works — `getSession()` awaits GoTrue's
`initializePromise`); add-task and edit through the route action close the modal
and refresh the list with exactly one toast; budget mutations stay consistent
across a reload; bogus uuid / bogus path / non-member household all degrade to
the error page or a valid household, never a white screen; all ten legitimate
routes log zero console errors; 375px drawer behaviour intact, scrollWidth 360.

### Phase 4 — tests (done)
`src/__tests__/tasksApi.test.ts`: 122 -> 134 tests, in the one file the project
keeps tests in.
- 6 tests for `fetchHouseholdTaskRows` (recurring picks its current occurrence,
  one-off keeps every row, never-assigned yields the `unassigned-<id>`
  placeholder, out-of-window recurring is omitted, undated sorts last, errors
  throw instead of returning []).
- 6 tests for `parseTaskForm`, the FormData trust boundary (now exported for
  exactly this). Multi-value `getAll`, NaN guards, every `validateForm` message
  verbatim from HEAD, the edit-mode early return, allow-list fallbacks.
- Both sets were mutation-tested: the source was broken N ways, each mutation
  turned exactly its own test red, then restored byte-identical.

Finding from those tests, fixed: an off-list `repeat` fell back to `''`, which
skipped the whole recurrence block — a stale client asking for a recurring task
silently got a one-off plus a success toast. Now refused with
`'Invalid repeat frequency'`; the test that pinned the old behaviour was
updated deliberately rather than deleted.

## Final state
`npx tsc -b` exit 0 · `npm test` 15 files / **134 tests** · `npm run build`
clean · `npm run lint` **8 warnings, 0 errors** (started at 11 warnings).
Browser: 92 cold loads in the last round alone, every route rendering real
content, zero console errors on all 11 legitimate routes, 375px behaviour
unchanged.

## Open items (not done, deliberately)
0. **Unexplained: the deleted debug query returned 19 households.** The
   `households` SELECT policy is scoped (`created_by = auth.uid() OR` own
   memberships, `20250816194008_fix_household_select_policy.sql`), so it should
   not have. Either the test account really was in that many households from
   earlier runs, or the policy does not do what it reads like — in which case
   invite codes are readable across households and anyone could join any
   household. The query is gone, so nothing depends on it; worth checking
   independently of this refactor.
1. **`user_points` admin write policy.** Needs a migration: an admin RLS policy
   on `user_points`, or a `SECURITY DEFINER` rpc doing the compare-and-set and
   the award in one transaction. Until then, approving another member's
   completion fails loudly instead of lying. Pre-existing bug, security-policy
   blast radius, not a routing concern.
2. **Three `element: <Loading />` on redirect-only routes.** The reviewer called
   them dead code; the phase-1 agent said it verified in-browser that React
   Router warns without them. Two agents disagree, the lines are harmless, so
   they stay until someone checks.
3. **Cross-household navigation.** `/households` is the only switcher and
   nothing in the app shell links to it — you have to type the URL. Equally
   true before the refactor, but more visible now the household is in the URL.
   A sidebar entry would be ~3 lines.
4. **Calendar on the data API.** Needs `?from=&to=` synced to FullCalendar's
   `datesSet`. Deferred on day one; still deferred.
5. **`isMobile` resize listener** in `HouseholdLayout` duplicates the `md:`
   Tailwind classes next to it. CSS-only would delete `isMobile`,
   `sidebarOpen` and the listener. Moved verbatim from `App.tsx`, so out of
   scope here.
