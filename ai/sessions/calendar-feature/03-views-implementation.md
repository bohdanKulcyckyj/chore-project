# Calendar Views Implementation

**Date:** 2025-08-23  
**Session:** 03  
**Parent:** `calendar-plan.md`  
**Focus:** Day, Week, and Month view components

## Objective

Implement the three main calendar view components (DayView, WeekView, MonthView) that display tasks in different time perspectives with consistent styling and interactions.

## View Components Overview

### 1. DayView Component

**File:** `src/components/calendar/views/DayView.tsx`

**Features:**
- 24-hour time slots (or configurable working hours)
- Tasks displayed in appropriate time slots
- Scrollable interface for long days
- Current time indicator
- Hour labels on the left side

**Layout:**
```
┌────┬─────────────────────────────────┐
│00:00│                                │
├────┼─────────────────────────────────┤  
│01:00│                                │
├────┼─────────────────────────────────┤
│02:00│ [Task Block: Kitchen Cleaning] │ ← Task at specific time
├────┼─────────────────────────────────┤
│03:00│                                │
└────┴─────────────────────────────────┘
```

### 2. WeekView Component  

**File:** `src/components/calendar/views/WeekView.tsx`

**Features:**
- 7-day grid layout (Sunday to Saturday)
- Time slots on Y-axis, days on X-axis
- Compact task blocks spanning time duration
- Day headers with dates
- All-day tasks section at top

**Layout:**
```
┌──────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Time │ Sun │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │
├──────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ 9:00 │     │[Tsk]│     │     │     │[Tsk]│     │
├──────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│10:00 │     │     │[Tsk]│     │     │     │     │
└──────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

### 3. MonthView Component

**File:** `src/components/calendar/views/MonthView.tsx`

**Features:**  
- Traditional month calendar grid
- 6 weeks x 7 days grid
- Tasks shown as small indicators/pills
- Day numbers in top-left of cells
- Overflow handling for many tasks

**Layout:**
```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│   Sun   │   Mon   │   Tue   │   Wed   │   Thu   │   Fri   │   Sat   │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│    1    │    2    │    3    │    4    │    5    │    6    │    7    │
│         │ •Task1  │         │ •Task2  │         │         │         │
│         │ •Task3  │         │ •Task4  │         │         │         │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│    8    │    9    │   10    │   11    │   12    │   13    │   14    │
│         │         │         │         │         │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

## Shared Components

### TaskBlock Component

**File:** `src/components/calendar/components/TaskBlock.tsx`

**Props:**
```typescript
interface TaskBlockProps {
  task: TaskWithAssignment;
  variant: 'day' | 'week' | 'month';
  onClick: (task: TaskWithAssignment) => void;
  className?: string;
}
```

**Variants:**
- **Day variant**: Full details with time, duration, description
- **Week variant**: Compact with title and time
- **Month variant**: Minimal pill with just title

### TimeSlot Component

**File:** `src/components/calendar/components/TimeSlot.tsx`

**Purpose:** Container for time-based slots in day and week views that handles multiple tasks per hour

**Props:**
```typescript
interface TimeSlotProps {
  hour: number;
  tasks: TaskWithAssignment[];
  onTaskClick: (task: TaskWithAssignment) => void;
  isCurrentHour?: boolean;
  variant: 'day' | 'week';
  maxVisibleTasks?: number; // Default 3 for day, 2 for week
}
```

**Multiple Tasks Handling:**
- Stacks tasks vertically within the hour slot
- Shows first N tasks fully, then "+X more" indicator
- Uses different layouts for day vs week views
- Implements overflow handling with scrolling or expanding

## Implementation Details

### DayView Implementation Structure

```typescript
import React from 'react';
import { format } from 'date-fns';
import TaskBlock from '../components/TaskBlock';
import TimeSlot from '../components/TimeSlot';

interface DayViewProps {
  date: Date;
  tasks: TaskWithAssignment[];
  onTaskClick: (task: TaskWithAssignment) => void;
}

const DayView: React.FC<DayViewProps> = ({ date, tasks, onTaskClick }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const currentHour = new Date().getHours();
  
  const getTasksForHour = (hour: number) => {
    return tasks.filter(task => {
      if (!task.due_datetime) return hour === 0; // All-day tasks at top
      
      // Calculate task start time: due_datetime - estimated_duration
      const dueTime = new Date(task.due_datetime);
      const durationMinutes = task.task.estimated_duration || 0;
      const startTime = new Date(dueTime.getTime() - (durationMinutes * 60 * 1000));
      const startHour = startTime.getHours();
      
      return startHour === hour;
    });
  };
  
  const sortTasksByStartTime = (tasks: TaskWithAssignment[]) => {
    return tasks.sort((a, b) => {
      if (!a.due_datetime && !b.due_datetime) return 0;
      if (!a.due_datetime) return -1; // All-day tasks first
      if (!b.due_datetime) return 1;
      
      // Calculate start times for both tasks
      const aDue = new Date(a.due_datetime);
      const aDuration = a.task.estimated_duration || 0;
      const aStart = new Date(aDue.getTime() - (aDuration * 60 * 1000));
      
      const bDue = new Date(b.due_datetime);
      const bDuration = b.task.estimated_duration || 0;
      const bStart = new Date(bDue.getTime() - (bDuration * 60 * 1000));
      
      return aStart.getTime() - bStart.getTime();
    });
  };
  
  return (
    <div className="day-view">
      <div className="day-header">
        <h2>{format(date, 'EEEE, MMMM dd, yyyy')}</h2>
      </div>
      
      <div className="time-grid">
        {hours.map(hour => {
          const hourTasks = getTasksForHour(hour);
          const sortedTasks = sortTasksByStartTime(hourTasks);
          
          return (
            <TimeSlot
              key={hour}
              hour={hour}
              tasks={sortedTasks}
              onTaskClick={onTaskClick}
              isCurrentHour={hour === currentHour}
              variant="day"
              maxVisibleTasks={3} // Show up to 3 tasks, then overflow
            />
          );
        })}
      </div>
    </div>
  );
};

export default DayView;
```

### WeekView Implementation Structure

```typescript
import React from 'react';
import { eachDayOfInterval, startOfWeek, endOfWeek, format } from 'date-fns';

const WeekView: React.FC<WeekViewProps> = ({ currentDate, tasks, onTaskClick }) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const getTasksForDayAndHour = (day: Date, hour: number) => {
    return tasks.filter(task => {
      if (!task.due_datetime) return false;
      const taskDate = new Date(task.due_datetime);
      return (
        taskDate.toDateString() === day.toDateString() &&
        taskDate.getHours() === hour
      );
    });
  };
  
  return (
    <div className="week-view">
      {/* Week header with days */}
      <div className="week-header">
        <div className="time-column-header"></div>
        {days.map(day => (
          <div key={day.toISOString()} className="day-header">
            <div className="day-name">{format(day, 'EEE')}</div>
            <div className="day-number">{format(day, 'd')}</div>
          </div>
        ))}
      </div>
      
      {/* Time grid */}
      <div className="week-grid">
        {hours.map(hour => (
          <div key={hour} className="hour-row">
            <div className="time-label">{format(new Date().setHours(hour, 0), 'HH:mm')}</div>
            {days.map(day => {
              const hourTasks = getTasksForDayAndHour(day, hour);
              const maxVisible = 2; // Max 2 tasks visible in week view
              const visibleTasks = hourTasks.slice(0, maxVisible);
              const overflowCount = hourTasks.length - maxVisible;
              
              return (
                <div key={`${day.toISOString()}-${hour}`} className="day-cell">
                  {visibleTasks.map(task => (
                    <TaskBlock
                      key={task.id}
                      task={task}
                      variant="week"
                      onClick={onTaskClick}
                    />
                  ))}
                  {overflowCount > 0 && (
                    <div className="task-overflow text-xs text-gray-500 px-1">
                      +{overflowCount} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### MonthView Implementation Structure

```typescript
import React from 'react';
import { 
  startOfMonth, 
  endOfMonth, 
  eachWeekOfInterval, 
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth
} from 'date-fns';

const MonthView: React.FC<MonthViewProps> = ({ currentDate, tasks, onTaskClick }) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Get all weeks in the month view (including partial weeks)
  const weeks = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 0 }
  );
  
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.due_datetime) return false;
      const taskDate = new Date(task.due_datetime);
      return taskDate.toDateString() === date.toDateString();
    });
  };
  
  return (
    <div className="month-view">
      {/* Month header */}
      <div className="month-header">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="day-name-header">{day}</div>
        ))}
      </div>
      
      {/* Month grid */}
      <div className="month-grid">
        {weeks.map(weekStart => {
          const days = eachDayOfInterval({
            start: startOfWeek(weekStart, { weekStartsOn: 0 }),
            end: endOfWeek(weekStart, { weekStartsOn: 0 })
          });
          
          return (
            <div key={weekStart.toISOString()} className="week-row">
              {days.map(day => {
                const dayTasks = getTasksForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`month-cell ${!isCurrentMonth ? 'other-month' : ''}`}
                  >
                    <div className="day-number">{format(day, 'd')}</div>
                    <div className="tasks-container">
                      {dayTasks.slice(0, 3).map(task => ( // Show max 3 tasks
                        <TaskBlock
                          key={task.id}
                          task={task}
                          variant="month"
                          onClick={onTaskClick}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="more-tasks">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

## Multiple Tasks Per Hour Slot Handling

### Task Stacking Strategy

**Day View:**
- Stack up to 3 tasks vertically within each hour slot
- Each task block takes ~25% of the hour slot height
- Overflow tasks shown as "+X more" indicator
- Click on overflow indicator shows full task list in modal

**Week View:**
- Stack up to 2 tasks vertically within each day cell
- Compact task blocks with abbreviated text
- Overflow indicator at bottom of cell
- Smaller font sizes to fit more information

**Month View:**
- Shows 3-4 task indicators as small pills
- Groups by priority or time if multiple tasks exist
- Overflow shows total count for the day

### TimeSlot Component Implementation

```typescript
const TimeSlot: React.FC<TimeSlotProps> = ({ 
  hour, 
  tasks, 
  onTaskClick, 
  isCurrentHour,
  variant,
  maxVisibleTasks = 3 
}) => {
  const visibleTasks = tasks.slice(0, maxVisibleTasks);
  const overflowCount = tasks.length - maxVisibleTasks;
  const [showOverflow, setShowOverflow] = useState(false);
  
  return (
    <div className={`time-slot ${variant}-slot ${isCurrentHour ? 'current-hour' : ''}`}>
      <div className="time-label">
        {format(new Date().setHours(hour, 0), variant === 'day' ? 'HH:mm' : 'HH')}
      </div>
      
      <div className="tasks-container">
        {visibleTasks.map((task, index) => (
          <TaskBlock
            key={task.id}
            task={task}
            variant={variant}
            onClick={onTaskClick}
            style={{
              zIndex: visibleTasks.length - index, // Stack order
              marginTop: index * (variant === 'day' ? 2 : 1), // Slight overlap
            }}
          />
        ))}
        
        {overflowCount > 0 && (
          <button 
            className="overflow-indicator"
            onClick={() => setShowOverflow(true)}
          >
            +{overflowCount} more
          </button>
        )}
        
        {showOverflow && (
          <TaskOverflowModal
            tasks={tasks.slice(maxVisibleTasks)}
            onTaskClick={onTaskClick}
            onClose={() => setShowOverflow(false)}
          />
        )}
      </div>
    </div>
  );
};
```

### Task Conflict Detection

When multiple tasks overlap in the same hour:
- Visual warning indicators (yellow/red borders)
- Duration-based conflict detection
- Suggested time adjustments
- Priority-based automatic sorting

### Responsive Behavior

**Mobile (< 768px):**
- Reduce max visible tasks (2 for day, 1 for week)
- Larger tap targets for overflow indicators
- Bottom sheet modals for overflow tasks

**Desktop (≥ 768px):**
- Show more tasks per slot
- Hover effects reveal additional task details
- Inline expansion for overflow tasks

## Styling Guidelines

### Tailwind Classes for Views

```css
/* DayView */
.day-view { @apply flex flex-col h-full; }
.time-grid { @apply flex-1 overflow-y-auto; }
.hour-row { @apply flex border-b border-gray-200 min-h-20; } /* Increased height for stacking */
.time-label { @apply w-20 p-2 text-sm text-gray-500 border-r; }

/* WeekView */  
.week-view { @apply flex flex-col h-full; }
.week-header { @apply flex border-b-2 border-gray-300; }
.week-grid { @apply flex-1 overflow-y-auto; }
.day-cell { @apply border-r border-gray-200 p-1 min-h-16 relative; } /* Relative for stacking */

/* MonthView */
.month-view { @apply flex flex-col h-full; }
.month-grid { @apply grid grid-cols-7 flex-1; }
.month-cell { @apply border border-gray-200 p-1 min-h-24; }

/* Multiple Tasks Styling */
.time-slot { @apply flex flex-col relative; }
.tasks-container { @apply flex-1 relative space-y-1; } /* Stack tasks with spacing */
.task-overflow { @apply absolute bottom-0 right-0; }
.overflow-indicator { 
  @apply text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full;
  @apply transition-colors cursor-pointer text-gray-600;
}

/* Task Block Stacking */
.task-block-stacked { @apply relative -mb-1; } /* Slight overlap */
.task-block-day { @apply mb-1 h-8; } /* Fixed height for day view */
.task-block-week { @apply mb-px h-6 text-xs; } /* Compact for week */
.task-block-month { @apply h-4 text-xs px-1; } /* Minimal for month */

/* Conflict Indicators */
.task-conflict { @apply border-2 border-yellow-400 shadow-yellow-200; }
.task-overlap { @apply border-2 border-red-400 shadow-red-200; }

/* Responsive adjustments */
@media (max-width: 768px) {
  .hour-row { @apply min-h-16; } /* Smaller on mobile */
  .day-cell { @apply min-h-12; }
  .overflow-indicator { @apply text-xs px-1; }
}
```

## Responsive Design

### Mobile Adaptations
- **DayView**: Full-width time slots, larger touch targets
- **WeekView**: Horizontal scroll for week days
- **MonthView**: Smaller cells, simplified task display

### Desktop Optimizations  
- **All Views**: Hover effects on tasks
- **Week/Month**: Multiple tasks per cell
- **Keyboard Navigation**: Tab through focusable elements

## Implementation Tasks

- [ ] Create TaskBlock component with variants (day/week/month)
- [ ] Create TimeSlot component with multiple task stacking support
- [ ] Create TaskOverflowModal for showing additional tasks
- [ ] Implement DayView with hour slots (max 3 tasks per slot)
- [ ] Implement WeekView with day columns (max 2 tasks per cell)
- [ ] Implement MonthView with calendar grid (max 3-4 task indicators)
- [ ] Add task conflict detection and visual indicators
- [ ] Add responsive breakpoints for mobile/desktop
- [ ] Style with Tailwind CSS including stacking styles
- [ ] Add loading and empty states
- [ ] Implement overflow handling and "+X more" indicators
- [ ] Test with sample data (multiple tasks in same time slot)
- [ ] Add touch/hover interactions for overflow tasks

## Performance Considerations

- **Virtualization**: For large datasets (many tasks)
- **Memoization**: Prevent unnecessary re-renders
- **Lazy Loading**: Load only visible time periods
- **Debouncing**: Smooth scrolling and interactions

---

**Status:** Ready for implementation  
**Next:** `04-components-integration.md`