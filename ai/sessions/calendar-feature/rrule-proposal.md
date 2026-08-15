# Recurring Tasks with rrule.js - Implementation Proposal

**Date:** 2025-10-04
**Context:** Calendar Feature Phase 3
**Status:** Proposal for Review

## Executive Summary

Implement recurring tasks using **rrule.js**, an industry-standard library that implements the iCalendar RFC 5545 specification. This provides robust, battle-tested recurrence handling with minimal code complexity.

## Problem Statement

Users need to create recurring household tasks like:
- "Make dinner every day at 6pm"
- "Clean bathroom every Saturday morning"
- "Take out trash every Monday and Thursday"
- "Pay bills on the 1st of every month"
- "Rotate lawn mowing between household members weekly"

Current system has recurrence fields in database but no implementation.

## Proposed Solution

### 1. Use rrule.js Library

**Why rrule.js?**
- ✅ **RFC 5545 Compliant** - Industry standard iCalendar format
- ✅ **TypeScript Native** - Full type safety built-in
- ✅ **Battle-Tested** - 6,000+ GitHub stars, used by major calendar apps
- ✅ **Comprehensive** - Handles all edge cases (DST, timezones, leap years)
- ✅ **Natural Language** - Converts to human-readable text
- ✅ **FullCalendar Plugin** - Official integration available
- ✅ **Small Bundle** - ~20KB minified

**Installation:**
```bash
npm install rrule
npm install @fullcalendar/rrule
```

### 2. Database Schema (No Changes Required!)

Existing schema already supports recurrence:

```sql
-- tasks table (already exists)
CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  household_id uuid,
  name text,

  -- Recurrence fields (already exist)
  recurrence_type text DEFAULT 'none'
    CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_pattern jsonb DEFAULT '{}',

  -- Assignment strategy (already exists)
  assignment_type text DEFAULT 'flexible'
    CHECK (assignment_type IN ('fixed', 'rotating', 'flexible')),

  -- other fields...
);
```

### 3. recurrence_pattern Format (JSONB)

**Proposed format:**
```json
{
  "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  "dtstart": "2025-10-04T18:00:00Z",
  "timezone": "America/New_York",
  "humanText": "every week on Monday, Wednesday, Friday",
  "rotation": {
    "enabled": true,
    "members": ["user-id-1", "user-id-2", "user-id-3"],
    "startIndex": 0,
    "strategy": "round-robin"
  },
  "exceptions": ["2025-12-25T00:00:00Z"]
}
```

**Fields:**
- `rrule` - RRULE string (required)
- `dtstart` - Start date/time (required)
- `timezone` - IANA timezone (optional, defaults to UTC)
- `humanText` - Cached natural language (optional, for display)
- `rotation` - For rotating assignments (optional)
- `exceptions` - Dates to skip (optional, for holidays)

## Usage Examples

### Example 1: Daily Dinner (Rotating)

**Task Configuration:**
```json
{
  "name": "Make Dinner",
  "recurrence_type": "daily",
  "assignment_type": "rotating",
  "recurrence_pattern": {
    "rrule": "FREQ=DAILY",
    "dtstart": "2025-10-04T18:00:00Z",
    "humanText": "every day at 6:00 PM",
    "rotation": {
      "enabled": true,
      "members": ["alice-id", "bob-id", "charlie-id"],
      "startIndex": 0,
      "strategy": "round-robin"
    }
  }
}
```

**Generated Instances (Oct 4-7):**
```
Oct 4, 6pm - Make Dinner - Alice
Oct 5, 6pm - Make Dinner - Bob
Oct 6, 6pm - Make Dinner - Charlie
Oct 7, 6pm - Make Dinner - Alice (wraps around)
```

**Code:**
```typescript
import { RRule } from 'rrule';

const rule = new RRule({
  freq: RRule.DAILY,
  dtstart: new Date('2025-10-04T18:00:00Z')
});

const occurrences = rule.between(
  new Date('2025-10-04'),
  new Date('2025-10-07')
);
// Returns: [Oct4, Oct5, Oct6, Oct7] at 6pm each
```

### Example 2: Weekly Bathroom Cleaning

**Task Configuration:**
```json
{
  "name": "Clean Bathroom",
  "recurrence_type": "weekly",
  "assignment_type": "flexible",
  "recurrence_pattern": {
    "rrule": "FREQ=WEEKLY;BYDAY=SA",
    "dtstart": "2025-10-05T10:00:00Z",
    "humanText": "every week on Saturday at 10:00 AM"
  }
}
```

**Code:**
```typescript
const rule = new RRule({
  freq: RRule.WEEKLY,
  byweekday: [RRule.SA],
  dtstart: new Date('2025-10-05T10:00:00Z')
});

rule.toText(); // "every week on Saturday"
```

### Example 3: Trash Days (Mon & Thu)

**Task Configuration:**
```json
{
  "name": "Take Out Trash",
  "recurrence_type": "weekly",
  "recurrence_pattern": {
    "rrule": "FREQ=WEEKLY;BYDAY=MO,TH",
    "dtstart": "2025-10-06T19:00:00Z",
    "humanText": "every week on Monday, Thursday at 7:00 PM"
  }
}
```

**Code:**
```typescript
const rule = new RRule({
  freq: RRule.WEEKLY,
  byweekday: [RRule.MO, RRule.TH],
  dtstart: new Date('2025-10-06T19:00:00Z')
});
```

### Example 4: Monthly Bills (Fixed Assignment)

**Task Configuration:**
```json
{
  "name": "Pay Bills",
  "recurrence_type": "monthly",
  "assignment_type": "fixed",
  "recurrence_pattern": {
    "rrule": "FREQ=MONTHLY;BYMONTHDAY=1",
    "dtstart": "2025-10-01T09:00:00Z",
    "humanText": "monthly on the 1st at 9:00 AM",
    "rotation": {
      "enabled": false,
      "members": ["admin-id"],
      "strategy": "fixed"
    }
  }
}
```

**Code:**
```typescript
const rule = new RRule({
  freq: RRule.MONTHLY,
  bymonthday: 1,
  dtstart: new Date('2025-10-01T09:00:00Z')
});

rule.toText(); // "monthly on the 1st"
```

### Example 5: Complex - Every Other Week

**Task Configuration:**
```json
{
  "rrule": "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
  "dtstart": "2025-10-07T14:00:00Z",
  "humanText": "every 2 weeks on Tuesday at 2:00 PM"
}
```

**Code:**
```typescript
const rule = new RRule({
  freq: RRule.WEEKLY,
  interval: 2,
  byweekday: [RRule.TU],
  dtstart: new Date('2025-10-07T14:00:00Z')
});
```

## Technical Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Calendar View                      │
│  ┌───────────────────────────────────────────────┐ │
│  │  Oct 4   Oct 5   Oct 6   Oct 7   Oct 8       │ │
│  │  Dinner  Dinner  Dinner  Dinner  Dinner      │ │
│  │  Alice   Bob     Charlie Alice   Bob         │ │
│  │  🔁       🔁      🔁       🔁      🔁          │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                         ▲
                         │
         ┌───────────────┴────────────────┐
         │   useCalendarData Hook         │
         │  1. Fetch recurring tasks      │
         │  2. Generate instances (rrule) │
         │  3. Merge with DB assignments  │
         └───────────────┬────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │   Recurrence Utilities         │
         │  - generateRecurringInstances()│
         │  - getRecurrenceText()         │
         │  - buildRRule()                │
         └───────────────┬────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │         rrule.js               │
         │   RFC 5545 Implementation      │
         └────────────────────────────────┘
```

### Key Components

#### 1. Recurrence Utilities (`src/lib/utils/recurrence.ts`)

```typescript
import { RRule, rrulestr } from 'rrule';

/**
 * Generate task instances for calendar view
 */
export const generateRecurringInstances = (
  task: Task,
  startDate: Date,
  endDate: Date
) => {
  if (task.recurrence_type === 'none') return [];

  const pattern = task.recurrence_pattern;
  const rruleString = `DTSTART:${pattern.dtstart}\nRRULE:${pattern.rrule}`;
  const rule = rrulestr(rruleString);

  // Get occurrences in date range
  const occurrences = rule.between(startDate, endDate, true);

  // Build task instances
  return occurrences.map((date, index) => ({
    id: `generated-${task.id}-${date.toISOString()}`,
    task_id: task.id,
    task: task,
    due_datetime: date.toISOString(),
    assigned_to: getAssigneeForOccurrence(task, index),
    status: 'pending',
    _isGenerated: true
  }));
};

/**
 * Determine assignee based on rotation strategy
 */
const getAssigneeForOccurrence = (task: Task, occurrenceIndex: number) => {
  if (task.assignment_type === 'fixed') {
    return task.recurrence_pattern.rotation?.members[0] || null;
  }

  if (task.assignment_type === 'rotating') {
    const { members, startIndex } = task.recurrence_pattern.rotation;
    const memberIndex = (startIndex + occurrenceIndex) % members.length;
    return members[memberIndex];
  }

  return null; // Flexible - unassigned
};

/**
 * Get human-readable text
 */
export const getRecurrenceText = (pattern: RecurrencePattern) => {
  if (pattern.humanText) return pattern.humanText;

  const rruleString = `DTSTART:${pattern.dtstart}\nRRULE:${pattern.rrule}`;
  const rule = rrulestr(rruleString);
  return rule.toText(); // "every day at 6:00 PM"
};
```

#### 2. Calendar Data Hook (`useCalendarData.tsx`)

```typescript
export const useCalendarData = (dateRange: { start: Date; end: Date }) => {
  const { currentHousehold } = useHousehold();
  const [tasks, setTasks] = useState([]);

  const fetchCalendarData = async () => {
    // 1. Fetch recurring task templates
    const { data: recurringTasks } = await supabase
      .from('tasks')
      .select('*, task_categories(*)')
      .eq('household_id', currentHousehold.id)
      .neq('recurrence_type', 'none')
      .eq('is_active', true);

    // 2. Fetch existing assignments (DB records)
    const { data: existingAssignments } = await supabase
      .from('task_assignments')
      .select('*, tasks(*), user_profiles(*)')
      .eq('tasks.household_id', currentHousehold.id)
      .gte('due_datetime', dateRange.start.toISOString())
      .lte('due_datetime', dateRange.end.toISOString());

    // 3. Generate recurring instances using rrule.js
    const generatedInstances = recurringTasks?.flatMap(task =>
      generateRecurringInstances(task, dateRange.start, dateRange.end)
    ) || [];

    // 4. Filter duplicates (if instance exists in DB, don't show generated)
    const existingKeys = new Set(
      existingAssignments?.map(a => `${a.task_id}-${a.due_datetime}`)
    );

    const uniqueGenerated = generatedInstances.filter(gen =>
      !existingKeys.has(`${gen.task_id}-${gen.due_datetime}`)
    );

    // 5. Combine and display
    setTasks([...existingAssignments, ...uniqueGenerated]);
  };

  useEffect(() => {
    fetchCalendarData();
  }, [dateRange]);

  return { tasks, loading, error };
};
```

#### 3. Visual Indicators

**Calendar Event Display:**
```typescript
// CustomEventContent.tsx
const CustomEventContent = ({ eventInfo }) => {
  const assignment = eventInfo.event.extendedProps.assignment;
  const isRecurring = assignment.task.recurrence_type !== 'none';
  const isGenerated = assignment._isGenerated;

  return (
    <div className="p-2">
      <div className="flex items-center gap-1">
        {isRecurring && <span className="text-xs">🔁</span>}
        <span className="font-medium">{assignment.task.name}</span>
        {isGenerated && (
          <Badge variant="outline" size="xs">Auto</Badge>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {assignment.assigned_user?.display_name || 'Unassigned'}
      </div>
    </div>
  );
};
```

**Task Detail Modal:**
```typescript
{task.recurrence_type !== 'none' && (
  <div className="bg-blue-50 p-3 rounded">
    <div className="flex items-center gap-2 text-blue-800">
      <Repeat className="w-4 h-4" />
      <span className="font-medium">Recurring Task</span>
    </div>
    <p className="text-sm text-blue-700 mt-1">
      {getRecurrenceText(task.recurrence_pattern)}
    </p>
  </div>
)}
```

## Benefits

### For Users

✅ **Predictable Schedules** - Tasks automatically appear on calendar
✅ **Fair Rotation** - Automated round-robin assignment
✅ **Readable Patterns** - "every Monday and Thursday" instead of cryptic codes
✅ **Exception Handling** - Skip holidays automatically
✅ **No Manual Entry** - Create once, repeats forever

### For Development

✅ **Minimal Code** - Library handles complexity
✅ **Type Safety** - Full TypeScript support
✅ **Maintainable** - Standard format, well-documented
✅ **Extensible** - Easy to add UI later
✅ **Tested** - Battle-tested library with edge cases handled

### Technical Advantages

✅ **No Schema Changes** - Works with existing database
✅ **Lazy Generation** - Instances generated on-demand (no DB bloat)
✅ **Interoperable** - RFC 5545 = works with other calendar systems
✅ **Performance** - Efficient C-style implementations in rrule.js
✅ **Timezone Support** - Proper handling of DST and timezones

## Comparison with Alternatives

| Aspect | Custom Implementation | rrule.js (Proposed) |
|--------|----------------------|---------------------|
| **Development Time** | 2-3 weeks | 4-6 hours |
| **Code Complexity** | ~800 lines | ~200 lines |
| **Edge Cases** | Handle manually | Library handles |
| **Standards** | Custom format | RFC 5545 |
| **Maintenance** | High | Low |
| **Natural Language** | Build from scratch | Built-in |
| **Timezone Support** | Complex | Built-in |
| **Testing Needed** | Extensive | Minimal |

## Implementation Plan

### Phase 3 (Current) - Read-Only Recurrence

**Scope:** Display recurring tasks in calendar (4-6 hours)

1. ✅ Install rrule.js packages
2. ✅ Create recurrence utilities
3. ✅ Update useCalendarData hook
4. ✅ Add visual indicators
5. ✅ Test with sample data

**Deliverables:**
- Calendar shows recurring tasks correctly
- Rotation works properly
- Natural language display
- Visual indicators (🔁 badge)

### Phase 4 (Future) - Recurrence Creation UI

**Scope:** Allow users to create/edit recurring tasks (8-12 hours)

1. ⏸️ Build RecurrenceBuilder component
2. ⏸️ Create "Edit Recurrence" dialog
3. ⏸️ Add exception dates picker
4. ⏸️ Rotation configuration UI
5. ⏸️ Preview next occurrences

## Testing Strategy

### Unit Tests

```typescript
describe('Recurrence with rrule.js', () => {
  it('should generate daily instances', () => {
    const task = {
      recurrence_type: 'daily',
      recurrence_pattern: {
        rrule: 'FREQ=DAILY;COUNT=7',
        dtstart: '2025-10-01T09:00:00Z'
      }
    };

    const instances = generateRecurringInstances(
      task,
      new Date('2025-10-01'),
      new Date('2025-10-31')
    );

    expect(instances.length).toBe(7);
  });

  it('should rotate assignments', () => {
    const task = {
      assignment_type: 'rotating',
      recurrence_pattern: {
        rrule: 'FREQ=DAILY;COUNT=6',
        dtstart: '2025-10-01T09:00:00Z',
        rotation: {
          members: ['u1', 'u2', 'u3'],
          startIndex: 0,
          strategy: 'round-robin'
        }
      }
    };

    const instances = generateRecurringInstances(task, ...);

    expect(instances[0].assigned_to).toBe('u1');
    expect(instances[1].assigned_to).toBe('u2');
    expect(instances[2].assigned_to).toBe('u3');
    expect(instances[3].assigned_to).toBe('u1'); // Wraps
  });
});
```

### Integration Tests

- ✅ Calendar displays daily tasks correctly
- ✅ Weekly tasks appear on correct days
- ✅ Monthly tasks appear on correct date
- ✅ Rotation cycles through members
- ✅ Completed tasks don't regenerate
- ✅ Exception dates are skipped

### Sample Data

```javascript
// Create sample recurring tasks for testing
const sampleTasks = [
  {
    name: 'Make Dinner',
    recurrence_type: 'daily',
    recurrence_pattern: {
      rrule: 'FREQ=DAILY',
      dtstart: '2025-10-04T18:00:00Z',
      rotation: {
        enabled: true,
        members: ['alice', 'bob', 'charlie'],
        startIndex: 0,
        strategy: 'round-robin'
      }
    }
  },
  {
    name: 'Clean Bathroom',
    recurrence_type: 'weekly',
    recurrence_pattern: {
      rrule: 'FREQ=WEEKLY;BYDAY=SA',
      dtstart: '2025-10-05T10:00:00Z'
    }
  },
  {
    name: 'Pay Bills',
    recurrence_type: 'monthly',
    recurrence_pattern: {
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
      dtstart: '2025-11-01T09:00:00Z'
    }
  }
];
```

## Edge Cases Handled

### 1. Timezone Changes (DST)
- ✅ rrule.js handles automatically
- ✅ Use IANA timezones ("America/New_York")

### 2. Task Completion
- ✅ Create DB record on completion
- ✅ Future instances still generated
- ✅ Completed instance filtered out

### 3. Overlapping Instances
- ✅ DB instances take precedence
- ✅ Generated instances filtered out if exist

### 4. Calendar Range Changes
- ✅ Instances regenerated for new range
- ✅ Performance: rrule.js is optimized
- ✅ Only generate visible range

### 5. Rotation Fairness
- ✅ Round-robin wraps correctly
- ✅ Index persists across sessions
- ✅ Completed tasks don't break rotation

## Migration Path

### For Existing Systems

If tasks already exist with old pattern format:

```typescript
// One-time migration script
const migrateToRRule = async () => {
  const { data: oldTasks } = await supabase
    .from('tasks')
    .select('*')
    .neq('recurrence_type', 'none');

  for (const task of oldTasks) {
    const old = task.recurrence_pattern;

    // Convert to rrule format
    const newPattern = {
      rrule: buildRRuleString(old),
      dtstart: old.startDate || new Date().toISOString(),
      humanText: buildHumanText(old)
    };

    await supabase
      .from('tasks')
      .update({ recurrence_pattern: newPattern })
      .eq('id', task.id);
  }
};
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Learning curve for rrule.js | Low | Well-documented, simple API |
| Bundle size increase | Low | Only +20KB minified |
| Complex recurrence UI | Medium | Defer to Phase 4 |
| Performance with many tasks | Low | rrule.js is optimized |
| Timezone bugs | Low | Use library's built-in support |

## Success Criteria

**Phase 3 Complete When:**

✅ Daily tasks appear correctly on calendar
✅ Weekly tasks show on correct days
✅ Monthly tasks display properly
✅ Rotation cycles through members fairly
✅ Natural language displays ("every Monday")
✅ Visual indicators (🔁) work
✅ Completed tasks don't regenerate
✅ All tests pass

## Recommendation

**✅ Approve and Proceed**

This approach:
- Leverages industry-standard library
- Requires no schema changes
- Minimizes custom code
- Provides robust, tested solution
- Enables future UI enhancements
- Takes 4-6 hours to implement

**Next Steps:**
1. Review and approve this proposal
2. Install rrule.js packages
3. Implement recurrence utilities
4. Update calendar components
5. Test with sample data
6. Deploy to staging

---

**Status:** Awaiting Approval
**Estimated Effort:** 4-6 hours implementation
**Bundle Impact:** +20KB minified
**Schema Changes:** None required
