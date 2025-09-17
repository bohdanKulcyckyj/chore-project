# FullCalendar React Integration

**Date:** 2025-09-17
**Session:** 03 (Updated from custom views)
**Parent:** `calendar-plan.md`
**Focus:** FullCalendar React integration with custom task rendering

## Objective

Integrate FullCalendar React component to display household tasks in professional calendar views (day/week/month) with custom task rendering, filtering, and interactions.

## Why FullCalendar Over Custom Components

### Advantages
- **Battle-tested**: Handles complex calendar logic and edge cases
- **Multiple Events**: Native support for multiple events per time slot
- **Performance**: Optimized rendering and virtualization
- **Accessibility**: Built-in keyboard navigation and screen reader support
- **Mobile**: Touch gestures and responsive design
- **Maintenance**: Reduces custom code by ~80%

### FullCalendar Features We'll Use
- **TimeGrid View**: Day and week views with time slots
- **DayGrid View**: Month view with date cells
- **Event Rendering**: Custom React components for task display
- **Event Interaction**: Click, hover, and drag handling
- **Date Navigation**: Built-in navigation controls
- **Event Filtering**: Plugin-based filtering system

## Installation & Dependencies

### Required Packages
```bash
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

### Package Breakdown & Version Compatibility
- `@fullcalendar/react@6.1.19` - Official React wrapper (supports React 16.7+ through 19)
- `@fullcalendar/core@~6.1.19` - Core calendar functionality (peer dependency)
- `@fullcalendar/daygrid` - Month view plugin
- `@fullcalendar/timegrid` - Day/week view plugin
- `@fullcalendar/interaction` - User interaction features (click, drag, select)

### React Integration Architecture
Based on FullCalendar source code analysis:
- **Custom Content**: Uses React portals for custom rendering (preserves context)
- **Performance**: Smart re-rendering with PureComponent patterns
- **React 18**: Automatic `flushSync` handling for concurrent rendering
- **Strict Mode**: Built-in support for React StrictMode compatibility

## Implementation Architecture

### 1. FullCalendar Event Data Transformation

FullCalendar expects events in this format:
```typescript
interface FullCalendarEvent {
  id: string;
  title: string;
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: Record<string, any>;
}
```

Our task transformation:
```typescript
// Hook: useFullCalendarEvents.tsx
export const useFullCalendarEvents = (tasks: TaskWithAssignment[]) => {
  return useMemo(() => {
    return tasks.map(task => {
      const startTime = getTaskStartTime(task);
      const endTime = task.due_datetime ? new Date(task.due_datetime) : null;

      return {
        id: task.id,
        title: task.tasks.name,
        start: startTime || endTime,
        end: endTime,
        allDay: !task.due_datetime,
        backgroundColor: getTaskStatusColor(task.status).bg,
        borderColor: task.tasks.task_categories?.color || '#6b7280',
        textColor: getTaskStatusColor(task.status).text,
        extendedProps: {
          task,
          status: task.status,
          assignee: task.user_profiles?.display_name,
          category: task.tasks.task_categories,
          duration: task.tasks.estimated_duration,
          difficulty: task.tasks.difficulty,
          points: task.tasks.points
        }
      };
    });
  }, [tasks]);
};
```

### 2. Main Calendar Component (Based on FullCalendar Source Patterns)

```typescript
// Calendar.tsx
import React, { useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventApi, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCalendarData } from './hooks/useCalendarData';
import { useCalendarView } from './hooks/useCalendarView';
import { useTaskActions } from './hooks/useTaskActions';
import { useFullCalendarEvents } from './hooks/useFullCalendarEvents';
import CustomEventContent from './components/CustomEventContent';
import CalendarHeader from './CalendarHeader';
import CalendarFilters from './CalendarFilters';

const Calendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const { currentDate, currentView, setCurrentDate, setCurrentView } = useCalendarView();
  const { tasks, loading, filters, setFilters } = useCalendarData(currentDate, currentView);
  const { openTaskModal, closeTaskModal, isModalOpen, selectedTask } = useTaskActions();
  const events = useFullCalendarEvents(tasks);

  // Using useCallback to prevent unnecessary re-renders (FullCalendar best practice)
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const task = clickInfo.event.extendedProps.task;
    openTaskModal(task);
  }, [openTaskModal]);

  const handleDateClick = useCallback((dateClickInfo: any) => {
    // Could open "create task" modal here
    console.log('Date clicked:', dateClickInfo.dateStr);
  }, []);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // Handle date range selection for creating tasks
    console.log('Date range selected:', selectInfo.startStr, selectInfo.endStr);
  }, []);

  // Custom event content renderer - preserves React context
  const renderEventContent = useCallback((eventInfo: any) => {
    return <CustomEventContent eventInfo={eventInfo} />;
  }, []);

  // Access FullCalendar API when needed
  const getCalendarApi = () => {
    return calendarRef.current?.getApi();
  };

  return (
    <div className="calendar-container h-full flex flex-col">
      {/* Custom header with filters */}
      <CalendarHeader
        currentDate={currentDate}
        currentView={currentView}
        onViewChange={setCurrentView}
        onDateChange={setCurrentDate}
        calendarApi={getCalendarApi}
      />

      <CalendarFilters
        filters={filters}
        onFiltersChange={setFilters}
        totalTasks={tasks.length}
      />

      {/* FullCalendar Component */}
      <div className="flex-1 overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}

          // View Configuration
          initialView={currentView}
          headerToolbar={false} // We use custom header
          height="100%"

          // Events
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          select={handleDateSelect}

          // Custom Rendering (uses React portals internally)
          eventContent={renderEventContent}

          // Navigation callbacks
          datesSet={(dateInfo) => {
            setCurrentDate(dateInfo.start);
          }}

          // Time Configuration
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="01:00:00"
          allDaySlot={false}

          // Event Display & Overflow
          aspectRatio={1.8}
          eventDisplay="block"
          dayMaxEvents={3} // Show max 3 events, then "+X more"
          moreLinkClick="popover" // Built-in overflow handling!

          // Interaction
          selectable={true}
          selectMirror={true}
          unselectAuto={true}

          // Week/Day specific
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
          }}

          // Event ordering (critical for task priority)
          eventOrder="start,-duration,allDay,title"

          // Loading state
          loading={loading}

          // Weekend handling
          weekends={true}

          // First day of week
          firstDay={0} // Sunday = 0, Monday = 1

          // Event overlap and stacking (key for multiple tasks)
          slotEventOverlap={false} // Prevents visual overlap in time slots
          eventOverlap={false} // Prevents event overlap conflicts

          // Responsive breakpoints
          aspectRatio={window.innerWidth < 768 ? 1.2 : 1.8}
        />
      </div>

      {/* Task Detail Modal - reuse existing component */}
      {isModalOpen && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={closeTaskModal}
          onStatusUpdate={(newStatus) => {
            // Handle optimistic update
            closeTaskModal();
          }}
        />
      )}
    </div>
  );
};

export default Calendar;
```

### 3. Custom Event Content Component

```typescript
// components/CustomEventContent.tsx
import React from 'react';
import { EventContentArg } from '@fullcalendar/core';
import { Clock, User } from 'lucide-react';

const CustomEventContent: React.FC<{ eventInfo: EventContentArg }> = ({ eventInfo }) => {
  const { event } = eventInfo;
  const task = event.extendedProps.task;
  const assignee = event.extendedProps.assignee;
  const category = event.extendedProps.category;
  const duration = event.extendedProps.duration;

  // Different rendering based on view
  const view = eventInfo.view.type;

  if (view === 'dayGridMonth') {
    // Month view - minimal display
    return (
      <div className="flex items-center gap-1 text-xs">
        {category?.icon && <span>{category.icon}</span>}
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  if (view === 'timeGridWeek') {
    // Week view - compact display
    return (
      <div className="p-1">
        <div className="flex items-center gap-1 text-xs font-medium">
          {category?.icon && <span>{category.icon}</span>}
          <span className="truncate">{event.title}</span>
        </div>
        {assignee && (
          <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
            <User className="w-3 h-3" />
            <span className="truncate">{assignee}</span>
          </div>
        )}
      </div>
    );
  }

  // Day view - full details
  return (
    <div className="p-2">
      <div className="flex items-center gap-2 font-medium text-sm mb-1">
        {category?.icon && <span>{category.icon}</span>}
        <span className="truncate">{event.title}</span>
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        {duration && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{duration} min</span>
          </div>
        )}

        {assignee && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span className="truncate">{assignee}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className={`px-1 py-0.5 rounded text-xs ${getStatusBadgeColor(task.status)}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span>{task.tasks.points}pts</span>
        </div>
      </div>
    </div>
  );
};

const getStatusBadgeColor = (status: string) => {
  const colors = {
    pending: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    skipped: 'bg-gray-100 text-gray-600'
  };
  return colors[status as keyof typeof colors] || colors.pending;
};

export default CustomEventContent;
```

### 4. Calendar Header Component

```typescript
// CalendarHeader.tsx
import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, Grid3x3 } from 'lucide-react';
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';

interface CalendarHeaderProps {
  currentDate: Date;
  currentView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  onViewChange: (view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => void;
  onDateChange: (date: Date) => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  currentView,
  onViewChange,
  onDateChange
}) => {
  const goToPrevious = () => {
    const newDate = currentView === 'dayGridMonth' ? subMonths(currentDate, 1) :
                   currentView === 'timeGridWeek' ? subWeeks(currentDate, 1) :
                   subDays(currentDate, 1);
    onDateChange(newDate);
  };

  const goToNext = () => {
    const newDate = currentView === 'dayGridMonth' ? addMonths(currentDate, 1) :
                   currentView === 'timeGridWeek' ? addWeeks(currentDate, 1) :
                   addDays(currentDate, 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const formatTitle = () => {
    if (currentView === 'dayGridMonth') {
      return format(currentDate, 'MMMM yyyy');
    } else if (currentView === 'timeGridWeek') {
      return format(currentDate, 'MMM dd, yyyy');
    } else {
      return format(currentDate, 'EEEE, MMMM dd, yyyy');
    }
  };

  return (
    <div className="calendar-header p-4 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between">
        {/* Title and Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
          >
            Today
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-gray-900 min-w-48 text-center">
              {formatTitle()}
            </h2>

            <button
              onClick={goToNext}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewChange('dayGridMonth')}
            className={`flex items-center gap-2 px-3 py-1 text-sm rounded ${
              currentView === 'dayGridMonth'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid3x3 className="w-4 h-4" />
            Month
          </button>

          <button
            onClick={() => onViewChange('timeGridWeek')}
            className={`flex items-center gap-2 px-3 py-1 text-sm rounded ${
              currentView === 'timeGridWeek'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Week
          </button>

          <button
            onClick={() => onViewChange('timeGridDay')}
            className={`flex items-center gap-2 px-3 py-1 text-sm rounded ${
              currentView === 'timeGridDay'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            Day
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;
```

## FullCalendar Styling Integration

### CSS Customization
```css
/* Custom FullCalendar styles to match app theme */
.fc {
  font-family: inherit;
}

.fc-event {
  border-radius: 6px;
  border-width: 2px;
  font-size: 12px;
}

.fc-event:hover {
  filter: brightness(1.1);
}

.fc-timegrid-event {
  border-radius: 4px;
}

.fc-daygrid-event {
  border-radius: 3px;
  margin: 1px;
}

/* Tailwind-style colors for events */
.fc-event-pending {
  background-color: rgb(219 234 254);
  border-color: rgb(59 130 246);
  color: rgb(30 64 175);
}

.fc-event-in_progress {
  background-color: rgb(254 215 170);
  border-color: rgb(245 158 11);
  color: rgb(146 64 14);
}

.fc-event-completed {
  background-color: rgb(187 247 208);
  border-color: rgb(34 197 94);
  color: rgb(21 128 61);
}

.fc-event-overdue {
  background-color: rgb(254 202 202);
  border-color: rgb(239 68 68);
  color: rgb(153 27 27);
}
```

## Implementation Tasks

- [ ] Install FullCalendar React dependencies
- [ ] Remove custom calendar view components
- [ ] Create useFullCalendarEvents hook for data transformation
- [ ] Implement main Calendar component with FullCalendar
- [ ] Create CustomEventContent component for task rendering
- [ ] Build CalendarHeader with navigation and view switching
- [ ] Update CalendarFilters to work with FullCalendar events
- [ ] Add custom CSS for styling integration
- [ ] Integrate with existing TaskDetailModal
- [ ] Test all three views (day/week/month) with sample data
- [ ] Add loading states and error handling
- [ ] Ensure responsive behavior on mobile devices

## Benefits of This Approach

### Reduced Complexity
- **From ~800 lines** of custom calendar logic → **~200 lines** of integration code
- **No manual date calculations** - FullCalendar handles this
- **No custom scrolling/virtualization** - Built-in performance

### Enhanced Features
- **Better accessibility** - Screen readers, keyboard navigation
- **Touch support** - Mobile gestures work out of the box
- **Print support** - Built-in print styles
- **Timezone handling** - Robust timezone support if needed

### Better Maintenance
- **Fewer bugs** - Calendar logic is battle-tested
- **Regular updates** - FullCalendar team maintains the library
- **Community support** - Large community for troubleshooting

---

**Status:** Ready for implementation
**Next:** `04-components-integration.md` - Filters and modal integration