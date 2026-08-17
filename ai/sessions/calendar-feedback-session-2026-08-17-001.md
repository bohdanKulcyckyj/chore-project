# Task: Calendar feedback — stacked views, mobile month, 24h
Date: 2026-08-17
Session: 001
Branch: bk-calendar-feature-followup

## Feedback (user)
- Week/day time slots too tight; Google-style single-row chips, "+N" overflow
- Month view unreadable on mobile
- 24h instead of am/pm — or drop hour slots and stack by due time (user leaned this way, asked for opinion)
- (mid-session) No icons in chips, every char counts

## Decision
Dropped the hour grid entirely: `timeGridWeek/Day` → `dayGridWeek/Day` (already-installed daygrid plugin).
Chores rarely have meaningful durations; a time grid is mostly empty space and forces cramped 2-line chips.
Stacked per-day chips ordered by due time work at 375px and need no slot-height tuning.

## Changes
- [x] `Calendar.tsx`: dayGrid views only, `eventDisplay="block"`, 24h `eventTimeFormat`, `dayMaxEvents={true}`
      (auto-fit + "+N more" popover), `defaultTimedEventDuration="00:00:00"` (else a 23:30 chore spans two days),
      wrapper `text-sm md:text-base` shrinks day numbers/headers on mobile
- [x] Chip = one line `HH:mm Title · Assignee`; month/week hide time+assignee below `md` and use 10px text;
      day view shows everything at 12px. No icons.
- [x] `useFullCalendarEvents`: point events at `due` (no `[due-duration, due]` span, no status rank —
      FullCalendar's default `eventOrder` is by start = due). Removed `duration`/`recurring`/`rank` props.
- [x] Removed `@fullcalendar/timegrid` dependency

## Verified (Playwright, local Supabase)
- 375px: week (title-only chips, 7 cols), month (2–3 chips/cell + "+N more"), day (agenda list)
- 1440px: week/month single-row chips with time + assignee; "+4 more" popover; chip click → TaskDetailModal
- tsc 0, lint 0 errors, vitest 46/46

## Not done (mention to user)
- Rest of app (Dashboard "Due: 9:30 PM", TaskDetailModal) still 12h — out of scope, easy follow-up
- `firstDay={0}` (Sunday) unchanged
- Time-grid can be restored (taller slots + `eventMaxStack` + 24h labels) if stacked view is not wanted
