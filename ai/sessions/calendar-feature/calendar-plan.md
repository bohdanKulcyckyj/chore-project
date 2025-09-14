# Calendar Feature Implementation - Master Plan

**Date:** 2025-08-23  
**Feature:** Google Calendar-style task calendar for household task management  
**Status:** Planning Complete - Ready for Implementation

## Subsession Documents

This master plan is broken down into focused implementation sessions:

1. **`01-database-migration.md`** - Database schema changes for datetime support
2. **`02-hooks-implementation.md`** - Custom React hooks for state management
3. **`03-views-implementation.md`** - Day, Week, Month view components
4. **`04-components-integration.md`** - Main Calendar component and integration
5. **`05-task-sorting-strategy.md`** - Advanced task sorting by start time

## Objective

Implement a comprehensive calendar view that displays all household tasks in a Google Calendar-style interface with day/week/month perspectives, member filtering, and datetime-based task scheduling.

## Current System Analysis

### Database Schema Analysis

Based on `src/types/database.ts`, the current task system has:

**Current Schema:**
- `task_assignments.due_date: string | null` - Currently only supports date (not datetime)
- Tasks are linked through: `tasks` → `task_assignments` → `user_profiles`
- Task assignments include status tracking: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped'
- Task categories available with colors and icons
- Household member roles and permissions

**Current App Structure:**
- Calendar tab exists in sidebar (line 141 in App.tsx) but shows placeholder content
- Uses React Router with tab-based navigation
- Mobile-responsive design with sidebar toggle
- Framer Motion animations throughout the app

## Requirements Analysis

### Core Features Required

1. **Calendar Views**
   - Day view: Hour-by-hour slots with tasks
   - Week view: 7-day grid with task blocks
   - Month view: Monthly grid with task indicators
   - Navigation between views and time periods

2. **Task Display**
   - **CRITICAL: Support for multiple tasks in single hour slots** with intelligent stacking
   - Tasks sorted by effective start time (due_datetime - duration) for realistic scheduling
   - Visual indicators for task status (pending, in_progress, completed, overdue)
   - Task categories shown with colors and icons
   - Member avatars for assigned users
   - Duration visualization with proportional task blocks
   - Time conflict detection and warnings
   - Overflow handling with "+X more" indicators when too many tasks exist in one slot

3. **Filtering & Controls**
   - Filter by household member (show all or specific member)
   - Filter by task status
   - Filter by task category
   - Quick date navigation (today, previous/next period)

4. **Task Interaction**
   - Click to open full task detail modal
   - Task detail modal shows complete task information
   - Quick status updates from calendar view
   - Visual feedback for state changes

## Database Schema Changes Required

### 1. Update `due_date` to Support Datetime

**Current:** `due_date: string | null` (date only)  
**Required:** `due_datetime: string | null` (ISO datetime string)

**Migration Required:**
```sql
-- Add new column
ALTER TABLE task_assignments 
ADD COLUMN due_datetime TIMESTAMPTZ;

-- Migrate existing data (convert dates to midnight)
UPDATE task_assignments 
SET due_datetime = due_date::date + TIME '00:00:00'
WHERE due_date IS NOT NULL;

-- Eventually drop old column (after UI migration)
-- ALTER TABLE task_assignments DROP COLUMN due_date;
```

**TypeScript Updates:**
```typescript
task_assignments: {
  Row: {
    // ... other fields
    due_date?: string | null; // Legacy, will be removed
    due_datetime: string | null; // New datetime field
  }
}
```

## Multiple Tasks Per Hour Slot - Core Requirement

### Critical Feature: Intelligent Task Stacking

One of the most important features of the calendar is handling **multiple tasks that occur in the same hour**. This is a common real-world scenario that must be handled elegantly.

**Key Requirements:**
1. **Visual Stacking**: Tasks in the same hour must stack vertically or with slight overlap
2. **Smart Sorting**: Tasks sorted by priority (overdue → in_progress → pending), then by start time
3. **Overflow Handling**: Show max 3 tasks per slot in day view, 2 in week view, with "+X more" indicator
4. **Conflict Detection**: Visual warnings when tasks have overlapping durations
5. **Responsive Display**: Different stacking strategies for mobile vs desktop

**Implementation Approach:**
- `TimeSlot` component handles multiple task rendering
- `TaskBlock` component adapts size/content based on stacking context  
- Advanced sorting algorithms prioritize tasks intelligently
- Overflow modal shows all tasks when clicking "+X more"
- Different stacking strategies: vertical, overlapping, compressed, grouped

**User Experience:**
- Users can see their realistic schedule with multiple tasks per hour
- Priority tasks (overdue, in-progress) always visible first
- Easy access to overflow tasks without cluttering the interface
- Visual conflict warnings help prevent impossible scheduling

## Component Architecture Design

### 1. Calendar Container Component
```
src/components/calendar/
├── Calendar.tsx              # Main calendar component
├── CalendarHeader.tsx        # Navigation & view controls
├── CalendarFilters.tsx       # Member/status/category filters
├── views/
│   ├── DayView.tsx          # Single day with hour slots
│   ├── WeekView.tsx         # 7-day week grid
│   └── MonthView.tsx        # Monthly calendar grid
├── components/
│   ├── TaskBlock.tsx        # Individual task display
│   ├── TimeSlot.tsx         # Time slot container
│   ├── TaskTooltip.tsx      # Hover details
│   └── QuickActions.tsx     # Status update buttons
└── hooks/
    ├── useCalendarData.tsx   # Fetch & filter calendar data
    ├── useCalendarView.tsx   # View state management
    └── useTaskActions.tsx    # Task interaction handlers
```

### 2. Data Flow Architecture

```
Calendar.tsx
├── useCalendarView() → manages current view (day/week/month), date range
├── useCalendarData() → fetches tasks for current period + filters
├── CalendarHeader → controls view selection, date navigation
├── CalendarFilters → controls member/status/category filtering  
└── [DayView|WeekView|MonthView]
    └── TaskBlock[] → displays individual tasks with interactions
```

### 3. State Management Strategy

**Local Component State:**
- Current view type (day/week/month)
- Selected date/period
- Active filters (member, status, category)
- UI state (loading, dragging, etc.)

**Global State (via useHousehold):**
- Household members list
- Task categories
- Real-time task updates

**Server State:**
- Task assignments for current period
- Task completions and status updates
- Real-time subscriptions for changes

## Key Data Queries Required

### 1. Calendar Task Query
```typescript
const getCalendarTasks = async (
  householdId: string,
  startDate: string,
  endDate: string,
  filters: {
    memberIds?: string[];
    statuses?: string[];
    categoryIds?: string[];
  }
) => {
  return supabase
    .from('task_assignments')
    .select(`
      *,
      tasks!inner(
        id,
        name,
        description,
        category_id,
        difficulty,
        points,
        estimated_duration,
        task_categories(name, color, icon)
      ),
      user_profiles!assigned_to(
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('tasks.household_id', householdId)
    .gte('due_datetime', startDate)
    .lte('due_datetime', endDate)
    .in('assigned_to', filters.memberIds || [])
    .in('status', filters.statuses || [])
    .order('due_datetime', { ascending: true });
};
```

### 2. Real-time Subscriptions
- Task assignment changes
- Task completion updates
- New task assignments
- Status changes

## UI/UX Design Specifications

### 1. Visual Design Patterns
- **Google Calendar inspired**: Clean grid layout with time slots
- **Task Categories**: Color-coded blocks with category colors
- **Member Indicators**: Small avatar circles on task blocks
- **Status Indicators**: Border styles and colors for status
- **Responsive Design**: Mobile-first with touch interactions

### 2. Time Display Format
- **Day View**: 24-hour slots (00:00 - 23:00) or working hours
- **Week View**: Horizontal timeline with vertical day columns
- **Month View**: Date cells with stacked task indicators

### 3. Task Block Design
```
┌─────────────────────────────┐
│ 🧹 Kitchen Cleaning    [👤] │ ← Category icon, name, assignee avatar
│ Due: 2:00 PM • 30min       │ ← Time and duration  
│ Status: In Progress        │ ← Status indicator
└─────────────────────────────┘
```

### 4. Interaction Patterns
- **Click**: Open existing TaskDetailModal from `src/components/tasks/TaskDetailModal.tsx`
- **Hover**: Show tooltip with quick preview info
- **Quick Actions**: Status update buttons on hover/mobile tap
- **Modal Reuse**: Import and reuse the existing task detail modal component
- **Drag & Drop**: (Future feature) Reschedule tasks

## Implementation Roadmap

### Phase 1: Database Foundation (`01-database-migration.md`)
- [ ] Create Supabase migration for `due_datetime` column
- [ ] Migrate existing data from `due_date` to `due_datetime`
- [ ] Update TypeScript types in `src/types/database.ts`
- [ ] Update existing queries to use new datetime field
- [ ] Test migration and data integrity

### Phase 2: React Hooks (`02-hooks-implementation.md`)
- [ ] Implement `useCalendarView` for date navigation and view state
- [ ] Implement `useCalendarData` for data fetching and filtering
- [ ] Implement `useTaskActions` for task interactions and modal state
- [ ] Add real-time Supabase subscriptions
- [ ] Create utility functions for date calculations

### Phase 3: Calendar Views with Multiple Task Support (`03-views-implementation.md`)
- [ ] Create `TaskBlock` component with day/week/month variants and stacking support
- [ ] Create `TimeSlot` component with **multiple task stacking capabilities**
- [ ] Create `TaskOverflowModal` for showing additional tasks beyond visible limit
- [ ] Implement `DayView` with 24-hour time slots (max 3 tasks per slot + overflow)
- [ ] Implement `WeekView` with 7-day grid (max 2 tasks per cell + overflow)
- [ ] Implement `MonthView` with calendar grid (3-4 task indicators + overflow count)
- [ ] Add **task stacking strategies**: vertical, overlapping, compressed, grouped
- [ ] Add responsive breakpoints with different stacking limits for mobile/desktop

### Phase 4: Main Integration (`04-components-integration.md`)
- [ ] Create main `Calendar` component with view orchestration
- [ ] Implement `CalendarHeader` with navigation and view controls
- [ ] Implement `CalendarFilters` with member/status/category filtering
- [ ] Integrate existing `TaskDetailModal` from task management
- [ ] Add loading states and error handling
- [ ] Update `App.tsx` to use new Calendar component

### Phase 5: Advanced Features (`05-task-sorting-strategy.md`)
- [ ] Implement start time calculation (due_datetime - duration)
- [ ] Create advanced sorting algorithms (start time, due time, priority)
- [ ] Add time conflict detection and visualization
- [ ] Create duration-based task block sizing
- [ ] Add sorting method toggle controls
- [ ] Implement conflict warnings and visual indicators

## Technical Considerations

### 1. Performance Optimization
- **Data Pagination**: Load only visible time periods
- **Virtual Scrolling**: For large datasets in day view
- **Memoization**: Prevent unnecessary re-renders
- **Debounced Filtering**: Avoid excessive API calls

### 2. Mobile Responsiveness
- **Touch Gestures**: Swipe to navigate dates
- **Collapsed Views**: Stack layout on mobile
- **Simplified Interactions**: Tap vs hover patterns
- **Bottom Sheet**: Modal interactions on mobile

### 3. Real-time Updates
- **Supabase Subscriptions**: Live task updates
- **Optimistic Updates**: Immediate UI feedback
- **Conflict Resolution**: Handle concurrent edits
- **Connection Handling**: Offline/online states

### 4. Accessibility
- **Keyboard Navigation**: Tab through time slots
- **Screen Reader Support**: Proper ARIA labels
- **High Contrast**: Status and category indicators
- **Focus Management**: Modal and popup focus

## Advanced Task Sorting Strategy

### Start Time vs Due Time Logic
Instead of displaying tasks by when they're due, the calendar shows when tasks should **start** for realistic time management:

```
Effective Start Time = due_datetime - estimated_duration
```

**Example:**
- Task: "Clean Kitchen" (30 min duration, due 3:00 PM) 
- Shows at: 2:30 PM slot (start time)
- Visual: 2:30-3:00 PM block

### Sorting Methods Available
1. **Start Time Sort**: When to begin tasks (default)
2. **Due Time Sort**: Traditional due date sorting
3. **Priority Sort**: Status-based (overdue → in_progress → pending)
4. **Duration Sort**: Shortest/longest tasks first

### Conflict Detection
- Identify overlapping task schedules
- Visual warnings for impossible scheduling
- Suggest alternative time slots

## Custom Hooks Architecture

### useCalendarView Hook
- Manages view type (day/week/month) and date navigation
- Calculates date ranges for current view
- Provides navigation functions (today, previous, next)
- Handles view switching and date formatting

### useCalendarData Hook
- Fetches tasks for current date range with filtering
- Manages real-time Supabase subscriptions
- Provides filtering by member, status, category
- Organizes tasks by time slots and dates
- Handles loading states and error management

### useTaskActions Hook
- Manages TaskDetailModal state and interactions
- Handles task status updates (claim, complete, reassign)
- Provides optimistic UI updates
- Manages task action loading states and errors

## Component Integration Details

### Reusing Existing Components
- **TaskDetailModal**: Import from `src/components/tasks/TaskDetailModal.tsx`
- **useHousehold**: Leverage for member data and household context
- **Button/Badge/UI**: Use existing UI components for consistency

### Mobile Responsiveness Strategy
- **Day View**: Full-width time slots with touch-friendly interactions
- **Week View**: Horizontal scroll for week navigation
- **Month View**: Simplified task indicators with tap interactions
- **Filters**: Convert to bottom sheet modal on mobile screens

## Implementation Notes

### Current Status Integration
- Leverage existing `useHousehold` context for member data
- Use existing task categories and colors
- Maintain consistency with current UI patterns
- Integrate with existing notification system
- Reuse TaskDetailModal for task interactions

### Performance Optimizations
- Virtual scrolling for large datasets
- Memoized calculations for date ranges and task sorting
- Debounced filtering to prevent excessive API calls
- Lazy loading of calendar data outside visible range

### Future Enhancements
- Drag & drop task rescheduling
- Task creation directly in calendar
- Recurring task visualization
- Calendar sharing/export
- Time zone support
- Calendar integrations (Google Calendar sync)

## Success Metrics

- [ ] All household tasks visible in calendar views
- [ ] **Multiple tasks in same hour slot display correctly with stacking**
- [ ] **Overflow handling works seamlessly with "+X more" indicators**
- [ ] **Task priority sorting shows most important tasks first**
- [ ] Smooth navigation between day/week/month
- [ ] Effective member and status filtering
- [ ] Real-time updates working properly
- [ ] **Conflict detection highlights scheduling issues**
- [ ] Mobile responsive with appropriate stacking limits
- [ ] Performance acceptable with large datasets and multiple tasks
- [ ] Consistent with existing app design patterns

---

**Next Steps:**
1. Get user approval for this implementation plan
2. Start with Phase 1: database migration and foundation
3. Implement incrementally with user feedback at each phase