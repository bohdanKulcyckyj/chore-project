# Calendar Hooks Implementation

This directory contains custom React hooks for managing calendar functionality in the Household Duties Manager application.

## Hooks Overview

### `useCalendarView`
Manages calendar view state (day/week/month), date navigation, and UI state.

**Key Features:**
- View type management (day, week, month)
- Date navigation (previous, next, today)
- Date range calculation for current view
- Date formatting utilities

**Usage:**
```tsx
const {
  viewType,
  currentDate,
  dateRange,
  goToToday,
  goToPrevious,
  goToNext,
  setViewType,
  formatDateRange
} = useCalendarView('week');
```

### `useCalendarData`
Fetches and manages calendar task data with filtering and real-time updates.

**Key Features:**
- Fetches tasks for specified date range
- Real-time Supabase subscriptions
- Filtering by member, status, and category
- Data organization by date and time slot

**Usage:**
```tsx
const {
  tasks,
  loading,
  error,
  filters,
  setFilters,
  getTasksForDate,
  getTasksForTimeSlot,
  refreshData
} = useCalendarData(startDate, endDate);
```

### `useTaskActions`
Handles task interactions (status updates, modal management) from calendar view.

**Key Features:**
- Task detail modal management
- Task claiming and completion
- Status updates with optimistic UI
- Error handling and user feedback

**Usage:**
```tsx
const {
  selectedTask,
  isModalOpen,
  openTaskModal,
  closeTaskModal,
  claimTask,
  completeTask,
  updateTaskStatus,
  actionLoading
} = useTaskActions();
```

## Utilities (`calendarUtils.ts`)

### Task Time Management
- `getTaskStartTime()` - Calculate when task should start based on duration
- `getTaskTimeRange()` - Get complete time range for task
- `formatTaskTimeRange()` - Format time range for display

### Task Organization
- `sortTasksByPriority()` - Sort tasks by status priority
- `getTasksByHourSlots()` - Group tasks by hour slots
- `splitTasksForDisplay()` - Handle task overflow in UI

### Conflict Detection
- `tasksOverlap()` - Check if two tasks have overlapping times
- `detectConflicts()` - Find all conflicting task groups

### UI Helpers
- `getTaskStatusColor()` - Get color classes for task status
- `formatHour()` - Format hour for display (12h/24h)

## Integration

These hooks are designed to work together:

```tsx
import { useCalendarView, useCalendarData, useTaskActions } from './hooks';

function Calendar() {
  const { dateRange, viewType } = useCalendarView();
  const { tasks, loading } = useCalendarData(dateRange.start, dateRange.end);
  const { openTaskModal } = useTaskActions();

  // Render calendar with hooks
}
```

## Real-time Features

The hooks include real-time subscriptions to Supabase for:
- Task assignment changes
- Task status updates
- New task assignments
- Task completions

## Performance Optimizations

- Memoized calculations for date ranges and task sorting
- Debounced filtering to prevent excessive API calls
- Optimistic UI updates for better user experience
- Efficient data organization for rendering

## Next Steps

These hooks are ready for use in the calendar view components:
1. `DayView` - Use with `getTasksByHourSlots()` for hourly layout
2. `WeekView` - Use with date iteration for weekly grid
3. `MonthView` - Use with `getTasksForDate()` for monthly calendar

## Dependencies

- `date-fns` - Date manipulation and formatting
- `@supabase/supabase-js` - Database operations
- `react-hot-toast` - User notifications
- Existing app hooks (`useAuth`, `useHousehold`)