# Calendar Task Sorting Strategy Implementation

**Date:** 2025-08-23  
**Session:** 05  
**Parent:** `calendar-plan.md`  
**Focus:** Advanced task sorting by effective start time (due_datetime - duration)

## Objective

Implement intelligent task sorting in calendar views that shows when tasks should start (not just when they're due) to provide a realistic scheduling experience.

## Sorting Logic

### Core Concept
Instead of sorting tasks by `due_datetime`, sort by **effective start time**:
```
start_time = due_datetime - estimated_duration
```

This shows when a task should begin to be completed on time.

### Example Scenario
```
Task A: "Clean Kitchen" 
- Due: 3:00 PM
- Duration: 30 minutes  
- Start: 2:30 PM

Task B: "Vacuum Living Room"
- Due: 2:45 PM  
- Duration: 15 minutes
- Start: 2:30 PM

Sorted Display: Task B (2:30-2:45), then Task A (2:30-3:00)
```

## Implementation Details

### 1. Task Start Time Calculation Utility

**File:** `src/components/calendar/utils/taskSorting.ts`

```typescript
export interface TaskWithStartTime extends TaskWithAssignment {
  calculatedStartTime: Date | null;
}

export const calculateTaskStartTime = (task: TaskWithAssignment): Date | null => {
  if (!task.due_datetime) return null;
  
  const dueTime = new Date(task.due_datetime);
  const durationMinutes = task.task.estimated_duration || 0;
  
  // Subtract duration from due time to get start time
  return new Date(dueTime.getTime() - (durationMinutes * 60 * 1000));
};

export const addStartTimesToTasks = (tasks: TaskWithAssignment[]): TaskWithStartTime[] => {
  return tasks.map(task => ({
    ...task,
    calculatedStartTime: calculateTaskStartTime(task)
  }));
};
```

### 2. Advanced Sorting Functions

```typescript
export type SortMethod = 'start_time' | 'due_time' | 'priority' | 'duration';

export const sortTasksByStartTime = (tasks: TaskWithAssignment[]): TaskWithAssignment[] => {
  return tasks.sort((a, b) => {
    const aStart = calculateTaskStartTime(a);
    const bStart = calculateTaskStartTime(b);
    
    // Handle null cases (all-day or no due time tasks)
    if (!aStart && !bStart) return 0;
    if (!aStart) return -1; // All-day tasks first
    if (!bStart) return 1;
    
    return aStart.getTime() - bStart.getTime();
  });
};

export const sortTasksByDueTime = (tasks: TaskWithAssignment[]): TaskWithAssignment[] => {
  return tasks.sort((a, b) => {
    if (!a.due_datetime && !b.due_datetime) return 0;
    if (!a.due_datetime) return -1;
    if (!b.due_datetime) return 1;
    
    return new Date(a.due_datetime).getTime() - new Date(b.due_datetime).getTime();
  });
};

export const sortTasksByPriority = (tasks: TaskWithAssignment[]): TaskWithAssignment[] => {
  const priorityOrder = { 'overdue': 0, 'in_progress': 1, 'pending': 2, 'completed': 3 };
  
  return tasks.sort((a, b) => {
    const aPriority = priorityOrder[a.status] ?? 99;
    const bPriority = priorityOrder[b.status] ?? 99;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Secondary sort by start time
    return sortTasksByStartTime([a, b])[0] === a ? -1 : 1;
  });
};
```

### 3. Time Slot Assignment Logic with Multiple Task Support

```typescript
export const getTasksForTimeSlot = (
  tasks: TaskWithAssignment[], 
  targetHour: number,
  slotMethod: 'start_time' | 'due_time' = 'start_time'
): TaskWithAssignment[] => {
  return tasks.filter(task => {
    if (!task.due_datetime) return targetHour === 0; // All-day tasks at top
    
    let relevantTime: Date;
    
    if (slotMethod === 'start_time') {
      relevantTime = calculateTaskStartTime(task) || new Date(task.due_datetime);
    } else {
      relevantTime = new Date(task.due_datetime);
    }
    
    return relevantTime.getHours() === targetHour;
  });
};

// Enhanced sorting for multiple tasks in same hour slot
export const sortMultipleTasksInSlot = (
  tasks: TaskWithAssignment[],
  sortMethod: SortMethod = 'start_time'
): TaskWithAssignment[] => {
  switch (sortMethod) {
    case 'start_time':
      return sortTasksByStartTime(tasks);
    case 'due_time':
      return sortTasksByDueTime(tasks);
    case 'priority':
      return sortTasksByPriority(tasks);
    case 'duration':
      return sortTasksByDuration(tasks);
    default:
      return tasks;
  }
};

export const sortTasksByDuration = (tasks: TaskWithAssignment[]): TaskWithAssignment[] => {
  return tasks.sort((a, b) => {
    const aDuration = a.task.estimated_duration || 0;
    const bDuration = b.task.estimated_duration || 0;
    
    // Shorter tasks first (or longer first - configurable)
    return aDuration - bDuration;
  });
};
```

## Visual Enhancements

### 1. Task Duration Visualization

Show task blocks spanning their actual duration:

```typescript
// In TaskBlock component
interface TaskBlockProps {
  task: TaskWithAssignment;
  variant: 'day' | 'week' | 'month';
  showDuration?: boolean;
  onClick: (task: TaskWithAssignment) => void;
}

const TaskBlock: React.FC<TaskBlockProps> = ({ task, showDuration = true, ...props }) => {
  const startTime = calculateTaskStartTime(task);
  const dueTime = task.due_datetime ? new Date(task.due_datetime) : null;
  const duration = task.task.estimated_duration || 0;
  
  return (
    <div 
      className={`task-block ${getTaskStatusColor(task.status)}`}
      style={showDuration ? {
        height: `${duration}px`, // Scale based on duration
        minHeight: '24px'
      } : {}}
    >
      <div className="task-content">
        <div className="task-title">{task.task.name}</div>
        {showDuration && startTime && dueTime && (
          <div className="task-time">
            {format(startTime, 'h:mm a')} - {format(dueTime, 'h:mm a')}
            <span className="duration">({duration}min)</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 2. Time Conflict Detection

Identify overlapping tasks:

```typescript
export const detectTimeConflicts = (tasks: TaskWithAssignment[]): TaskWithAssignment[][] => {
  const tasksWithStartTime = addStartTimesToTasks(tasks).filter(task => 
    task.calculatedStartTime && task.due_datetime
  );
  
  const conflicts: TaskWithAssignment[][] = [];
  
  for (let i = 0; i < tasksWithStartTime.length; i++) {
    const taskA = tasksWithStartTime[i];
    const conflictGroup = [taskA];
    
    for (let j = i + 1; j < tasksWithStartTime.length; j++) {
      const taskB = tasksWithStartTime[j];
      
      if (isTimeOverlap(taskA, taskB)) {
        conflictGroup.push(taskB);
      }
    }
    
    if (conflictGroup.length > 1) {
      conflicts.push(conflictGroup);
    }
  }
  
  return conflicts;
};

const isTimeOverlap = (taskA: TaskWithStartTime, taskB: TaskWithStartTime): boolean => {
  if (!taskA.calculatedStartTime || !taskB.calculatedStartTime) return false;
  if (!taskA.due_datetime || !taskB.due_datetime) return false;
  
  const aStart = taskA.calculatedStartTime.getTime();
  const aEnd = new Date(taskA.due_datetime).getTime();
  const bStart = taskB.calculatedStartTime.getTime();
  const bEnd = new Date(taskB.due_datetime).getTime();
  
  return (aStart < bEnd) && (bStart < aEnd);
};
```

## Multiple Tasks Per Hour Slot Management

### Task Stacking and Prioritization

When multiple tasks fall into the same hour slot, apply intelligent sorting and stacking:

```typescript
export interface SlotTaskGroup {
  hour: number;
  allTasks: TaskWithAssignment[];
  visibleTasks: TaskWithAssignment[];
  overflowTasks: TaskWithAssignment[];
  hasConflicts: boolean;
}

export const groupTasksBySlot = (
  tasks: TaskWithAssignment[],
  maxVisiblePerSlot: number = 3,
  sortMethod: SortMethod = 'start_time'
): SlotTaskGroup[] => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return hours.map(hour => {
    const hourTasks = getTasksForTimeSlot(tasks, hour, sortMethod === 'due_time' ? 'due_time' : 'start_time');
    const sortedTasks = sortMultipleTasksInSlot(hourTasks, sortMethod);
    const conflicts = detectTimeConflicts(hourTasks);
    
    return {
      hour,
      allTasks: sortedTasks,
      visibleTasks: sortedTasks.slice(0, maxVisiblePerSlot),
      overflowTasks: sortedTasks.slice(maxVisiblePerSlot),
      hasConflicts: conflicts.length > 0
    };
  });
};
```

### Smart Task Prioritization Rules

When multiple tasks exist in the same slot:

1. **Overdue tasks** always appear first
2. **In-progress tasks** appear before pending ones
3. **Start time** determines order within same status
4. **Duration** can be used as tie-breaker (shorter first)
5. **Priority level** from task difficulty/points

```typescript
export const smartSortMultipleTasks = (tasks: TaskWithAssignment[]): TaskWithAssignment[] => {
  return tasks.sort((a, b) => {
    // 1. Status priority (overdue > in_progress > pending > completed)
    const statusOrder = { 'overdue': 0, 'in_progress': 1, 'pending': 2, 'completed': 3, 'skipped': 4 };
    const aStatus = statusOrder[a.status] ?? 99;
    const bStatus = statusOrder[b.status] ?? 99;
    
    if (aStatus !== bStatus) return aStatus - bStatus;
    
    // 2. Start time (earlier first)
    const aStart = calculateTaskStartTime(a);
    const bStart = calculateTaskStartTime(b);
    
    if (aStart && bStart) {
      const timeDiff = aStart.getTime() - bStart.getTime();
      if (Math.abs(timeDiff) > 5 * 60 * 1000) { // 5 minute threshold
        return timeDiff;
      }
    }
    
    // 3. Duration (shorter tasks first for better completion rate)
    const aDuration = a.task.estimated_duration || 0;
    const bDuration = b.task.estimated_duration || 0;
    if (aDuration !== bDuration) return aDuration - bDuration;
    
    // 4. Task difficulty/points (higher priority first)
    const aDifficulty = a.task.difficulty || 0;
    const bDifficulty = b.task.difficulty || 0;
    return bDifficulty - aDifficulty;
  });
};
```

### Visual Stacking Strategies

Different approaches for displaying multiple tasks:

```typescript
export type StackingStrategy = 'vertical' | 'overlapping' | 'compressed' | 'grouped';

export const getStackingLayout = (
  tasks: TaskWithAssignment[],
  strategy: StackingStrategy,
  containerHeight: number
): { task: TaskWithAssignment; y: number; height: number; zIndex: number }[] => {
  switch (strategy) {
    case 'vertical':
      return tasks.map((task, index) => ({
        task,
        y: (containerHeight / Math.max(tasks.length, 3)) * index,
        height: containerHeight / Math.max(tasks.length, 3) - 2, // 2px gap
        zIndex: tasks.length - index
      }));
      
    case 'overlapping':
      return tasks.map((task, index) => ({
        task,
        y: index * 4, // 4px offset
        height: Math.max(containerHeight - (index * 4), 20),
        zIndex: tasks.length - index
      }));
      
    case 'compressed':
      const maxHeight = Math.min(containerHeight / tasks.length, 32);
      return tasks.map((task, index) => ({
        task,
        y: index * maxHeight,
        height: maxHeight - 1,
        zIndex: tasks.length - index
      }));
      
    case 'grouped':
      // Group by status, then stack within groups
      const groups = tasks.reduce((acc, task) => {
        if (!acc[task.status]) acc[task.status] = [];
        acc[task.status].push(task);
        return acc;
      }, {} as Record<string, TaskWithAssignment[]>);
      
      const layouts: any[] = [];
      let currentY = 0;
      const groupHeight = containerHeight / Object.keys(groups).length;
      
      Object.entries(groups).forEach(([status, groupTasks]) => {
        groupTasks.forEach((task, index) => {
          layouts.push({
            task,
            y: currentY + (index * (groupHeight / groupTasks.length)),
            height: (groupHeight / groupTasks.length) - 1,
            zIndex: groupTasks.length - index
          });
        });
        currentY += groupHeight;
      });
      
      return layouts;
  }
};
```

## Updated View Implementations

### Day View with Enhanced Multiple Task Handling

```typescript
const DayView: React.FC<DayViewProps> = ({ 
  date, 
  tasks, 
  onTaskClick,
  sortMethod = 'start_time',
  stackingStrategy = 'vertical',
  maxVisiblePerSlot = 3
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Group tasks by hour slots with enhanced sorting
  const slotGroups = useMemo(() => {
    return groupTasksBySlot(tasks, maxVisiblePerSlot, sortMethod);
  }, [tasks, maxVisiblePerSlot, sortMethod]);
  
  // Detect conflicts for visual warning
  const conflicts = useMemo(() => detectTimeConflicts(tasks), [tasks]);
  const totalConflicts = conflicts.reduce((sum, group) => sum + group.length, 0);
  
  return (
    <div className="day-view">
      <div className="day-header">
        <h2>{format(date, 'EEEE, MMMM dd, yyyy')}</h2>
        {totalConflicts > 0 && (
          <div className="conflict-warning">
            ⚠️ {totalConflicts} scheduling conflicts detected
          </div>
        )}
        
        {/* Task count summary */}
        <div className="task-summary text-sm text-gray-600">
          {tasks.length} tasks • {slotGroups.filter(g => g.overflowTasks.length > 0).length} slots with overflow
        </div>
      </div>
      
      <div className="time-grid">
        {slotGroups.map(slotGroup => (
          <EnhancedTimeSlot
            key={slotGroup.hour}
            slotGroup={slotGroup}
            onTaskClick={onTaskClick}
            stackingStrategy={stackingStrategy}
            isCurrentHour={slotGroup.hour === new Date().getHours()}
          />
        ))}
      </div>
    </div>
  );
};

// Enhanced TimeSlot component for multiple tasks
const EnhancedTimeSlot: React.FC<{
  slotGroup: SlotTaskGroup;
  onTaskClick: (task: TaskWithAssignment) => void;
  stackingStrategy: StackingStrategy;
  isCurrentHour: boolean;
}> = ({ slotGroup, onTaskClick, stackingStrategy, isCurrentHour }) => {
  const [showOverflow, setShowOverflow] = useState(false);
  const slotHeight = 64; // Standard hour slot height
  
  const layouts = getStackingLayout(slotGroup.visibleTasks, stackingStrategy, slotHeight - 8);
  
  return (
    <div className={`enhanced-time-slot ${isCurrentHour ? 'current-hour' : ''}`}>
      <div className="time-label">
        {format(new Date().setHours(slotGroup.hour, 0), 'HH:mm')}
        {slotGroup.hasConflicts && (
          <span className="conflict-indicator text-yellow-500">⚠</span>
        )}
      </div>
      
      <div className="slot-container" style={{ height: `${slotHeight}px`, position: 'relative' }}>
        {layouts.map(({ task, y, height, zIndex }) => (
          <TaskBlock
            key={task.id}
            task={task}
            variant="day"
            onClick={onTaskClick}
            style={{
              position: 'absolute',
              top: `${y}px`,
              height: `${height}px`,
              zIndex,
              width: '100%'
            }}
            className={`
              ${slotGroup.hasConflicts ? 'task-conflict' : ''}
              ${stackingStrategy === 'overlapping' ? 'shadow-sm' : ''}
            `}
          />
        ))}
        
        {slotGroup.overflowTasks.length > 0 && (
          <button
            className="overflow-indicator absolute bottom-1 right-1"
            onClick={() => setShowOverflow(true)}
          >
            +{slotGroup.overflowTasks.length} more
          </button>
        )}
        
        {showOverflow && (
          <TaskOverflowModal
            tasks={slotGroup.overflowTasks}
            onTaskClick={onTaskClick}
            onClose={() => setShowOverflow(false)}
            title={`${format(new Date().setHours(slotGroup.hour, 0), 'h:mm a')} - Additional Tasks`}
          />
        )}
      </div>
    </div>
  );
};
```

## User Experience Improvements

### 1. Visual Indicators
- **Task Duration Bars**: Visual length proportional to duration
- **Start/End Times**: Clear time labels on task blocks
- **Conflict Highlights**: Red borders for overlapping tasks
- **Progress Indicators**: Show elapsed time for in-progress tasks

### 2. Sorting Options
Allow users to toggle between sorting methods:

```typescript
const SortingControls: React.FC = ({ currentSort, onSortChange }) => (
  <div className="sorting-controls">
    <Button 
      variant={currentSort === 'start_time' ? 'default' : 'outline'}
      onClick={() => onSortChange('start_time')}
    >
      By Start Time
    </Button>
    <Button 
      variant={currentSort === 'due_time' ? 'default' : 'outline'}
      onClick={() => onSortChange('due_time')}
    >
      By Due Time
    </Button>
    <Button 
      variant={currentSort === 'priority' ? 'default' : 'outline'}
      onClick={() => onSortChange('priority')}
    >
      By Priority
    </Button>
  </div>
);
```

## Implementation Tasks

- [ ] Create task sorting utility functions (`taskSorting.ts`)
- [ ] Implement start time calculations and duration handling
- [ ] Create `SlotTaskGroup` interface and grouping functions
- [ ] Implement `smartSortMultipleTasks` with status/time/duration priority
- [ ] Create `StackingStrategy` types and `getStackingLayout` function
- [ ] Update DayView with enhanced multiple task slot handling
- [ ] Update WeekView with compact multiple task display
- [ ] Update MonthView with task overflow indicators  
- [ ] Create `EnhancedTimeSlot` component for advanced stacking
- [ ] Create `TaskOverflowModal` for showing hidden tasks
- [ ] Add time conflict detection and visual warnings
- [ ] Create visual indicators for duration, conflicts, and overflow
- [ ] Add sorting method and stacking strategy toggle controls
- [ ] Implement responsive behavior for mobile/desktop
- [ ] Write tests for sorting algorithms and stacking layouts
- [ ] Add performance optimizations for large datasets
- [ ] Test with multiple tasks per hour slot scenarios

## Benefits of This Approach

1. **Realistic Scheduling**: Shows when to actually start tasks
2. **Better Time Management**: Helps users plan their day effectively  
3. **Conflict Awareness**: Identifies scheduling impossibilities
4. **Duration Visualization**: Makes time requirements clear
5. **Smart Sorting**: Prioritizes by logical start sequence

---

**Status:** Ready for implementation  
**Next:** Ready to begin implementation (start with `01-database-migration.md`)