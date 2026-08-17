# Task: Land the Calendar Feature (validation + recurrence + polish)
Date: 2026-08-16
Session: 001
Branch: bk-calendar-feature-followup → PR to main

## Decisions (user-approved)
- Full scope: recurrence engine (rrule) + recurrence UI + rotation, plus fixing the existing calendar
- **Materialized rows** architecture (not virtual client-side instances): generate real `task_assignments` 4 weeks ahead, top-up on household load; recurring chores visible on Dashboard/points too
- Land via commits on this branch + PR to main

## Phase 1 — Map & Validate (workflow wf_7b7c8afb, 6 agents) ✅
Calendar is currently non-functional. Key findings:
- [BLOCKER] `user_profiles!assigned_to` embed has no FK → every calendar fetch 400s (PGRST200), 0 events
- [BLOCKER] Calendar grid 0px height (h-full chain broken) → blank all views
- [BLOCKER] View switcher only sets state; FullCalendar never changes view; no date navigation
- [BLOCKER] AddTaskModal points `min=1 step=5` blocks default values from submitting
- [BLOCKER] UNIQUE on task_assignments silently dropped with `due_date` column → no dupe guard
- [BLOCKER] RLS: members can't INSERT assignments for others → blocks rotation materializer
- [BLOCKER] TaskManagement/PersonalTaskStats unbounded fetches → future rows flood UI
- [MAJOR] Timezone: datetime-local stored as naive-UTC → +2h display shift
- [MAJOR] AvailableTasksView claim inserts dropped `due_date` column (runtime broken)
- [MAJOR] TaskDetailModal commented out; realtime filter invalid; month range fetch wrong; completeTask farmable
- vitest collects e2e/ Playwright specs; 68 pre-existing lint errors

## Phase 2 — Implement (workflow wf_3ad9f9ba, 6 agents, file-partitioned) ✅ → commits 964df49..be43c6e
- [x] A: Migration (dedupe + UNIQUE(task_id,due_datetime), member INSERT policy) + RecurrencePattern types
- [x] B: rrule engine `src/lib/recurrence.ts` + materializer + top-up in useHousehold + tests + vitest e2e exclude
- [x] C: AddTaskModal — recurrence UI (native selects), fix points step, tz toISOString, materialize on create
- [x] D: Calendar overhaul — height, view switch/nav, query fix, realtime, modal wiring, filters, badges, cleanup
- [x] E: Surfaces — bounded fetches, per-task collapse, completeTask future-guard, fix due_date claim, delete TaskTableOld
- [x] F: Lint sweep → 0 errors (13 warnings), tsc 0, 42/42 tests, build OK

## Phase 3 — Verify (workflow wf_db71f8e3, 45 agents: 4 review lenses → skeptics ∥ E2E) ✅
E2E A–H passed live (grid, nav, timezone 15:00 correct, weekly materialization 8 rows + reload-idempotent,
two-user round-robin rotation A/B/A/B, modal + completion, far-future rejection, table collapse, filters).
I/J/K cut by rate limit. Confirmed findings:
- BLOCKER weekly BYDAY compared against UTC weekday (wrong local day when time crosses UTC midnight; DST hour drift)
- BLOCKER 24h completeTask guard unconditional → claim-then-complete (due now+7d) uncompletable; daily exploit at 20:01
- BLOCKER supabase_realtime publication has zero tables → realtime never fires
- MAJOR TaskManagement 7d bound + collapse → monthly/biweekly tasks vanish after completion; row mutates silently
- MAJOR materializeTask swallows errors → "Task created — 0 occurrences" success toast
- MAJOR Mark Complete shown to non-assignees; double-tap → double completion rows/points; stale fetch races
- MAJOR calendar fetch errors invisible; migration dedupe cascades into task_completions
- minor: overdue never derived, Assignment Type select contradicts rotation, <44px chips, first-occurrence-today drop,
  duplicate "Pending" labels, dead calendar claim path, boundary-spanning events

## Phase 4 — Fix + Re-verify (workflow wf_0fef71e0: 3 fixers → gates → E2E regression w/ mobile+realtime)
## Phase 5 — Commit, PR
