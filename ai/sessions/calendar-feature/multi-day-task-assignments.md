# Multi-Day Task Assignments Design

**Date:** 2025-10-04
**Context:** Recurring tasks where one execution covers multiple days
**Problem:** How to represent "Make dinner for 2 days" or "Meal prep for 3 days"

## Use Cases

### Real-World Examples

1. **Meal Prep Sunday** - Cook on Sunday, covers Mon/Tue/Wed lunches
2. **Batch Cooking** - Make dinner Sunday night, leftovers for Monday
3. **Laundry** - Do laundry once, covers 3-4 days of clothes
4. **Grocery Shopping** - Shop once, covers whole week
5. **Lawn Mowing** - Mow once, good for 5-7 days

### Key Questions

- **Execution:** When is the task actually performed? (Sunday)
- **Coverage:** What days does it cover? (Mon, Tue, Wed)
- **Points:** When are points awarded? (Once on completion, or split across days?)
- **Calendar View:** How to visualize? (Single event? Spanning event? Ghost tasks?)
- **Rotation:** How to handle rotation fairly? (Person A does Sunday = 3 days covered)

## Design Options

### Option 1: Single Assignment with Coverage Period ⭐ RECOMMENDED

**Concept:** One task assignment that spans multiple days

#### Database Schema

```sql
-- Add to task_assignments table
ALTER TABLE task_assignments
ADD COLUMN coverage_start_date timestamptz,
ADD COLUMN coverage_end_date timestamptz;

-- The assignment itself
CREATE TABLE task_assignments (
  id uuid PRIMARY KEY,
  task_id uuid,
  assigned_to uuid,
  due_datetime timestamptz,           -- When to complete it (Sunday 6pm)
  coverage_start_date timestamptz,    -- When coverage starts (Monday)
  coverage_end_date timestamptz,      -- When coverage ends (Wednesday)
  status text,
  -- ...
);
```

#### Example Data

**Meal Prep for 3 days:**
```json
{
  "id": "assign-123",
  "task_id": "meal-prep-task",
  "assigned_to": "user-1",
  "due_datetime": "2025-10-06T12:00:00Z",      // Sunday noon - do it
  "coverage_start_date": "2025-10-07T00:00:00Z", // Monday - starts covering
  "coverage_end_date": "2025-10-09T23:59:59Z",   // Wednesday - ends covering
  "status": "pending"
}
```

#### Recurrence Pattern

```json
{
  "rrule": "FREQ=WEEKLY;BYDAY=SU",  // Every Sunday
  "dtstart": "2025-10-06T12:00:00Z",
  "coverageDuration": 3,  // Covers 3 days after completion
  "coverageType": "days_after"  // or "specific_days", "until_next"
}
```

#### Pros
✅ Single database record = simple
✅ Points awarded once (fair)
✅ Clear ownership and completion
✅ Rotation is straightforward
✅ Easy to query "who's responsible for dinner Mon-Wed?"

#### Cons
❌ Calendar visualization complex (spanning event)
❌ Need to calculate "am I covered today?" logic
❌ Overlapping coverage (if someone does extra) hard to handle

---

### Option 2: Parent Task with Child Instances

**Concept:** One execution task + multiple "coverage" child tasks

#### Database Schema

```sql
-- Add parent relationship
ALTER TABLE task_assignments
ADD COLUMN parent_assignment_id uuid REFERENCES task_assignments(id),
ADD COLUMN is_coverage_instance boolean DEFAULT false;
```

#### Example Data

**Parent (execution):**
```json
{
  "id": "parent-123",
  "task_id": "meal-prep",
  "assigned_to": "user-1",
  "due_datetime": "2025-10-06T12:00:00Z",  // Sunday - do meal prep
  "status": "pending",
  "is_coverage_instance": false
}
```

**Children (coverage days):**
```json
[
  {
    "id": "child-1",
    "task_id": "meal-prep",
    "assigned_to": "user-1",
    "due_datetime": "2025-10-07T12:00:00Z",  // Monday lunch
    "parent_assignment_id": "parent-123",
    "status": "covered",  // Auto-completed when parent done
    "is_coverage_instance": true
  },
  {
    "id": "child-2",
    "task_id": "meal-prep",
    "assigned_to": "user-1",
    "due_datetime": "2025-10-08T12:00:00Z",  // Tuesday lunch
    "parent_assignment_id": "parent-123",
    "status": "covered",
    "is_coverage_instance": true
  }
]
```

#### Pros
✅ Each day visible on calendar
✅ Easy to see "covered by meal prep on Sunday"
✅ Can handle partial coverage (some days covered, others not)
✅ Queries are straightforward

#### Cons
❌ Database bloat (1 execution = N coverage records)
❌ Complex to maintain parent-child relationships
❌ Deletion/modification cascades tricky
❌ Points calculation complex (only parent gets points)

---

### Option 3: Daily Tasks with "Fulfilled By" Reference

**Concept:** Daily recurring tasks that can be fulfilled by a batch task

#### Database Schema

```sql
-- Track which task fulfilled this assignment
ALTER TABLE task_assignments
ADD COLUMN fulfilled_by_assignment_id uuid REFERENCES task_assignments(id),
ADD COLUMN fulfillment_type text CHECK (fulfillment_type IN ('self', 'batch', 'coverage'));
```

#### Example Data

**Batch task (the execution):**
```json
{
  "id": "batch-123",
  "task_id": "meal-prep-batch",  // Different task: "Meal Prep (3 days)"
  "assigned_to": "user-1",
  "due_datetime": "2025-10-06T12:00:00Z",
  "status": "completed"
}
```

**Daily tasks (auto-fulfilled):**
```json
[
  {
    "id": "daily-1",
    "task_id": "lunch-daily",  // Regular task: "Make Lunch"
    "due_datetime": "2025-10-07T12:00:00Z",
    "status": "completed",
    "fulfilled_by_assignment_id": "batch-123",
    "fulfillment_type": "batch"
  },
  {
    "id": "daily-2",
    "task_id": "lunch-daily",
    "due_datetime": "2025-10-08T12:00:00Z",
    "status": "completed",
    "fulfilled_by_assignment_id": "batch-123",
    "fulfillment_type": "batch"
  }
]
```

#### Pros
✅ Daily tasks still exist (rotation works normally)
✅ Clear in calendar (Mon/Tue/Wed all show lunch task)
✅ Can fulfill manually OR via batch
✅ Flexible - some days batch, some days individual

#### Cons
❌ Need TWO task types (daily + batch version)
❌ Complex logic to auto-fulfill daily tasks
❌ Points double-counting risk
❌ User confusion (which task to complete?)

---

### Option 4: Virtual Coverage (Calendar Display Only)

**Concept:** Single assignment, coverage is just UI/display logic

#### Database Schema

```sql
-- No schema changes! Just store metadata
{
  "task_id": "meal-prep",
  "due_datetime": "2025-10-06T12:00:00Z",
  "metadata": {
    "coversDays": 3,
    "coverageType": "consecutive"
  }
}
```

#### How It Works

- **Database:** Only the execution task exists (Sunday)
- **Calendar Logic:** When rendering, if task has `coversDays`, show ghost events
- **Ghost Events:** Visual indicators on Mon/Tue/Wed saying "Covered by Sunday meal prep"

#### Example Calendar Rendering

```typescript
const renderCalendarEvents = (assignments) => {
  const events = [];

  assignments.forEach(assignment => {
    // Main task event
    events.push({
      id: assignment.id,
      title: assignment.task.name,
      start: assignment.due_datetime,
      type: 'main'
    });

    // Generate ghost/coverage events
    if (assignment.task.metadata?.coversDays) {
      const coverageDays = assignment.task.metadata.coversDays;
      const startDate = new Date(assignment.due_datetime);

      for (let i = 1; i <= coverageDays; i++) {
        const coverageDate = addDays(startDate, i);
        events.push({
          id: `coverage-${assignment.id}-${i}`,
          title: `✓ Covered by ${assignment.task.name}`,
          start: coverageDate,
          type: 'coverage',
          rendering: 'background',  // FullCalendar background event
          backgroundColor: '#e0f2fe',
          parentAssignmentId: assignment.id
        });
      }
    }
  });

  return events;
};
```

#### Pros
✅ **Simplest database schema** - no changes needed
✅ No complex parent-child relationships
✅ Easy to understand and maintain
✅ Points awarded once (fair and simple)
✅ Rotation works naturally

#### Cons
❌ Coverage is "soft" - not enforced in DB
❌ Queries for "what covers Monday?" require logic
❌ Reporting might miss coverage info

---

## Detailed Comparison

| Feature | Option 1: Coverage Dates | Option 2: Parent-Child | Option 3: Fulfilled By | Option 4: Virtual |
|---------|-------------------------|------------------------|----------------------|-------------------|
| **DB Records** | 1 per execution | 1 parent + N children | 1 batch + N daily | 1 per execution |
| **Complexity** | Low | High | Very High | Very Low |
| **Calendar Display** | Spanning event | Multiple events | Multiple events | Ghost events |
| **Points** | Once, clear | Parent only | Complex | Once, clear |
| **Rotation** | Simple | Simple | Complex | Simple |
| **Queries** | Need coverage logic | Straightforward | Straightforward | Need coverage logic |
| **Schema Changes** | +2 columns | +2 columns | +2 columns | None |
| **Maintenance** | Easy | Complex | Very Complex | Easy |

## Recommended Approach: Hybrid (Option 1 + 4)

### Best of Both Worlds

**Database:** Use Option 1 (coverage dates) for data integrity
**Display:** Use Option 4 (virtual events) for calendar visualization

### Implementation

#### 1. Database Schema (Minimal)

```sql
-- Add coverage period to task_assignments
ALTER TABLE task_assignments
ADD COLUMN coverage_end_date timestamptz;  -- Only need end date, start = due_datetime

-- Task metadata for coverage rules
-- tasks.recurrence_pattern can include:
{
  "rrule": "FREQ=WEEKLY;BYDAY=SU",
  "coverageDays": 3,  // Covers 3 days after completion
  "coverageType": "consecutive"  // or "specific_weekdays", etc.
}
```

#### 2. Task Assignment Creation

```typescript
// When creating meal prep assignment
const createMealPrepAssignment = async (userId: string, dueDate: Date) => {
  const task = await getTask('meal-prep-task');
  const coverageDays = task.recurrence_pattern?.coverageDays || 0;

  const assignment = {
    task_id: task.id,
    assigned_to: userId,
    due_datetime: dueDate,  // Sunday 12pm
    coverage_end_date: coverageDays > 0
      ? addDays(dueDate, coverageDays)  // Wednesday 11:59pm
      : null,
    status: 'pending'
  };

  await supabase.from('task_assignments').insert(assignment);
};
```

#### 3. Calendar Display (Virtual Coverage)

```typescript
// In useFullCalendarEvents hook
const transformToCalendarEvents = (assignments: TaskAssignment[]) => {
  const events: CalendarEvent[] = [];

  assignments.forEach(assignment => {
    // Main execution event
    events.push({
      id: assignment.id,
      title: assignment.task.name,
      start: assignment.due_datetime,
      end: assignment.coverage_end_date || assignment.due_datetime,
      backgroundColor: getTaskColor(assignment.status),
      extendedProps: {
        type: 'main',
        assignment
      }
    });

    // Add background coverage events for visual clarity
    if (assignment.coverage_end_date) {
      const currentDate = addDays(new Date(assignment.due_datetime), 1);
      const endDate = new Date(assignment.coverage_end_date);

      while (currentDate <= endDate) {
        events.push({
          id: `coverage-${assignment.id}-${currentDate.toISOString()}`,
          title: `✓ Covered by ${assignment.task.name}`,
          start: currentDate,
          allDay: true,
          display: 'background',  // FullCalendar background event
          backgroundColor: 'rgba(34, 197, 94, 0.1)',  // Light green
          extendedProps: {
            type: 'coverage',
            parentAssignment: assignment
          }
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  });

  return events;
};
```

#### 4. Recurrence Generation with Coverage

```typescript
// In generateRecurringInstances (using rrule.js)
export const generateRecurringInstances = (
  task: Task,
  startDate: Date,
  endDate: Date
): TaskAssignment[] => {
  // ... existing rrule logic ...

  const occurrences = rule.between(startDate, endDate, true);
  const coverageDays = task.recurrence_pattern?.coverageDays || 0;

  return occurrences.map((date, index) => {
    const assignment: TaskAssignment = {
      id: `gen-${task.id}-${date.toISOString()}`,
      task_id: task.id,
      due_datetime: date.toISOString(),
      coverage_end_date: coverageDays > 0
        ? addDays(date, coverageDays).toISOString()
        : null,
      status: 'unassigned',
      assigned_to: getAssigneeForOccurrence(task, index),
      task: task
    };

    return assignment;
  });
};
```

#### 5. Coverage Conflict Detection

```typescript
// Check if a day is already covered
const isDayCovered = async (date: Date, householdId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('task_assignments')
    .select('*')
    .eq('household_id', householdId)
    .lte('due_datetime', date.toISOString())
    .gte('coverage_end_date', date.toISOString())
    .eq('status', 'completed');

  return (data?.length || 0) > 0;
};

// Warn user if creating overlapping coverage
const checkCoverageOverlap = (newAssignment: TaskAssignment, existing: TaskAssignment[]) => {
  const warnings = [];

  existing.forEach(existingAssignment => {
    if (existingAssignment.coverage_end_date) {
      const existingEnd = new Date(existingAssignment.coverage_end_date);
      const newStart = new Date(newAssignment.due_datetime);
      const newEnd = newAssignment.coverage_end_date
        ? new Date(newAssignment.coverage_end_date)
        : newStart;

      // Check overlap
      if (newStart <= existingEnd && newEnd >= new Date(existingAssignment.due_datetime)) {
        warnings.push({
          message: `Overlaps with ${existingAssignment.task.name} coverage`,
          conflictingAssignment: existingAssignment
        });
      }
    }
  });

  return warnings;
};
```

### Visual Design

#### Calendar Display Examples

**Week View - Meal Prep Sunday:**
```
Sunday    Monday    Tuesday   Wednesday
┌─────────┬─────────┬─────────┬─────────┐
│ 12:00   │         │         │         │
│ ┌─────┐ │ ░░░░░░░ │ ░░░░░░░ │ ░░░░░░░ │
│ │Meal │ │ ░Covered░ │ ░Covered░ │ ░Covered░ │
│ │Prep │ │ ░by Meal░ │ ░by Meal░ │ ░by Meal░ │
│ │     │ │ ░Prep  ░ │ ░Prep  ░ │ ░Prep  ░ │
│ └─────┘ │ ░░░░░░░ │ ░░░░░░░ │ ░░░░░░░ │
└─────────┴─────────┴─────────┴─────────┘
```

#### CustomEventContent Component

```typescript
const CustomEventContent = ({ eventInfo }) => {
  const { event } = eventInfo;
  const type = event.extendedProps.type;

  if (type === 'coverage') {
    // Background coverage indicator
    return (
      <div className="text-xs text-green-600 italic p-1">
        <CheckCircle className="w-3 h-3 inline mr-1" />
        Covered by {event.extendedProps.parentAssignment.task.name}
      </div>
    );
  }

  // Main task event
  const assignment = event.extendedProps.assignment;
  const coverageDays = assignment.coverage_end_date
    ? differenceInDays(
        new Date(assignment.coverage_end_date),
        new Date(assignment.due_datetime)
      )
    : 0;

  return (
    <div className="p-2">
      <div className="font-medium flex items-center gap-1">
        {event.title}
        {coverageDays > 0 && (
          <Badge variant="secondary" className="text-xs">
            {coverageDays}d coverage
          </Badge>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {assignment.assigned_user?.display_name}
      </div>
    </div>
  );
};
```

## Edge Cases & Solutions

### 1. Overlapping Coverage

**Scenario:** User completes meal prep Sun (covers Mon-Wed), then someone else makes dinner Tuesday

**Solution:**
- Allow it, mark Tuesday as "extra" or "override"
- Award points for both (batch + individual)
- Visual: Show both events on Tuesday

### 2. Partial Coverage

**Scenario:** Meal prep covers Mon-Tue, but Wed someone needs to cook fresh

**Solution:**
- Coverage ends Tuesday
- Wednesday shows as uncovered (needs assignment)
- Calendar clearly shows coverage gap

### 3. Rotation Fairness

**Scenario:** Person A does meal prep (3 days), Person B does daily cook (1 day)

**Solution: Coverage-aware rotation**
```typescript
const getNextRotationAssignee = (task: Task, lastAssignment: TaskAssignment) => {
  const coverageDays = lastAssignment.coverage_end_date
    ? differenceInDays(
        new Date(lastAssignment.coverage_end_date),
        new Date(lastAssignment.due_datetime)
      )
    : 1;

  // Skip rotation by coverage days
  const rotation = task.recurrence_pattern.rotation;
  const currentIndex = rotation.members.indexOf(lastAssignment.assigned_to);
  const skipCount = Math.floor(coverageDays / rotation.members.length);
  const nextIndex = (currentIndex + 1 + skipCount) % rotation.members.length;

  return rotation.members[nextIndex];
};
```

### 4. Task Completion Logic

**Scenario:** Complete meal prep on Sunday, what happens to Mon-Wed?

**Solution:**
```typescript
const completeTaskWithCoverage = async (assignment: TaskAssignment) => {
  // 1. Mark main assignment as completed
  await supabase
    .from('task_assignments')
    .update({ status: 'completed', completed_at: new Date() })
    .eq('id', assignment.id);

  // 2. If has coverage, create completion record with metadata
  if (assignment.coverage_end_date) {
    await supabase.from('task_completions').insert({
      assignment_id: assignment.id,
      completed_by: assignment.assigned_to,
      completed_at: new Date(),
      points_awarded: assignment.task.points,
      metadata: {
        coverage_days: differenceInDays(
          new Date(assignment.coverage_end_date),
          new Date(assignment.due_datetime)
        )
      }
    });
  }

  // 3. Calendar will automatically show coverage on covered days
  // No need to create child assignments!
};
```

## Implementation Checklist

### Phase 3 (Calendar) - Minimal Coverage Support

- [ ] Add `coverage_end_date` column to `task_assignments`
- [ ] Add `coverageDays` to task recurrence_pattern metadata
- [ ] Update `generateRecurringInstances()` to calculate coverage_end_date
- [ ] Update `useFullCalendarEvents()` to generate background coverage events
- [ ] Update `CustomEventContent` to show coverage badges
- [ ] Add visual indicators (light green background for covered days)

### Phase 4 (Advanced) - Full Coverage Features

- [ ] Coverage conflict detection UI
- [ ] Coverage-aware rotation algorithm
- [ ] "Override coverage" feature (cook fresh on covered day)
- [ ] Coverage analytics (who covers most days?)
- [ ] Batch task creation UI ("Create task that covers X days")

## Recommendation Summary

**Use Hybrid Approach (Option 1 + 4):**

1. **Database:** Add `coverage_end_date` to track coverage period
2. **Display:** Generate virtual background events for covered days
3. **Points:** Award once on completion (no complex splitting)
4. **Rotation:** Coverage-aware rotation (fair distribution)
5. **UI:** Clear visual indicators (badges, background colors)

**Benefits:**
- ✅ Simple database schema (1 extra column)
- ✅ Clear ownership and accountability
- ✅ Fair point distribution
- ✅ Flexible calendar visualization
- ✅ Easy to maintain and understand

---

**Status:** Design Complete - Ready for Implementation
**Next:** Add coverage support to Phase 3 calendar implementation
**Decision:** Use coverage_end_date + virtual calendar events approach
