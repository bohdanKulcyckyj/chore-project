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

## Phase 2 — Implement (workflow, 6 agents, file-partitioned)
- [ ] A: Migration (dedupe + UNIQUE(task_id,due_datetime), member INSERT policy) + RecurrencePattern types
- [ ] B: rrule engine `src/lib/recurrence.ts` + materializer + top-up in useHousehold + tests + vitest e2e exclude
- [ ] C: AddTaskModal — recurrence UI (native selects), fix points step, tz toISOString, materialize on create
- [ ] D: Calendar overhaul — height, view switch/nav, query fix, realtime, modal wiring, filters, badges, cleanup
- [ ] E: Surfaces — bounded fetches, per-task collapse, completeTask future-guard, fix due_date claim, delete TaskTableOld
- [ ] F: Lint sweep (after A–E)

## Phase 3 — Verify (workflow): build + unit + Playwright E2E + adversarial diff review
## Phase 4 — Fix findings, commit, PR
