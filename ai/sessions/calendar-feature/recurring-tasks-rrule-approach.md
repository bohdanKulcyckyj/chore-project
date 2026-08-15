# Recurring Tasks - rrule.js Implementation

**Date:** 2025-10-04
**Context:** Calendar Feature - Robust Recurrence with Industry Standard
**Status:** Design & Implementation Plan

## Executive Summary

Use **rrule.js** library for recurring tasks - an RFC 5545 compliant, TypeScript-native library that handles all edge cases and integrates seamlessly with FullCalendar.

## Why rrule.js?

### Key Advantages

✅ **Industry Standard** - RFC 5545 (iCalendar) compliance
✅ **TypeScript Native** - Full type safety and IntelliSense
✅ **Battle-Tested** - Port of Python's excellent dateutil.rrule
✅ **Natural Language** - Parse/serialize to human-readable text
✅ **FullCalendar Plugin** - Official integration available
✅ **Comprehensive** - Handles DST, timezones, leap years, all edge cases
✅ **Small Bundle** - ~20KB minified
✅ **Active Maintenance** - Well-maintained, popular library (6k+ GitHub stars)

### Research Findings

- **Most Popular** - rrule.js is the go-to library for recurring events in JavaScript
- **Used by Major Apps** - Google Calendar-style apps, Nylas, and many SaaS products use RRULE format
- **FullCalendar Official Plugin** - `@fullcalendar/rrule` provides seamless integration
- **Community Support** - Large ecosystem, lots of examples and help available

## Installation

```bash
npm install rrule
npm install @fullcalendar/rrule  # For FullCalendar integration
```

## Database Schema (Updated)

### Simplified recurrence_pattern Field

Store RRULE string directly in JSONB:

```sql
-- tasks table already has this:
recurrence_pattern jsonb DEFAULT '{}'
```

**Pattern storage format:**
```json
{
  "rrule": "FREQ=DAILY;INTERVAL=1;UNTIL=20251231T090000Z",
  "timezone": "America/New_York",
  "dtstart": "2025-10-04T09:00:00Z"
}
```

**Or for rotation/assignment:**
```json
{
  "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  "timezone": "UTC",
  "dtstart": "2025-10-04T18:00:00Z",
  "rotation": {
    "members": ["user-1", "user-2", "user-3"],
    "startIndex": 0
  }
}
```

## rrule.js Usage Examples

### 1. Daily Recurrence

**Every day at 9am:**
```typescript
import { RRule } from 'rrule';

const rule = new RRule({
  freq: RRule.DAILY,
  dtstart: new Date(Date.UTC(2025, 9, 4, 9, 0, 0)),
  until: new Date(Date.UTC(2025, 11, 31, 9, 0, 0))
});

// Get all occurrences
const dates = rule.all();

// Get occurrences in date range (for calendar view)
const calendarDates = rule.between(
  new Date(2025, 9, 1),  // Oct 1
  new Date(2025, 9, 31)  // Oct 31
);

// Convert to RRULE string (store in DB)
const rruleString = rule.toString();
// "DTSTART:20251004T090000Z\nRRULE:FREQ=DAILY;UNTIL=20251231T090000Z"

// Natural language
rule.toText();
// "every day until December 31, 2025"
```

### 2. Weekly Recurrence

**Every Monday, Wednesday, Friday:**
```typescript
const rule = new RRule({
  freq: RRule.WEEKLY,
  byweekday: [RRule.MO, RRule.WE, RRule.FR],
  dtstart: new Date(2025, 9, 1),
  count: 20  // 20 occurrences then stop
});

rule.toText();
// "every week on Monday, Wednesday, Friday for 20 times"
```

**Every 2 weeks on Tuesday:**
```typescript
const rule = new RRule({
  freq: RRule.WEEKLY,
  interval: 2,
  byweekday: [RRule.TU],
  dtstart: new Date(2025, 9, 1)
});
```

### 3. Monthly Recurrence

**15th of every month:**
```typescript
const rule = new RRule({
  freq: RRule.MONTHLY,
  bymonthday: 15,
  dtstart: new Date(2025, 9, 1)
});

rule.toText();
// "monthly on the 15th"
```

**First Monday of every month:**
```typescript
const rule = new RRule({
  freq: RRule.MONTHLY,
  byweekday: [RRule.MO.nth(1)],  // First Monday
  dtstart: new Date(2025, 9, 1)
});

rule.toText();
// "monthly on the 1st Monday"
```

**Last Friday of every month:**
```typescript
const rule = new RRule({
  freq: RRule.MONTHLY,
  byweekday: [RRule.FR.nth(-1)],  // Last Friday
  dtstart: new Date(2025, 9, 1)
});
```

### 4. Complex Patterns

**Every weekday (Mon-Fri):**
```typescript
const rule = new RRule({
  freq: RRule.WEEKLY,
  byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
  dtstart: new Date(2025, 9, 1)
});

rule.toText();
// "every week on Monday, Tuesday, Wednesday, Thursday, Friday"
```

**Every 3rd day for 30 occurrences:**
```typescript
const rule = new RRule({
  freq: RRule.DAILY,
  interval: 3,
  count: 30,
  dtstart: new Date(2025, 9, 1)
});
```

### 5. Parsing RRULE Strings

**From database to RRule object:**
```typescript
// Stored in DB
const dbPattern = {
  rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20251231T000000Z",
  dtstart: "2025-10-04T18:00:00Z"
};

// Parse to RRule
const rule = RRule.fromString(dbPattern.rrule);

// Or construct from full string
const fullString = `DTSTART:${dbPattern.dtstart}\nRRULE:${dbPattern.rrule}`;
const rule2 = RRule.fromString(fullString);
```

## Implementation in Our Codebase

### 1. Recurrence Utility Functions

```typescript
// src/lib/utils/recurrence.ts
import { RRule, RRuleSet, rrulestr } from 'rrule';
import { Tables } from '../supabase';

export interface RecurrencePattern {
  rrule: string;            // RRULE string
  dtstart: string;          // ISO datetime string
  timezone?: string;        // IANA timezone
  rotation?: {
    members: string[];
    startIndex: number;
  };
  exceptions?: string[];    // ISO dates to skip
}

/**
 * Generate task instances for calendar view using rrule.js
 */
export const generateRecurringInstances = (
  task: Tables<'tasks'>,
  startDate: Date,
  endDate: Date
): TaskAssignment[] => {
  // Return empty if not recurring
  if (task.recurrence_type === 'none' || !task.recurrence_pattern) {
    return [];
  }

  const pattern = task.recurrence_pattern as RecurrencePattern;

  try {
    // Parse RRULE from database
    const rruleString = `DTSTART:${pattern.dtstart}\nRRULE:${pattern.rrule}`;
    const rule = rrulestr(rruleString);

    // Handle exceptions (skipped dates)
    if (pattern.exceptions && pattern.exceptions.length > 0) {
      const rruleSet = new RRuleSet();
      rruleSet.rrule(rule);

      // Add exception dates
      pattern.exceptions.forEach(exdate => {
        rruleSet.exdate(new Date(exdate));
      });

      // Get occurrences in range
      const occurrences = rruleSet.between(startDate, endDate, true);
      return buildInstances(task, occurrences, pattern);
    }

    // Get occurrences in range (no exceptions)
    const occurrences = rule.between(startDate, endDate, true);
    return buildInstances(task, occurrences, pattern);

  } catch (error) {
    console.error('Error parsing RRULE:', error);
    return [];
  }
};

/**
 * Build task assignment instances from occurrence dates
 */
const buildInstances = (
  task: Tables<'tasks'>,
  occurrences: Date[],
  pattern: RecurrencePattern
): TaskAssignment[] => {
  return occurrences.map((date, index) => {
    const assignedTo = getAssigneeForOccurrence(task, pattern, index);

    return {
      id: `generated-${task.id}-${date.toISOString()}`,
      task_id: task.id,
      due_datetime: date.toISOString(),
      status: 'unassigned',
      assigned_to: assignedTo,
      task: task,  // Include full task details
      // Note: This is a generated instance, not in DB
      _isGenerated: true
    };
  });
};

/**
 * Determine assignee based on task assignment type
 */
const getAssigneeForOccurrence = (
  task: Tables<'tasks'>,
  pattern: RecurrencePattern,
  occurrenceIndex: number
): string | null => {
  if (task.assignment_type === 'fixed') {
    // Fixed assignment - same person always
    return pattern.rotation?.members[0] || null;
  }

  if (task.assignment_type === 'rotating' && pattern.rotation) {
    // Rotating assignment - round-robin
    const { members, startIndex } = pattern.rotation;
    const memberIndex = (startIndex + occurrenceIndex) % members.length;
    return members[memberIndex];
  }

  // Flexible - unassigned
  return null;
};

/**
 * Get human-readable recurrence text
 */
export const getRecurrenceText = (pattern: RecurrencePattern): string => {
  try {
    const rruleString = `DTSTART:${pattern.dtstart}\nRRULE:${pattern.rrule}`;
    const rule = rrulestr(rruleString);
    return rule.toText();
  } catch {
    return 'Custom recurrence';
  }
};

/**
 * Validate RRULE string
 */
export const validateRRule = (rruleString: string): boolean => {
  try {
    rrulestr(rruleString);
    return true;
  } catch {
    return false;
  }
};
```

### 2. Integration with useCalendarData Hook

```typescript
// src/components/calendar/hooks/useCalendarData.tsx
import { generateRecurringInstances } from '@/lib/utils/recurrence';

export const useCalendarData = (dateRange: { start: Date; end: Date }) => {
  const { currentHousehold } = useHousehold();
  const [tasks, setTasks] = useState<TaskWithAssignment[]>([]);

  const fetchCalendarData = async () => {
    if (!currentHousehold) return;

    // 1. Fetch all recurring task templates
    const { data: recurringTasks } = await supabase
      .from('tasks')
      .select('*, task_categories(*)')
      .eq('household_id', currentHousehold.id)
      .neq('recurrence_type', 'none')
      .eq('is_active', true);

    // 2. Fetch existing task assignments in range
    const { data: existingAssignments } = await supabase
      .from('task_assignments')
      .select('*, tasks!inner(*, task_categories(*)), user_profiles(*)')
      .eq('tasks.household_id', currentHousehold.id)
      .gte('due_datetime', dateRange.start.toISOString())
      .lte('due_datetime', dateRange.end.toISOString());

    // 3. Generate recurring instances using rrule.js
    const generatedInstances = recurringTasks?.flatMap(task =>
      generateRecurringInstances(task, dateRange.start, dateRange.end)
    ) || [];

    // 4. Filter out generated instances that exist in DB
    const existingKeys = new Set(
      existingAssignments?.map(a => `${a.task_id}-${a.due_datetime}`) || []
    );

    const uniqueGenerated = generatedInstances.filter(gen =>
      !existingKeys.has(`${gen.task_id}-${gen.due_datetime}`)
    );

    // 5. Combine and return
    setTasks([...(existingAssignments || []), ...uniqueGenerated]);
  };

  useEffect(() => {
    fetchCalendarData();
  }, [currentHousehold, dateRange]);

  return { tasks, loading, error };
};
```

### 3. FullCalendar Integration (Official Plugin)

```typescript
// Calendar.tsx with rrule plugin
import FullCalendar from '@fullcalendar/react';
import rrulePlugin from '@fullcalendar/rrule';

const Calendar = () => {
  // ... other code

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}

      // Pass recurring events with rrule directly
      events={[
        {
          id: 'task-123',
          title: 'Make Dinner',
          rrule: {
            freq: 'daily',
            dtstart: '2025-10-04T18:00:00',
            until: '2025-12-31'
          },
          duration: '01:00'
        }
      ]}

      // ... rest of config
    />
  );
};
```

## Recurrence Builder UI Components

### Basic Recurrence Form

```typescript
// components/RecurrenceBuilder.tsx
import { RRule } from 'rrule';
import { useState } from 'react';

const RecurrenceBuilder = ({ onChange }) => {
  const [freq, setFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [interval, setInterval] = useState(1);
  const [byweekday, setByweekday] = useState<number[]>([]);
  const [until, setUntil] = useState<Date | null>(null);

  const buildRRule = () => {
    const options: any = {
      freq: RRule[freq],
      interval,
      dtstart: new Date()
    };

    if (freq === 'WEEKLY' && byweekday.length > 0) {
      options.byweekday = byweekday.map(d => RRule[['SU','MO','TU','WE','TH','FR','SA'][d]]);
    }

    if (until) {
      options.until = until;
    }

    const rule = new RRule(options);

    onChange({
      rrule: rule.toString().split('\n')[1].replace('RRULE:', ''),
      dtstart: options.dtstart.toISOString()
    });
  };

  return (
    <div className="space-y-4">
      {/* Frequency selector */}
      <Select value={freq} onValueChange={setFreq}>
        <SelectItem value="DAILY">Daily</SelectItem>
        <SelectItem value="WEEKLY">Weekly</SelectItem>
        <SelectItem value="MONTHLY">Monthly</SelectItem>
      </Select>

      {/* Interval */}
      <div>
        <Label>Repeat every</Label>
        <Input
          type="number"
          value={interval}
          onChange={(e) => setInterval(parseInt(e.target.value))}
          min={1}
        />
      </div>

      {/* Weekly: Day selector */}
      {freq === 'WEEKLY' && (
        <div>
          <Label>Repeat on</Label>
          <div className="flex gap-2">
            {['S','M','T','W','T','F','S'].map((day, i) => (
              <Button
                key={i}
                variant={byweekday.includes(i) ? 'default' : 'outline'}
                onClick={() => {
                  setByweekday(prev =>
                    prev.includes(i)
                      ? prev.filter(d => d !== i)
                      : [...prev, i]
                  );
                }}
              >
                {day}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="bg-gray-50 p-3 rounded">
        <p className="text-sm text-gray-600">Preview:</p>
        <p className="font-medium">{new RRule(buildRRule()).toText()}</p>
      </div>
    </div>
  );
};
```

## Migration from Old Pattern Format

If you have existing custom patterns, migrate them:

```typescript
// Migration utility
const migrateToRRule = (oldPattern: any): RecurrencePattern => {
  const { frequency, interval = 1, daysOfWeek, time } = oldPattern;

  let rruleOptions: any = {
    freq: frequency === 'daily' ? RRule.DAILY :
          frequency === 'weekly' ? RRule.WEEKLY :
          RRule.MONTHLY,
    interval,
    dtstart: new Date()
  };

  if (frequency === 'weekly' && daysOfWeek) {
    const weekdayMap = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
    rruleOptions.byweekday = daysOfWeek.map((d: number) => weekdayMap[d]);
  }

  const rule = new RRule(rruleOptions);

  return {
    rrule: rule.toString().split('\n')[1].replace('RRULE:', ''),
    dtstart: rruleOptions.dtstart.toISOString()
  };
};
```

## Testing Strategy

```typescript
// recurrence.test.ts
import { RRule } from 'rrule';
import { generateRecurringInstances } from './recurrence';

describe('Recurrence with rrule.js', () => {
  it('should generate daily instances', () => {
    const task = {
      id: 'task-1',
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

  it('should handle weekly recurrence with specific days', () => {
    const rule = new RRule({
      freq: RRule.WEEKLY,
      byweekday: [RRule.MO, RRule.WE, RRule.FR],
      dtstart: new Date(2025, 9, 1),
      count: 12
    });

    const dates = rule.all();
    expect(dates.length).toBe(12);

    // Verify all are Mon/Wed/Fri
    dates.forEach(date => {
      const day = date.getDay();
      expect([1, 3, 5]).toContain(day);
    });
  });

  it('should exclude exception dates', () => {
    const rruleSet = new RRuleSet();
    rruleSet.rrule(new RRule({
      freq: RRule.DAILY,
      dtstart: new Date(2025, 9, 1),
      count: 7
    }));

    // Skip Oct 3rd (holiday)
    rruleSet.exdate(new Date(2025, 9, 3));

    const dates = rruleSet.all();
    expect(dates.length).toBe(6);  // 7 - 1 exception
  });
});
```

## Implementation Plan for Calendar Phase 3

### What to Include Now

1. ✅ **Install rrule.js** - Add dependency
2. ✅ **Create recurrence utilities** - generateRecurringInstances(), etc.
3. ✅ **Update useCalendarData** - Integrate rrule generation
4. ✅ **Visual indicators** - Show 🔁 for recurring tasks
5. ✅ **Natural language display** - Use rule.toText() in UI

### Defer to Phase 4

- ⏸️ Recurrence Builder UI (complex form)
- ⏸️ Edit recurrence dialog
- ⏸️ Exception date picker (holidays)
- ⏸️ Rotation configuration UI

## Benefits Summary

✅ **Robust** - Handles all edge cases (DST, leap years, complex patterns)
✅ **Standard** - RFC 5545 = interoperable with other calendar systems
✅ **Maintainable** - Library handles complexity, not our code
✅ **Flexible** - Can represent any recurrence pattern
✅ **Future-proof** - Easy to add UI later, backend is solid
✅ **TypeScript** - Full type safety
✅ **Performant** - Optimized C-style loop implementations

---

**Status:** Design Complete - Ready for Implementation
**Next:** Install rrule.js and implement utilities in Phase 3
**Decision:** Use rrule.js as the foundation for all recurring task logic
