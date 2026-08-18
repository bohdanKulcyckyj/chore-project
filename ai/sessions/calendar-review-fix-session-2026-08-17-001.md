# Task: Multi-angle review of bk-calendar-feature-followup + fix all findings
Date: 2026-08-17
Session: 001
Branch: bk-calendar-feature-followup (10 commits vs main)

## Review (6 parallel reviewers + gates)
Gates: eslint 0 err/13 warn, vitest 46/46, vite build OK.
⚠️ `tsc -p .` is vacuous (root tsconfig `files: []`). `tsc -p tsconfig.app.json`: main 53 errors → branch 18 (35 fixed, 1 new: AddTaskModal:469).

Lenses → key findings:
- **Recurrence engine**: MAJOR departed rotation member → one row fails RLS → whole per-task upsert fails forever, silent. MINOR: DST tests vacuous under TZ=UTC (mutation-verified); MONTHLY 29–31 skips short months; failures console-only; 8× materialize POSTs/load (effect keyed on object identity).
- **DB/RLS/API** (probed live in rolled-back txn): no blockers. MAJOR: double completion client-guarded only (2 tabs → 2× points); member INSERT policy lets members "squat" future occurrences with any status/assigned_by; migration dedupe keeps uncompleted-earlier over completed-later → ADD CONSTRAINT can abort. Pre-existing on main (not fixed here): user_points self-writable, role self-promotable, task_completions insertable for others.
- **Calendar UI**: MAJOR "+N more" popover z-index 9999 renders above TaskDetailModal (z-50). MINOR: inline option objects re-render FC every render; dead 24h range widening; `@fullcalendar/interaction` unused; overdue memo stale.
- **Task surfaces**: MAJOR collapse pins to oldest *missed* occurrence labelled "Next:"; TaskManagement/AvailableTasksView/PersonalTaskStats fetches unbounded vs PostgREST max_rows=1000; PersonalTaskStats week/month keyed on assigned_at (= materialization time). MINOR: Assign-To above Repeat loses assignee; until<due accepted; recurring w/ 0 rows shows claimable; Mark Complete on future occurrences in modal / admin non-assignee in table; double error toast; 12h/24h split.
- **Reuse (Tasks↔Calendar)**: calendar completes via bare `completeTaskApi` (no CompleteTaskModal → no proof/notes/purchase editor/celebration); future-guard in 3 places; overdue only on calendar (instant) vs day-based scoring; colours disagree per page; Dashboard today-query not household-scoped; `TaskWithAssignment` ×7, getStatusColor ×3, getDifficultyColor ×4, claimTask ×2, 5 embed shapes.
- **Live E2E (Playwright, local Supabase)**: 9/9 scenarios PASS, 0 console errors, 0 4xx/5xx. Low: stale FC width after resize across md breakpoint.

## Decisions
- Overdue = due DATE before today (day-based, matches "Perfect timing" scoring). Time display 24h app-wide.
- Materialization stays client-side (SECURITY DEFINER RPC = future); harden policy WITH CHECK (`status='pending' AND assigned_by=auth.uid()`).
- Migrations on this branch are unmerged → edited in place, verified via `supabase db reset` (local dev DB is disposable).
- Fix in 2 phases partitioned by file ownership (parallel agents must not share files).

## Fix plan (all done 2026-08-18, uncommitted)
Phase 1 (parallel):
- [x] Me: AddTaskModal — until≥due validation, seed rotation from assigned_to on Repeat change, tsc fix
- [x] F1: recurrence.ts/useHousehold/tests — `activeRotation()` member filter (fetch household_members once in materializeHousehold), assigned_by=uid, in-flight ref keyed on household id, failure toast, `test.env.TZ=Europe/Prague` + DST tests (mutation-proven), MONTHLY ≥29 → `bymonthday:[d,-1],bysetpos:1`
- [x] F2 (died on session limit mid-tests; verified/finished by me): migration policy `WITH CHECK (status='pending' AND assigned_by=auth.uid() AND …)`, dedupe ranks completed rows first; `completeTask` CAS (`update … .neq('status','completed').select()`), `task.household_id` for points/photos; shared lib in `src/lib/api/tasks.ts` (`TaskWithAssignment`, `ASSIGNMENT_SELECT`, `fetchAssignments`, `attachAssignees`, `isOverdue`, `deriveStatus`, `canCompleteNow`/`completionBlocker`, `daysBetween`, `claimTask`), `src/lib/taskStyles.ts`, `TIME_FMT/DATE_FMT/DATE_TIME_FMT`. Applied policy to local DB via psql (no `db reset` — 16 local users kept); dedupe SQL dry-run in rolled-back txn; embed filter probed live via PostgREST.
Phase 2 (parallel):
- [x] F4 tasks/dashboard: `pickCurrentOccurrence` (latest open ≤ end of today, else earliest future open, else latest completed) + tests; `fetchAssignmentsForTasks` bounded (recurring rows ≥ today-30d, one-offs all); PersonalTaskStats on `completed_at`; Dashboard household-scoped via `fetchAssignments`; one `TaskWithAssignment`; `STATUS_STYLE`/`DIFFICULTY_STYLE` + Badge; lib `claimTask`; `canCompleteNow` guards in modal/table; 24h; single error toast; NEW `useTaskCompletion` hook (TaskTable's flow extracted); AvailableTasksView now takes props from TaskManagement (one fetch).
- [x] F5 calendar (stopped by user during its browser step; code was complete): `moreLinkClick="day"`, module-level `renderEventContent`/`renderDayHeader` ("Mon 17"), lib types + `fetchAssignments`/`attachAssignees`/`deriveStatus`/`STATUS_STYLE`/`TIME_FMT`, dead 24h widening removed, ResizeObserver → `updateSize()`, `text-base` selects on mobile, `@fullcalendar/interaction` removed.
Phase 3:
- [x] Me: Calendar → `useTaskCompletion` (chip → TaskDetailModal → CompleteTaskModal w/ proof/notes → celebration), deleted `calendar/hooks/useTaskActions.tsx`.
- [x] Me: remaining pre-existing tsc errors (framer-motion `Variants` ×6, Household `user_points` ×4, TaskApprovalInterface ×2).

## Gates (final)
tsc `-p tsconfig.app.json` **0 errors** (main: 53) · eslint 0 errors / 12 warnings · vitest **76/76** · vite build OK.
Playwright (local Supabase, user review-0817b): Dashboard 24h + scoped; Tasks collapse → current occurrence (daily=today, weekly="Next: Aug 20"); Calendar week "Mon 17" headers, 24h, overdue red only for due-date<today; chip → modal → Mark Complete opens shared CompleteTaskModal → double-click submit → exactly 1 completion in DB → calendar refreshed green; 375px week/month/day no horizontal overflow, grid full width after 1440→375 resize; "+4 more" → Day view (pill syncs), 0 console errors.

## Not done / follow-ups
- Pre-existing RLS holes on main (user_points self-writable, role self-promotable, task_completions insertable for others) — out of branch scope; need server-side points (trigger/RPC) design.
- Cross-timezone duplicate rows (needs TZID in pattern) and MAX_OCCURRENCES ceiling — `ponytail:` comments kept.
- Recurring task with 0 rows in the 28-day window is omitted from the Tasks list (reappears when in horizon).
- Local DB: hardened policy applied by hand (psql), so `supabase db reset` is NOT required locally; the migration file is the source of truth for other envs.
