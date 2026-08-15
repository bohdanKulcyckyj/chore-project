# Phase 3.5: rrule.js Recurrence Implementation

**Date:** 2025-10-04
**Session:** 04
**Parent:** `calendar-plan.md`
**Focus:** Implement recurring tasks using rrule.js library
**Status:** Ready for Implementation

## Objective

Implement robust recurring task generation using the industry-standard rrule.js library for the calendar view.

## Database Schema Review

### Current Schema (Already Supports Recurrence)

```sql
-- tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  household_id uuid,
  name text NOT NULL,
  description text,

  -- Recurrence fields (existing)
  recurrence_type text DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_pattern jsonb DEFAULT '{}',

  -- Assignment strategy
  assignment_type text DEFAULT 'flexible' CHECK (assignment_type IN ('fixed', 'rotating', 'flexible')),

  -- Other fields...
  category_id uuid,
  difficulty text,
  estimated_duration integer,
  points integer,
  requires_approval boolean,
  is_active boolean
);
```

### Proposed recurrence_pattern Format (JSONB)

**Option 1: Store RRULE string directly (RECOMMENDED)**
```json
{
  "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR;DTSTART=20251004T180000Z",
  "timezone": "America/New_York"
}
```

**Option 2: Store rrule.js options object**
```json
{
  "freq": 2,
  "byweekday": [0, 2, 4],
  "dtstart": "2025-10-04T18:00:00Z",
  "interval": 1,
  "until": "2025-12-31T23:59:59Z"
}
```

**Option 3: Hybrid (for UI convenience)**
```json
{
  "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  "dtstart": "2025-10-04T18:00:00Z",
  "timezone": "America/New_York",
  "humanText": "every week on Monday, Wednesday, Friday"
}
```

**Recommendation:** Use Option 3 (Hybrid)
- `rrule` string for processing
- `dtstart` separate for clarity
- `humanText` cached for display (optional)
- `timezone` for proper datetime handling

### Assignment Pattern (for rotating tasks)

```json
{
  "rrule": "FREQ=DAILY;DTSTART=20251004T180000Z",
  "timezone": "UTC",
  "rotation": {
    "enabled": true,
    "members": ["user-id-1", "user-id-2", "user-id-3"],
    "startIndex": 0,
    "strategy": "round-robin"
  }
}
```

## Installation

```bash
npm install rrule
npm install @fullcalendar/rrule  # For FullCalendar integration
```

**Package versions:**
- `rrule@^2.8.1` - Latest stable, TypeScript support
- `@fullcalendar/rrule@^6.1.19` - Matches FullCalendar version

## Implementation Files

### 1. Recurrence Utilities

**File:** `src/lib/utils/recurrence.ts`

```typescript
import { RRule, RRuleSet, rrulestr, Frequency } from 'rrule';
import { Tables } from '../supabase';

export interface RecurrencePattern {
  rrule: string;
  dtstart: string;
  timezone?: string;
  humanText?: string;
  rotation?: {
    enabled: boolean;
    members: string[];
    startIndex: number;
    strategy: 'round-robin' | 'random' | 'fixed';
  };
  exceptions?: string[];  // ISO dates to exclude
}

export interface TaskWithRecurrence extends Tables<'tasks'> {
  recurrence_pattern: RecurrencePattern | null;
}

/**
 * Generate task instances for a date range using rrule.js
 */
export const generateRecurringInstances = (
  task: TaskWithRecurrence,
  startDate: Date,
  endDate: Date
): Array<{
  id: string;
  task_id: string;
  task: TaskWithRecurrence;
  due_datetime: string;
  assigned_to: string | null;
  status: string;
  _isGenerated: boolean;
}> => {
  // Skip if not recurring
  if (task.recurrence_type === 'none' || !task.recurrence_pattern) {
    return [];
  }

  const pattern = task.recurrence_pattern;

  try {
    // Build full RRULE string
    const rruleString = pattern.dtstart
      ? `DTSTART:${pattern.dtstart.replace(/[-:]/g, '').replace('.000Z', 'Z')}\nRRULE:${pattern.rrule}`
      : `RRULE:${pattern.rrule}`;

    // Parse RRULE
    const rule = rrulestr(rruleString);

    // Handle exceptions (exdates)
    let occurrences: Date[];
    if (pattern.exceptions && pattern.exceptions.length > 0) {
      const rruleSet = new RRuleSet();
      rruleSet.rrule(rule);

      pattern.exceptions.forEach(exdate => {
        rruleSet.exdate(new Date(exdate));
      });

      occurrences = rruleSet.between(startDate, endDate, true);
    } else {
      occurrences = rule.between(startDate, endDate, true);
    }

    // Build task instances
    return occurrences.map((date, index) => {
      const assignedTo = getAssigneeForOccurrence(task, pattern, index);

      return {
        id: `generated-${task.id}-${date.toISOString()}`,
        task_id: task.id,
        task: task,
        due_datetime: date.toISOString(),
        assigned_to: assignedTo,
        status: assignedTo ? 'pending' : 'unassigned',
        _isGenerated: true  // Flag to identify generated instances
      };
    });
  } catch (error) {
    console.error('Error generating recurring instances:', error, task);
    return [];
  }
};

/**
 * Determine assignee based on task assignment strategy
 */
const getAssigneeForOccurrence = (
  task: TaskWithRecurrence,
  pattern: RecurrencePattern,
  occurrenceIndex: number
): string | null => {
  // Fixed assignment
  if (task.assignment_type === 'fixed' && pattern.rotation?.members[0]) {
    return pattern.rotation.members[0];
  }

  // Rotating assignment
  if (task.assignment_type === 'rotating' && pattern.rotation?.enabled) {
    const { members, startIndex, strategy } = pattern.rotation;

    if (strategy === 'round-robin') {
      const memberIndex = (startIndex + occurrenceIndex) % members.length;
      return members[memberIndex];
    }

    if (strategy === 'random') {
      return members[Math.floor(Math.random() * members.length)];
    }
  }

  // Flexible - unassigned
  return null;
};

/**
 * Get human-readable recurrence description
 */
export const getRecurrenceText = (pattern: RecurrencePattern | null): string => {
  if (!pattern) return 'Does not repeat';

  // Return cached if available
  if (pattern.humanText) {
    return pattern.humanText;
  }

  try {
    const rruleString = pattern.dtstart
      ? `DTSTART:${pattern.dtstart.replace(/[-:]/g, '').replace('.000Z', 'Z')}\nRRULE:${pattern.rrule}`
      : `RRULE:${pattern.rrule}`;

    const rule = rrulestr(rruleString);
    return rule.toText();
  } catch {
    return 'Custom recurrence';
  }
};

/**
 * Validate RRULE string
 */
export const validateRRule = (rruleString: string): { valid: boolean; error?: string } => {
  try {
    rrulestr(`RRULE:${rruleString}`);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid RRULE'
    };
  }
};

/**
 * Build RRULE from simple options (helper for UI)
 */
export const buildRRule = (options: {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  byweekday?: number[];  // 0=Mon, 1=Tue, ..., 6=Sun (RRule format)
  bymonthday?: number;
  count?: number;
  until?: Date;
  dtstart?: Date;
}): RecurrencePattern => {
  const rruleOptions: any = {
    freq: Frequency[options.freq],
    interval: options.interval || 1
  };

  if (options.byweekday && options.byweekday.length > 0) {
    const weekdayMap = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
    rruleOptions.byweekday = options.byweekday.map(d => weekdayMap[d]);
  }

  if (options.bymonthday) {
    rruleOptions.bymonthday = options.bymonthday;
  }

  if (options.count) {
    rruleOptions.count = options.count;
  }

  if (options.until) {
    rruleOptions.until = options.until;
  }

  if (options.dtstart) {
    rruleOptions.dtstart = options.dtstart;
  }

  const rule = new RRule(rruleOptions);
  const rruleString = rule.toString();
  const parts = rruleString.split('\n');

  return {
    rrule: parts[1].replace('RRULE:', ''),
    dtstart: options.dtstart?.toISOString() || new Date().toISOString(),
    humanText: rule.toText()
  };
};

/**
 * Parse existing pattern to editable options (for UI)
 */
export const parseRRuleToOptions = (pattern: RecurrencePattern) => {
  try {
    const rruleString = pattern.dtstart
      ? `DTSTART:${pattern.dtstart.replace(/[-:]/g, '').replace('.000Z', 'Z')}\nRRULE:${pattern.rrule}`
      : `RRULE:${pattern.rrule}`;

    const rule = rrulestr(rruleString) as RRule;
    const options = rule.origOptions;

    return {
      freq: Frequency[options.freq] as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
      interval: options.interval || 1,
      byweekday: options.byweekday
        ? (Array.isArray(options.byweekday) ? options.byweekday : [options.byweekday]).map((wd: any) =>
            typeof wd === 'number' ? wd : wd.weekday
          )
        : undefined,
      bymonthday: options.bymonthday,
      count: options.count,
      until: options.until,
      dtstart: options.dtstart
    };
  } catch (error) {
    console.error('Error parsing RRULE:', error);
    return null;
  }
};
```

### 2. Update useCalendarData Hook

**File:** `src/components/calendar/hooks/useCalendarData.tsx`

```typescript
import { useState, useEffect, useMemo } from 'react';
import { supabase, Tables } from '@/lib/supabase';
import { useHousehold } from '@/hooks/useHousehold';
import { generateRecurringInstances } from '@/lib/utils/recurrence';

export const useCalendarData = (dateRange: { start: Date; end: Date }) => {
  const { currentHousehold } = useHousehold();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendarData = async () => {
    if (!currentHousehold) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch recurring task templates
      const { data: recurringTasks, error: recurringError } = await supabase
        .from('tasks')
        .select('*, task_categories(*)')
        .eq('household_id', currentHousehold.id)
        .neq('recurrence_type', 'none')
        .eq('is_active', true);

      if (recurringError) throw recurringError;

      // 2. Fetch existing task assignments in range
      const { data: existingAssignments, error: assignmentsError } = await supabase
        .from('task_assignments')
        .select('*, tasks!inner(*, task_categories(*)), user_profiles(*)')
        .eq('tasks.household_id', currentHousehold.id)
        .gte('due_datetime', dateRange.start.toISOString())
        .lte('due_datetime', dateRange.end.toISOString());

      if (assignmentsError) throw assignmentsError;

      // 3. Generate recurring instances using rrule.js
      const generatedInstances = recurringTasks?.flatMap(task =>
        generateRecurringInstances(task, dateRange.start, dateRange.end)
      ) || [];

      // 4. Filter out generated instances that already exist in DB
      const existingKeys = new Set(
        existingAssignments?.map(a => `${a.task_id}-${a.due_datetime}`) || []
      );

      const uniqueGenerated = generatedInstances.filter(gen =>
        !existingKeys.has(`${gen.task_id}-${gen.due_datetime}`)
      );

      // 5. Combine and set
      setTasks([...(existingAssignments || []), ...uniqueGenerated]);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [currentHousehold, dateRange.start, dateRange.end]);

  return {
    tasks,
    loading,
    error,
    refetch: fetchCalendarData
  };
};
```

### 3. TypeScript Types Update

**File:** `src/types/database.ts`

```typescript
// Update task_assignments to include generated flag
export interface TaskAssignment extends Tables<'task_assignments'> {
  task?: Tables<'tasks'> & {
    category?: Tables<'task_categories'>;
  };
  assigned_user?: Tables<'user_profiles'>;
  _isGenerated?: boolean;  // Flag for generated instances
}

// Recurrence pattern type
export interface RecurrencePattern {
  rrule: string;
  dtstart: string;
  timezone?: string;
  humanText?: string;
  rotation?: {
    enabled: boolean;
    members: string[];
    startIndex: number;
    strategy: 'round-robin' | 'random' | 'fixed';
  };
  exceptions?: string[];
}
```

## Testing Strategy

### Unit Tests

```typescript
// src/lib/utils/recurrence.test.ts
import { describe, it, expect } from 'vitest';
import { generateRecurringInstances, buildRRule, validateRRule } from './recurrence';

describe('Recurrence Utils', () => {
  it('should generate daily instances', () => {
    const task = {
      id: 'task-1',
      recurrence_type: 'daily',
      recurrence_pattern: {
        rrule: 'FREQ=DAILY;COUNT=7',
        dtstart: '2025-10-01T09:00:00Z'
      },
      assignment_type: 'flexible'
    };

    const instances = generateRecurringInstances(
      task as any,
      new Date('2025-10-01'),
      new Date('2025-10-31')
    );

    expect(instances.length).toBe(7);
    expect(instances[0].due_datetime).toBe('2025-10-01T09:00:00.000Z');
  });

  it('should handle weekly with specific days', () => {
    const task = {
      id: 'task-2',
      recurrence_type: 'weekly',
      recurrence_pattern: {
        rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12',
        dtstart: '2025-10-06T18:00:00Z'  // Monday
      },
      assignment_type: 'flexible'
    };

    const instances = generateRecurringInstances(
      task as any,
      new Date('2025-10-01'),
      new Date('2025-10-31')
    );

    expect(instances.length).toBe(12);

    // Verify all are Mon/Wed/Fri
    instances.forEach(inst => {
      const day = new Date(inst.due_datetime).getUTCDay();
      expect([1, 3, 5]).toContain(day);
    });
  });

  it('should rotate assignments round-robin', () => {
    const task = {
      id: 'task-3',
      recurrence_type: 'daily',
      recurrence_pattern: {
        rrule: 'FREQ=DAILY;COUNT=6',
        dtstart: '2025-10-01T09:00:00Z',
        rotation: {
          enabled: true,
          members: ['user-1', 'user-2', 'user-3'],
          startIndex: 0,
          strategy: 'round-robin'
        }
      },
      assignment_type: 'rotating'
    };

    const instances = generateRecurringInstances(
      task as any,
      new Date('2025-10-01'),
      new Date('2025-10-31')
    );

    expect(instances[0].assigned_to).toBe('user-1');
    expect(instances[1].assigned_to).toBe('user-2');
    expect(instances[2].assigned_to).toBe('user-3');
    expect(instances[3].assigned_to).toBe('user-1'); // Wraps around
  });

  it('should validate RRULE strings', () => {
    expect(validateRRule('FREQ=DAILY').valid).toBe(true);
    expect(validateRRule('FREQ=WEEKLY;BYDAY=MO,FR').valid).toBe(true);
    expect(validateRRule('INVALID').valid).toBe(false);
  });

  it('should build RRULE from options', () => {
    const pattern = buildRRule({
      freq: 'WEEKLY',
      byweekday: [0, 2, 4],  // Mon, Wed, Fri
      interval: 1,
      dtstart: new Date('2025-10-01T09:00:00Z')
    });

    expect(pattern.rrule).toContain('FREQ=WEEKLY');
    expect(pattern.rrule).toContain('BYDAY=MO,WE,FR');
    expect(pattern.humanText).toContain('Monday');
  });
});
```

### Sample Data for Testing

```typescript
// Test tasks with different recurrence patterns
const sampleRecurringTasks = [
  {
    id: 'task-daily',
    name: 'Make Dinner',
    recurrence_type: 'daily',
    recurrence_pattern: {
      rrule: 'FREQ=DAILY',
      dtstart: '2025-10-04T18:00:00Z',
      humanText: 'every day at 6:00 PM'
    },
    assignment_type: 'rotating',
    recurrence_pattern: {
      rrule: 'FREQ=DAILY',
      dtstart: '2025-10-04T18:00:00Z',
      rotation: {
        enabled: true,
        members: ['user-1', 'user-2', 'user-3'],
        startIndex: 0,
        strategy: 'round-robin'
      }
    }
  },
  {
    id: 'task-weekly',
    name: 'Clean Bathroom',
    recurrence_type: 'weekly',
    recurrence_pattern: {
      rrule: 'FREQ=WEEKLY;BYDAY=SA',
      dtstart: '2025-10-05T10:00:00Z',
      humanText: 'every week on Saturday'
    },
    assignment_type: 'flexible'
  },
  {
    id: 'task-monthly',
    name: 'Pay Bills',
    recurrence_type: 'monthly',
    recurrence_pattern: {
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
      dtstart: '2025-10-01T09:00:00Z',
      humanText: 'monthly on the 1st'
    },
    assignment_type: 'fixed',
    recurrence_pattern: {
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
      dtstart: '2025-10-01T09:00:00Z',
      rotation: {
        enabled: false,
        members: ['admin-user'],
        startIndex: 0,
        strategy: 'fixed'
      }
    }
  }
];
```

## Visual Indicators for Recurring Tasks

### Calendar Event Badge

```typescript
// In CustomEventContent component
const isRecurring = task.recurrence_type !== 'none';
const isGenerated = assignment._isGenerated;

<div className="flex items-center gap-1">
  {isRecurring && <span className="text-xs">🔁</span>}
  {task.name}
  {isGenerated && (
    <Badge variant="outline" className="text-xs">
      Auto
    </Badge>
  )}
</div>
```

### Recurrence Info in Task Detail Modal

```typescript
// Show recurrence pattern in modal
{task.recurrence_type !== 'none' && (
  <div className="bg-blue-50 p-3 rounded-lg">
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

## Implementation Checklist

### Phase 3 - Core Recurrence

- [ ] Install rrule.js packages
- [ ] Create `src/lib/utils/recurrence.ts` with utilities
- [ ] Update `useCalendarData` to generate recurring instances
- [ ] Add TypeScript types for RecurrencePattern
- [ ] Update CustomEventContent with recurring indicators
- [ ] Write unit tests for recurrence utilities
- [ ] Test with sample recurring tasks

### Phase 4 - Recurrence UI (Future)

- [ ] Create RecurrenceBuilder component
- [ ] Add "Edit Recurrence" dialog
- [ ] Implement exception dates picker (holidays)
- [ ] Add rotation configuration UI
- [ ] Create recurrence preview component

## Migration Strategy

### For Existing Tasks with Old Pattern Format

If tasks exist with old `recurrence_pattern` format:

```typescript
// Migration utility
const migrateOldPatternToRRule = async () => {
  const { data: oldTasks } = await supabase
    .from('tasks')
    .select('*')
    .neq('recurrence_type', 'none');

  for (const task of oldTasks || []) {
    const oldPattern = task.recurrence_pattern;

    // Convert to rrule format
    const newPattern = buildRRule({
      freq: oldPattern.frequency?.toUpperCase() as any,
      interval: oldPattern.interval || 1,
      byweekday: oldPattern.daysOfWeek,
      dtstart: new Date(oldPattern.time || '09:00')
    });

    await supabase
      .from('tasks')
      .update({ recurrence_pattern: newPattern })
      .eq('id', task.id);
  }
};
```

## Expected Behavior

### Calendar Load
1. User opens calendar (Oct 1-31)
2. System fetches recurring tasks
3. rrule.js generates instances for Oct 1-31
4. Filter out instances already in DB (completed/modified)
5. Display combined list in calendar

### Task Completion
1. User completes "Make Dinner - Oct 4"
2. Create record in `task_assignments` with status='completed'
3. Next calendar load: Generated instance for Oct 4 filtered out (exists in DB)
4. Oct 5 onward still show generated instances

### Rotation
1. "Make Dinner" rotates between 3 users
2. Oct 4 = User 1, Oct 5 = User 2, Oct 6 = User 3, Oct 7 = User 1...
3. Rotation persists across calendar views

---

**Status:** Design Complete - Ready for Implementation
**Next:** Install packages and implement recurrence utilities
**Estimated Time:** 4-6 hours for full implementation
