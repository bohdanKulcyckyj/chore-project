# Calendar Components and Main Calendar Integration

**Date:** 2025-08-23  
**Session:** 04  
**Parent:** `calendar-plan.md`  
**Focus:** Main Calendar component, Header, Filters, and integration

## Objective

Implement the main Calendar component that orchestrates all views, calendar header with navigation, filtering controls, and integration with existing TaskDetailModal.

## Components Overview

### 1. Main Calendar Component

**File:** `src/components/calendar/Calendar.tsx`

**Purpose:** Primary container that manages view switching, data flow, and modal state

**Key Features:**
- View type management (day/week/month)
- Task data coordination
- Modal state management for TaskDetailModal
- Integration with existing hooks and components

### 2. Calendar Header Component

**File:** `src/components/calendar/CalendarHeader.tsx`

**Purpose:** Navigation controls and view selection

**Features:**
- Previous/Next navigation buttons
- Today button
- View type selector (Day/Week/Month)
- Current date/period display
- Mobile-responsive design

### 3. Calendar Filters Component

**File:** `src/components/calendar/CalendarFilters.tsx`

**Purpose:** Filter controls for members, status, and categories

**Features:**
- Member filter dropdown with avatars
- Status filter chips
- Category filter with colors
- Clear filters button
- Filter summary display

## Main Calendar Component Implementation

### Component Structure

```typescript
import React, { useState } from 'react';
import { useCalendarView } from './hooks/useCalendarView';
import { useCalendarData } from './hooks/useCalendarData';
import { useTaskActions } from './hooks/useTaskActions';
import CalendarHeader from './CalendarHeader';
import CalendarFilters from './CalendarFilters';
import DayView from './views/DayView';
import WeekView from './views/WeekView';
import MonthView from './views/MonthView';
import TaskDetailModal from '../tasks/TaskDetailModal'; // Reuse existing modal
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';

const Calendar: React.FC = () => {
  // Custom hooks for state management
  const calendarView = useCalendarView('week'); // Default to week view
  const calendarData = useCalendarData(calendarView.dateRange);
  const taskActions = useTaskActions();
  
  // Local UI state
  const [showFilters, setShowFilters] = useState(false);
  
  // Handle task click from any view
  const handleTaskClick = (task: TaskWithAssignment) => {
    taskActions.openTaskModal(task);
  };
  
  // Render current view based on viewType
  const renderCurrentView = () => {
    const { tasks, loading, error } = calendarData;
    const { viewType, currentDate, dateRange } = calendarView;
    
    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;
    
    const commonProps = {
      tasks,
      onTaskClick: handleTaskClick
    };
    
    switch (viewType) {
      case 'day':
        return <DayView date={currentDate} {...commonProps} />;
      case 'week':
        return <WeekView currentDate={currentDate} {...commonProps} />;
      case 'month':
        return <MonthView currentDate={currentDate} {...commonProps} />;
      default:
        return null;
    }
  };
  
  return (
    <div className="calendar-container h-full flex flex-col bg-white">
      {/* Calendar Header */}
      <CalendarHeader
        viewType={calendarView.viewType}
        onViewTypeChange={calendarView.setViewType}
        dateRange={calendarView.formatDateRange()}
        onPrevious={calendarView.goToPrevious}
        onNext={calendarView.goToNext}
        onToday={calendarView.goToToday}
        onToggleFilters={() => setShowFilters(!showFilters)}
        hasActiveFilters={calendarData.hasActiveFilters}
      />
      
      {/* Calendar Filters */}
      {showFilters && (
        <CalendarFilters
          filters={calendarData.filters}
          onFiltersChange={calendarData.setFilters}
          onClearFilters={calendarData.clearFilters}
          householdMembers={calendarData.householdMembers}
          taskCategories={calendarData.taskCategories}
        />
      )}
      
      {/* Main Calendar View */}
      <div className="calendar-content flex-1 overflow-hidden">
        {renderCurrentView()}
      </div>
      
      {/* Task Detail Modal - Reuse from tasks */}
      <TaskDetailModal
        isOpen={taskActions.isModalOpen}
        task={taskActions.selectedTask}
        onClose={taskActions.closeTaskModal}
        onClaimTask={taskActions.claimTask}
        onMarkComplete={taskActions.completeTask}
        onEditTask={taskActions.editTask}
        onReassignTask={taskActions.reassignTask}
      />
    </div>
  );
};

export default Calendar;
```

## Calendar Header Implementation

### Header Component Structure

```typescript
import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Today } from 'lucide-react';
import { Button } from '../ui/Button';

interface CalendarHeaderProps {
  viewType: 'day' | 'week' | 'month';
  onViewTypeChange: (type: 'day' | 'week' | 'month') => void;
  dateRange: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  viewType,
  onViewTypeChange,
  dateRange,
  onPrevious,
  onNext,
  onToday,
  onToggleFilters,
  hasActiveFilters
}) => {
  return (
    <div className="calendar-header border-b border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        {/* Left Section: Date Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              className="p-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              className="p-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className="px-3 py-2"
            >
              <Today className="w-4 h-4 mr-2" />
              Today
            </Button>
          </div>
          
          <h1 className="text-xl font-semibold text-gray-900">
            {dateRange}
          </h1>
        </div>
        
        {/* Right Section: View Controls */}
        <div className="flex items-center gap-4">
          {/* Filter Toggle */}
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={onToggleFilters}
            className="px-3 py-2"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs font-medium">
                Active
              </span>
            )}
          </Button>
          
          {/* View Type Selector */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {(['day', 'week', 'month'] as const).map((type) => (
              <Button
                key={type}
                variant={viewType === type ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewTypeChange(type)}
                className="rounded-none px-4 py-2 capitalize"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;
```

## Calendar Filters Implementation

### Filters Component Structure

```typescript
import React from 'react';
import { X, Users, Tag, Activity } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface CalendarFiltersProps {
  filters: {
    memberIds: string[];
    statuses: string[];
    categoryIds: string[];
  };
  onFiltersChange: (filters: Partial<CalendarFilters>) => void;
  onClearFilters: () => void;
  householdMembers: HouseholdMember[];
  taskCategories: TaskCategory[];
}

const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  householdMembers,
  taskCategories
}) => {
  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
    { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
    { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
  ];
  
  const toggleMember = (memberId: string) => {
    const newMemberIds = filters.memberIds.includes(memberId)
      ? filters.memberIds.filter(id => id !== memberId)
      : [...filters.memberIds, memberId];
    onFiltersChange({ memberIds: newMemberIds });
  };
  
  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ statuses: newStatuses });
  };
  
  const toggleCategory = (categoryId: string) => {
    const newCategoryIds = filters.categoryIds.includes(categoryId)
      ? filters.categoryIds.filter(id => id !== categoryId)
      : [...filters.categoryIds, categoryId];
    onFiltersChange({ categoryIds: newCategoryIds });
  };
  
  return (
    <div className="calendar-filters bg-gray-50 border-b border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* Member Filter */}
        <div className="filter-group">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Members</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {householdMembers.map(member => (
              <Button
                key={member.id}
                variant={filters.memberIds.includes(member.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleMember(member.id)}
                className="px-3 py-1"
              >
                {member.avatar_url && (
                  <img 
                    src={member.avatar_url} 
                    alt={member.display_name}
                    className="w-4 h-4 rounded-full mr-2"
                  />
                )}
                {member.display_name}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Status Filter */}
        <div className="filter-group">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Status</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(status => (
              <Badge
                key={status.value}
                variant={filters.statuses.includes(status.value) ? "default" : "outline"}
                className={`cursor-pointer ${filters.statuses.includes(status.value) ? status.color : ''}`}
                onClick={() => toggleStatus(status.value)}
              >
                {status.label}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="filter-group">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Categories</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {taskCategories.map(category => (
              <Badge
                key={category.id}
                variant={filters.categoryIds.includes(category.id) ? "default" : "outline"}
                className="cursor-pointer"
                style={filters.categoryIds.includes(category.id) ? {
                  backgroundColor: category.color,
                  color: 'white'
                } : {}}
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Clear Filters */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="ml-auto"
        >
          <X className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>
    </div>
  );
};

export default CalendarFilters;
```

## Integration with App.tsx

Update the calendar route in App.tsx:

```typescript
// Replace the existing calendar placeholder with:
{activeTab === 'calendar' && <Calendar />}
```

## Mobile Responsiveness

### Mobile Header Adaptations
- Stack navigation controls vertically on small screens
- Use dropdown for view selection instead of button group
- Collapse filter controls into expandable section

### Mobile Filter Adaptations  
- Convert to bottom sheet modal on mobile
- Use single-column layout for filter groups
- Add "Apply Filters" button for mobile

## Implementation Tasks

- [ ] Create main Calendar component with view orchestration
- [ ] Implement CalendarHeader with navigation controls
- [ ] Implement CalendarFilters with multi-type filtering
- [ ] Add mobile responsive breakpoints
- [ ] Integrate TaskDetailModal from existing tasks component
- [ ] Add loading states and error handling
- [ ] Test view switching functionality
- [ ] Test filtering combinations
- [ ] Add keyboard navigation support

## Testing Strategy

- **Unit Tests**: Test each component individually
- **Integration Tests**: Test view switching and filtering
- **Mobile Tests**: Test responsive behavior
- **Accessibility Tests**: Verify keyboard navigation and screen reader support

---

**Status:** Ready for implementation  
**Next:** `05-task-sorting-strategy.md`