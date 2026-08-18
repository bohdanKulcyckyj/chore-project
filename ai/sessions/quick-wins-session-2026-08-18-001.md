# Task: Quick Wins — task edit/archive/reassign, member management, calendar view anchor
Date: 2026-08-18
Session: 001

## Objective
Identify and fix a batch of small, high-value gaps: unimplemented task actions,
member management, and a calendar view-switching bug.

## Subtasks
- [x] Calendar: month → week/day anchored to 1st of month instead of today
- [x] Task edit (was a `coming soon!` toast)
- [x] Task archive (was a `coming soon!` toast)
- [x] Task reassign (was a `coming soon!` toast)
- [x] Make Admin / Remove Member
- [x] Fix broken self-protection guard
- [x] Delete dead duplicate component
- [x] Surface silently-denied writes

## What turned out not to be a UI problem

"Make admin" and "remove member" were reported as unimplemented. They were fully
implemented in `Household.tsx` — and had never worked against the database.

`20250816191414` created `"Admins can manage household members"`.
`20250914150616_remote_schema.sql` **dropped it** (line 3) and replaced it with
self-service-only policies:

```
Users can update their own membership | UPDATE | (user_id = auth.uid())
Users can delete their own membership | DELETE | (user_id = auth.uid())
```

So an admin's UPDATE/DELETE on another member matched **zero rows**. PostgREST
returns `204 No Content` whether or not rows matched, so `error` was null and the
UI showed a success toast for a write that never happened.

Reproduced under the admin's own JWT:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<admin uuid>","role":"authenticated"}';
update household_members set role='admin' where id='<member row>';
-- UPDATE 0
```

### Second issue found while fixing the first

`"Users can update their own membership"` had no `WITH CHECK` and no column
restriction — a member could UPDATE their own row and set `role='admin'`.
Confirmed: `UPDATE 1`. Pre-existing privilege escalation, unrelated to this work.

## Fix: migration 20260818120000_restore_admin_member_management.sql

- `is_household_admin()` — SECURITY DEFINER, mirrors the existing
  `is_household_member()`. Reading `household_members` from inside its own policy
  is what caused the recursion incidents in `20250816184700` / `20250816191414`.
- Admin UPDATE + DELETE policies scoped by that helper.
- `prevent_last_admin_removal()` BEFORE UPDATE OR DELETE trigger enforcing two
  invariants the client cannot be trusted with:
  - a self-update may not change `role` (escalation) or `household_id`
  - the last admin cannot be demoted or removed (a zero-admin household is
    unrecoverable through the UI)

Escalation is blocked in the trigger rather than a `WITH CHECK` subquery, again to
avoid reading the guarded table from its own policy.

### RLS test matrix (all pass)

| # | Actor | Action | Expected | Result |
|---|-------|--------|----------|--------|
| 1 | admin | promote member | UPDATE 1 | ✅ |
| 2 | admin | demote member | UPDATE 1 | ✅ |
| 3 | member | self-promote | ERROR | ✅ `Only an admin can change a member role` |
| 4 | last admin | self-demote | ERROR | ✅ `Household must keep at least one admin` |
| 5 | last admin | self-delete | ERROR | ✅ same |
| 6 | member | remove another | DELETE 0 | ✅ |
| 7 | member | leave household | DELETE 1 | ✅ |

## Client changes

- `Household.tsx`: guard compared `member.id` (row id) to `user.id` (auth id), so
  it never fired — handlers now take the member object and compare `user_id`.
  Added a client-side last-admin check for a friendly toast.
- Both handlers now `.select('id')` and treat an empty result as a failure, so a
  silently-denied write no longer reports success.
- `Calendar.tsx`: `changeView(view)` keeps FullCalendar's anchor date (the 1st in
  month view). Now passes today when today is in the visible range, else keeps the
  anchor so browsing March → week stays in March.
- `AddTaskModal.tsx`: optional `task` prop puts it in edit mode. Metadata only —
  recurrence/assignee/due-date hidden and never written, since changing recurrence
  needs re-materialization (`materializeTask`).
- `TaskTable.tsx`: archive flips `is_active` (already filtered by
  `TaskManagement`); reassign updates `assigned_to` via a native select in a
  bottom sheet. UI-only `unassigned-<taskId>` placeholder rows are rejected —
  they have no `task_assignments` row, so the UPDATE would match nothing.
- Deleted `admin/HouseholdMemberManagement.tsx` — 307 lines, imported nowhere,
  a near-duplicate of the live `Household.tsx` UI carrying the same broken guard.

## Verification

Playwright against local Supabase, each write confirmed in Postgres rather than
from the toast:

- edit → `TZ Check EDITED | 45`, `recurrence_type`/`assignment_type` untouched
- archive → `is_active = f`, row disappears from the list
- reassign → `assigned_to` = Cal Smoke B, `assigned_by` = acting admin
- make admin → role flips, UI shows Administrator
- remove member → row deleted
- calendar → month→week `Aug 16 – 22`, month→day `August 18`; browsing to
  September then switching gives `Aug 30 – Sep 5` (keeps the anchor)
- reassign sheet checked at 375px

tsc 0 errors · lint 0 errors (11 pre-existing warnings) · 76/76 tests · build OK ·
no console errors.

## Notes / follow-ups

- The points input has `step="5"`, so a value like `42` fails native HTML5
  validation and the form silently refuses to submit with no visible message.
  Pre-existing; affects task creation too. Caused a wrong diagnosis mid-session.
- Task edit deliberately excludes recurrence — see the `ponytail:` comment in
  `AddTaskModal.tsx`.
- Editing a recurring task edits the shared `tasks` row, so metadata changes apply
  to every occurrence.
