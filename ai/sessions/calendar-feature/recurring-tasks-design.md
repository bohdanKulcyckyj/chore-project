# Recurring Tasks Backend Design & Implementation

**Date:** 2025-10-04
**Context:** Calendar feature implementation - Phase 3.5
**Status:** Design & Planning

## Current Schema Analysis

### Existing Fields in `tasks` Table

```sql
-- Tasks table already has recurrence support
CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  household_id uuid,
  name text NOT NULL,
  description text,
  category_id uuid,

  -- Recurrence fields (already exist!)
  recurrence_type text DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_pattern jsonb DEFAULT '{}',  -- Complex recurrence rules
  assignment_type text DEFAULT 'flexible' CHECK (assignment_type IN ('fixed', 'rotating', 'flexible')),

  -- Other fields...
  difficulty text,
  estimated_duration integer,
  points integer,
  requires_approval boolean,
  is_active boolean
);
```

### Task Assignments Table

```sql
CREATE TABLE task_assignments (
  id uuid PRIMARY KEY,
  task_id uuid REFERENCES tasks(id),
  assigned_to uuid,
  due_date timestamptz,  -- Now due_datetime
  status text,
  UNIQUE(task_id, assigned_to, due_date)  -- Allows multiple instances
);
```

## Design Philosophy

**Key Concept:**
- `tasks` table = **Template/Definition** (the recurring rule)
- `task_assignments` table = **Instances** (individual occurrences)

### Example: "Make Dinner Every Day"

```
tasks:
  id: abc-123
  name: "Make Dinner"
  recurrence_type: "daily"
  recurrence_pattern: { time: "18:00", days: [1,2,3,4,5,6,7] }
  assignment_type: "rotating"

task_assignments (generated instances):
  id: xyz-1, task_id: abc-123, assigned_to: user1, due_datetime: "2025-10-04 18:00"
  id: xyz-2, task_id: abc-123, assigned_to: user2, due_datetime: "2025-10-05 18:00"
  id: xyz-3, task_id: abc-123, assigned_to: user1, due_datetime: "2025-10-06 18:00"
  ...
```

## Recurrence Pattern Schema Design

### 1. Daily Recurrence

```json
{
  "frequency": "daily",
  "interval": 1,              // Every N days
  "time": "18:00",            // Default time
  "endDate": "2025-12-31",    // Optional end date
  "endAfter": null            // Or end after N occurrences
}
```

**Examples:**
- Every day: `{ frequency: "daily", interval: 1 }`
- Every 2 days: `{ frequency: "daily", interval: 2 }`
- Every day until Dec 31: `{ frequency: "daily", interval: 1, endDate: "2025-12-31" }`

### 2. Weekly Recurrence

```json
{
  "frequency": "weekly",
  "interval": 1,                   // Every N weeks
  "daysOfWeek": [1, 3, 5],        // Mon=1, Tue=2, ..., Sun=7
  "time": "19:00",
  "endDate": null,
  "endAfter": 52                   // End after 52 occurrences
}
```

**Examples:**
- Every Monday, Wednesday, Friday: `{ frequency: "weekly", daysOfWeek: [1,3,5] }`
- Every weekend: `{ frequency: "weekly", daysOfWeek: [6,7] }`
- Every 2 weeks on Tuesday: `{ frequency: "weekly", interval: 2, daysOfWeek: [2] }`

### 3. Monthly Recurrence

```json
{
  "frequency": "monthly",
  "interval": 1,                   // Every N months
  "dayOfMonth": 15,                // Day of month (1-31)
  "time": "10:00",
  "endDate": "2026-01-01"
}
```

**OR** (for "first Monday of month" style):

```json
{
  "frequency": "monthly",
  "interval": 1,
  "weekOrdinal": 1,                // 1=first, 2=second, -1=last
  "dayOfWeek": 1,                  // Monday
  "time": "10:00"
}
```

**Examples:**
- 15th of every month: `{ frequency: "monthly", dayOfMonth: 15 }`
- First Monday of month: `{ frequency: "monthly", weekOrdinal: 1, dayOfWeek: 1 }`
- Last Friday of month: `{ frequency: "monthly", weekOrdinal: -1, dayOfWeek: 5 }`

### 4. Custom Recurrence (iCalendar RRULE)

For complex patterns, use iCalendar RRULE format:

```json
{
  "frequency": "custom",
  "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1;UNTIL=20251231T000000Z"
}
```

This allows maximum flexibility using standard recurrence syntax.

## Assignment Types Strategy

### 1. Fixed Assignment

```typescript
assignment_type: "fixed"
recurrence_pattern: {
  frequency: "daily",
  assignedTo: "user-123"  // Always same person
}
```

**Use case:** Personal tasks, specific responsibilities

### 2. Rotating Assignment

```typescript
assignment_type: "rotating"
recurrence_pattern: {
  frequency: "daily",
  rotation: {
    type: "round-robin",
    members: ["user-1", "user-2", "user-3"],
    startIndex: 0
  }
}
```

**Use case:** Shared chores that rotate among household members

### 3. Flexible Assignment

```typescript
assignment_type: "flexible"
recurrence_pattern: {
  frequency: "weekly",
  autoAssign: false  // Created unassigned, anyone can claim
}
```

**Use case:** Tasks anyone can do, first-come-first-served

## Instance Generation Strategy

### Approach 1: Lazy Generation (RECOMMENDED)

Generate instances **on-demand** when viewing calendar:

**Pros:**
- No database bloat
- Easy to modify recurrence rules (affects future only)
- No stale future instances
- Calendar always shows correct occurrences

**Cons:**
- Computation on every calendar load
- Need caching strategy

**Implementation:**
```typescript
// In useCalendarData hook
const generateRecurringInstances = (task: Task, dateRange: { start: Date, end: Date }) => {
  if (task.recurrence_type === 'none') return [];

  const instances: TaskAssignment[] = [];
  const pattern = task.recurrence_pattern;

  // Generate instances for date range
  let currentDate = dateRange.start;
  while (currentDate <= dateRange.end) {
    if (matchesRecurrencePattern(currentDate, pattern)) {
      instances.push({
        id: `generated-${task.id}-${currentDate.toISOString()}`,
        task_id: task.id,
        due_datetime: currentDate.toISOString(),
        status: 'unassigned',
        // ... other fields
      });
    }
    currentDate = getNextOccurrence(currentDate, pattern);
  }

  return instances;
};
```

### Approach 2: Pre-Generation with Cron Job

Generate instances **in advance** using scheduled job:

**Pros:**
- Fast calendar loads (instances already exist)
- Can send notifications for upcoming tasks
- Easier querying (just SELECT from assignments)

**Cons:**
- Database bloat (many future instances)
- Modifying recurrence is complex (delete future instances)
- Need cleanup of old instances

**Implementation:**
```sql
-- Postgres function to generate next 30 days of instances
CREATE OR REPLACE FUNCTION generate_recurring_instances()
RETURNS void AS $$
DECLARE
  task_record RECORD;
  next_date DATE;
BEGIN
  FOR task_record IN
    SELECT * FROM tasks WHERE recurrence_type != 'none' AND is_active = true
  LOOP
    -- Generate instances logic
    -- INSERT INTO task_assignments...
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Supabase Edge Function (runs daily via cron)
```

### Approach 3: Hybrid (BEST FOR CALENDAR)

**Near-term:** Pre-generate (7-30 days ahead)
**Far-term:** Lazy-generate for calendar preview

```typescript
// Check if instance exists in DB
const existingInstances = await supabase
  .from('task_assignments')
  .select('*')
  .eq('task_id', task.id)
  .gte('due_datetime', dateRange.start)
  .lte('due_datetime', dateRange.end);

// Generate missing instances on-the-fly
const generatedInstances = generateMissingInstances(task, existingInstances, dateRange);

// Combine both
const allInstances = [...existingInstances, ...generatedInstances];
```

## Recommended Implementation Plan

### Phase 1: Basic Recurring Tasks (Current Implementation)

**What we have:**
- ✅ Database schema with recurrence fields
- ✅ TypeScript types for tasks
- ✅ Recurrence types: none, daily, weekly, monthly, custom

**What we need:**
1. **Recurrence Pattern Builder UI** - Form to create recurrence rules
2. **Instance Generator Utility** - Function to generate instances from pattern
3. **Calendar Integration** - Show recurring instances in calendar views

### Phase 2: Advanced Features (Future)

- **Edit Recurrence Dialog** - Modify future occurrences
- **Exception Handling** - Skip specific dates (holidays)
- **Recurrence Preview** - Show next 10 occurrences before saving
- **Assignment Rotation UI** - Configure rotation order

## Recurrence Utility Functions

```typescript
// src/lib/utils/recurrence.ts

import { parseISO, addDays, addWeeks, addMonths, isSameDay, getDay } from 'date-fns';

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval?: number;
  time?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  weekOrdinal?: number;
  dayOfWeek?: number;
  endDate?: string;
  endAfter?: number;
  rrule?: string;
}

export const generateRecurringInstances = (
  task: Task,
  startDate: Date,
  endDate: Date
): TaskAssignment[] => {
  const pattern = task.recurrence_pattern as RecurrencePattern;
  const instances: TaskAssignment[] = [];

  let currentDate = startDate;
  let occurrenceCount = 0;

  while (currentDate <= endDate) {
    if (matchesRecurrencePattern(currentDate, pattern)) {
      const dueDateTime = combineDateAndTime(currentDate, pattern.time || '09:00');

      instances.push({
        id: `gen-${task.id}-${dueDateTime.toISOString()}`,
        task_id: task.id,
        due_datetime: dueDateTime.toISOString(),
        status: 'unassigned',
        assigned_to: getAssigneeForOccurrence(task, occurrenceCount),
        task: task  // Include task details
      });

      occurrenceCount++;

      // Check end conditions
      if (pattern.endAfter && occurrenceCount >= pattern.endAfter) break;
      if (pattern.endDate && currentDate > parseISO(pattern.endDate)) break;
    }

    currentDate = getNextPotentialDate(currentDate, pattern);
  }

  return instances;
};

const matchesRecurrencePattern = (date: Date, pattern: RecurrencePattern): boolean => {
  switch (pattern.frequency) {
    case 'daily':
      return true; // Every day (interval handled elsewhere)

    case 'weekly':
      const dayOfWeek = getDay(date); // 0=Sun, 1=Mon, ...
      return pattern.daysOfWeek?.includes(dayOfWeek === 0 ? 7 : dayOfWeek) || false;

    case 'monthly':
      if (pattern.dayOfMonth) {
        return date.getDate() === pattern.dayOfMonth;
      }
      // Handle weekOrdinal logic (e.g., "first Monday")
      return false;

    case 'custom':
      // Use rrule library to parse and check
      return false;

    default:
      return false;
  }
};

const getNextPotentialDate = (current: Date, pattern: RecurrencePattern): Date => {
  const interval = pattern.interval || 1;

  switch (pattern.frequency) {
    case 'daily':
      return addDays(current, interval);
    case 'weekly':
      return addDays(current, 1); // Check daily, filter by daysOfWeek
    case 'monthly':
      return addDays(current, 1); // Check daily, filter by dayOfMonth
    default:
      return addDays(current, 1);
  }
};

const getAssigneeForOccurrence = (task: Task, occurrenceIndex: number): string | null => {
  if (task.assignment_type === 'fixed') {
    return task.recurrence_pattern.assignedTo || null;
  }

  if (task.assignment_type === 'rotating') {
    const rotation = task.recurrence_pattern.rotation;
    const memberIndex = (rotation.startIndex + occurrenceIndex) % rotation.members.length;
    return rotation.members[memberIndex];
  }

  return null; // Flexible - unassigned
};
```

## Database Queries for Calendar

### Query Approach for Calendar View

```typescript
// Combined query: existing instances + generated instances
const getTasksForCalendar = async (householdId: string, startDate: Date, endDate: Date) => {
  // 1. Get all active recurring tasks
  const { data: recurringTasks } = await supabase
    .from('tasks')
    .select('*, task_categories(*)')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .neq('recurrence_type', 'none');

  // 2. Get existing task assignments (both one-time and recurring instances)
  const { data: existingAssignments } = await supabase
    .from('task_assignments')
    .select('*, tasks!inner(*, task_categories(*)), user_profiles(*)')
    .eq('tasks.household_id', householdId)
    .gte('due_datetime', startDate.toISOString())
    .lte('due_datetime', endDate.toISOString());

  // 3. Generate missing recurring instances on-the-fly
  const generatedInstances = recurringTasks.flatMap(task =>
    generateRecurringInstances(task, startDate, endDate)
  );

  // 4. Filter out generated instances that already exist in DB
  const existingIds = new Set(existingAssignments.map(a =>
    `${a.task_id}-${a.due_datetime}`
  ));

  const uniqueGenerated = generatedInstances.filter(gen =>
    !existingIds.has(`${gen.task_id}-${gen.due_datetime}`)
  );

  // 5. Combine and return
  return [...existingAssignments, ...uniqueGenerated];
};
```

## UI/UX Considerations for Calendar

### Visual Indicators

- **Recurring Task Badge**: Show 🔁 icon for recurring tasks
- **Series Identifier**: Same color/pattern for same recurring task
- **Instance vs Template**: Different styling for generated vs DB instances

### User Actions

1. **Click Recurring Instance** → Options:
   - Complete this occurrence only
   - Skip this occurrence
   - Edit this and future occurrences
   - Edit entire series

2. **Edit Recurring Task** → Dialog:
   - Edit this occurrence only → Creates exception
   - Edit this and future → Updates pattern from this date
   - Edit all → Updates template

### Edge Cases

- **Completed Instance**: Mark as completed, don't regenerate
- **Skipped Instance**: Create exception in pattern
- **Deleted Instance**: Soft delete, don't regenerate
- **Modified Time**: Create one-time override

## Implementation Priority

### Minimal Viable Recurrence (MVP)

For calendar Phase 3, implement:

1. ✅ **Read Existing Recurrence** - Display tasks with `recurrence_type != 'none'`
2. ✅ **Basic Generation** - Generate daily/weekly instances for calendar view
3. ✅ **Visual Indicator** - Show which tasks are recurring
4. ⏸️ **Create Recurrence UI** - Defer to Phase 4 (not needed for viewing)

### Full Recurrence System (Phase 4+)

1. **Recurrence Builder UI** - Full pattern creation
2. **Edit/Delete Dialogs** - Instance vs Series options
3. **Exception Handling** - Skip dates, custom overrides
4. **Rotation Management** - Configure member rotation

## Testing Strategy

```typescript
describe('Recurrence Generation', () => {
  it('should generate daily instances', () => {
    const task = {
      recurrence_type: 'daily',
      recurrence_pattern: { frequency: 'daily', time: '09:00' }
    };
    const instances = generateRecurringInstances(task, start, end);
    expect(instances.length).toBe(7); // 7 days
  });

  it('should respect daysOfWeek for weekly', () => {
    const task = {
      recurrence_type: 'weekly',
      recurrence_pattern: { frequency: 'weekly', daysOfWeek: [1, 3, 5] }
    };
    const instances = generateRecurringInstances(task, start, end);
    instances.forEach(inst => {
      const day = getDay(parseISO(inst.due_datetime));
      expect([1, 3, 5]).toContain(day);
    });
  });

  it('should rotate assignments', () => {
    const task = {
      assignment_type: 'rotating',
      recurrence_pattern: {
        frequency: 'daily',
        rotation: { members: ['u1', 'u2', 'u3'], startIndex: 0 }
      }
    };
    const instances = generateRecurringInstances(task, start, end);
    expect(instances[0].assigned_to).toBe('u1');
    expect(instances[1].assigned_to).toBe('u2');
    expect(instances[2].assigned_to).toBe('u3');
    expect(instances[3].assigned_to).toBe('u1'); // Wrap around
  });
});
```

## Recommendation for Calendar Feature (Now)

**For Phase 3 Calendar Implementation:**

1. **Use Lazy Generation** - Generate instances on-the-fly when loading calendar
2. **Support Basic Patterns** - Daily, weekly patterns only (monthly later)
3. **Read-Only Recurrence** - Display recurring tasks, defer editing to Phase 4
4. **Filter Generated Instances** - Exclude if already in DB (completed/modified)

**Implementation Steps:**
1. Create `src/lib/utils/recurrence.ts` with generation utilities
2. Update `useCalendarData` hook to merge DB + generated instances
3. Add visual indicator in CustomEventContent for recurring tasks
4. Test with sample recurring tasks

**Defer to Later:**
- Recurrence creation UI
- Edit recurrence dialog
- Exception handling
- Complex monthly patterns
- iCalendar RRULE support

---

**Status:** Design Complete - Ready for Implementation Discussion
**Next Steps:** Confirm approach, then implement recurrence utilities for Phase 3
