# Calendar Hooks Implementation

**Date:** 2025-08-23  
**Session:** 02  
**Parent:** `calendar-plan.md`  
**Focus:** Custom hooks for calendar data management and view state

## Objective

Create custom React hooks to manage calendar data fetching, view state, and task interactions for the calendar component.

## Hooks to Implement

### 1. useCalendarView Hook

**Purpose:** Manage calendar view state (day/week/month), date navigation, and UI state.

**File:** `src/components/calendar/hooks/useCalendarView.tsx`

**API:**
```typescript
interface CalendarViewState {
  // View configuration
  viewType: 'day' | 'week' | 'month';
  currentDate: Date;
  dateRange: { start: Date; end: Date };
  
  // Navigation
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  setViewType: (type: 'day' | 'week' | 'month') => void;
  setCurrentDate: (date: Date) => void;
  
  // Utilities
  isToday: (date: Date) => boolean;
  formatDateRange: () => string;
}
```

### 2. useCalendarData Hook

**Purpose:** Fetch and manage calendar task data with filtering and real-time updates.

**File:** `src/components/calendar/hooks/useCalendarData.tsx`

**API:**
```typescript
interface CalendarDataState {
  // Data
  tasks: TaskWithAssignment[];
  loading: boolean;
  error: string | null;
  
  // Filtering  
  filters: {
    memberIds: string[];
    statuses: string[];
    categoryIds: string[];
  };
  setFilters: (filters: Partial<CalendarFilters>) => void;
  clearFilters: () => void;
  
  // Data organization
  getTasksForDate: (date: Date) => TaskWithAssignment[];
  getTasksForTimeSlot: (date: Date, hour: number) => TaskWithAssignment[];
  
  // Actions
  refreshData: () => Promise<void>;
}
```

### 3. useTaskActions Hook

**Purpose:** Handle task interactions (status updates, modal management) from calendar view.

**File:** `src/components/calendar/hooks/useTaskActions.tsx`

**API:**
```typescript
interface TaskActionsState {
  // Modal management
  selectedTask: TaskWithAssignment | null;
  isModalOpen: boolean;
  openTaskModal: (task: TaskWithAssignment) => void;
  closeTaskModal: () => void;
  
  // Task actions
  claimTask: (task: TaskWithAssignment) => Promise<void>;
  completeTask: (task: TaskWithAssignment) => Promise<void>;
  updateTaskStatus: (taskId: string, status: string) => Promise<void>;
  
  // UI state
  actionLoading: boolean;
  actionError: string | null;
}
```

## Implementation Details

### useCalendarView Implementation

```typescript
import { useState, useMemo, useCallback } from 'react';
import { 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  endOfDay, 
  endOfWeek, 
  endOfMonth,
  addDays,
  addWeeks, 
  addMonths,
  format,
  isToday as dateIsToday
} from 'date-fns';

export const useCalendarView = (initialView: 'day' | 'week' | 'month' = 'week') => {
  const [viewType, setViewType] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Calculate date range based on view type
  const dateRange = useMemo(() => {
    switch (viewType) {
      case 'day':
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate)
        };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 0 }),
          end: endOfWeek(currentDate, { weekStartsOn: 0 })
        };
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
      default:
        return { start: new Date(), end: new Date() };
    }
  }, [viewType, currentDate]);
  
  // Navigation functions
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);
  
  const goToPrevious = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return addDays(prev, -1);
        case 'week': return addWeeks(prev, -1);
        case 'month': return addMonths(prev, -1);
        default: return prev;
      }
    });
  }, [viewType]);
  
  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return addDays(prev, 1);
        case 'week': return addWeeks(prev, 1);
        case 'month': return addMonths(prev, 1);
        default: return prev;
      }
    });
  }, [viewType]);
  
  // Utility functions
  const isToday = useCallback((date: Date) => dateIsToday(date), []);
  
  const formatDateRange = useCallback(() => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'MMMM dd, yyyy');
      case 'week':
        return `${format(dateRange.start, 'MMM dd')} - ${format(dateRange.end, 'MMM dd, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      default:
        return '';
    }
  }, [viewType, currentDate, dateRange]);
  
  return {
    viewType,
    currentDate,
    dateRange,
    goToToday,
    goToPrevious,
    goToNext,
    setViewType,
    setCurrentDate,
    isToday,
    formatDateRange
  };
};
```

## Key Features

### Real-time Data Sync
```typescript
// In useCalendarData
useEffect(() => {
  if (!householdId) return;
  
  const subscription = supabase
    .channel('calendar-tasks')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'task_assignments',
        filter: `tasks.household_id=eq.${householdId}`
      },
      () => {
        // Refresh calendar data
        refreshData();
      }
    )
    .subscribe();
    
  return () => subscription.unsubscribe();
}, [householdId, refreshData]);
```

### Filtering Logic
```typescript
const filteredTasks = useMemo(() => {
  return rawTasks.filter(task => {
    // Member filter
    if (filters.memberIds.length > 0) {
      if (!filters.memberIds.includes(task.assigned_to)) return false;
    }
    
    // Status filter  
    if (filters.statuses.length > 0) {
      if (!filters.statuses.includes(task.status)) return false;
    }
    
    // Category filter
    if (filters.categoryIds.length > 0) {
      if (!task.task.category_id || !filters.categoryIds.includes(task.task.category_id)) return false;
    }
    
    return true;
  });
}, [rawTasks, filters]);
```

## Implementation Tasks

- [ ] Create useCalendarView hook with date navigation
- [ ] Create useCalendarData hook with filtering  
- [ ] Create useTaskActions hook with modal management
- [ ] Implement real-time subscriptions
- [ ] Add comprehensive TypeScript types
- [ ] Write unit tests for hooks
- [ ] Add error handling and loading states
- [ ] Optimize performance with useMemo/useCallback

## Testing Strategy

- **Unit Tests**: Test hook logic and state changes
- **Integration Tests**: Test hooks with actual Supabase queries
- **Performance Tests**: Verify no unnecessary re-renders
- **Real-time Tests**: Verify subscriptions work correctly

---

**Status:** Ready for implementation  
**Next:** `03-views-implementation.md`