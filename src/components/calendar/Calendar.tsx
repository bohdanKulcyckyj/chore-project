import React, { useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DateSelectArg, DatesSetArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import { useCalendarData } from './hooks/useCalendarData';
import { useCalendarView, CalendarViewType } from './hooks/useCalendarView';
import { useTaskActions } from './hooks/useTaskActions';
import { useFilteredFullCalendarEvents } from './hooks/useFullCalendarEvents';

// We'll create these components next
// import CustomEventContent from './components/CustomEventContent';
// import CalendarHeader from './CalendarHeader';
// import CalendarFilters from './CalendarFilters';

// For now, let's import the existing task detail modal
// import TaskDetailModal from '../tasks/TaskDetailModal';

const Calendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);

  // Use our existing Phase 2 hooks
  const { viewType, setCurrentDate, setViewType, dateRange } = useCalendarView();
  const { tasks, loading, filters } = useCalendarData(dateRange.start, dateRange.end);
  const { openTaskModal } = useTaskActions();

  // Transform tasks to FullCalendar events with filtering
  const events = useFilteredFullCalendarEvents(tasks, filters);

  // Event interaction handlers (memoized for performance)
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const task = clickInfo.event.extendedProps.task;
    openTaskModal(task);
  }, [openTaskModal]);

  const handleDateClick = useCallback((dateClickInfo: { dateStr: string }) => {
    // Future: Could open "create task" modal here
    console.log('Date clicked:', dateClickInfo.dateStr);
  }, []);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // Future: Handle date range selection for creating tasks
    console.log('Date range selected:', selectInfo.startStr, selectInfo.endStr);

    // Unselect after handling
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.unselect();
  }, []);

  // Navigation callback
  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    setCurrentDate(dateInfo.start);
  }, [setCurrentDate]);

  // Convert our view types to FullCalendar view types
  const getFullCalendarView = (viewType: CalendarViewType): string => {
    switch (viewType) {
      case 'day': return 'timeGridDay';
      case 'week': return 'timeGridWeek';
      case 'month': return 'dayGridMonth';
      default: return 'timeGridWeek';
    }
  };

  // Temporary event content renderer (we'll replace with CustomEventContent)
  const renderEventContent = useCallback((eventInfo: { event: { title: string; extendedProps: { assignee: string; duration: number } } }) => {
    const { event } = eventInfo;
    const assignee = event.extendedProps.assignee;
    const duration = event.extendedProps.duration;

    return (
      <div className="p-1">
        <div className="font-medium text-sm truncate">
          {event.title}
        </div>
        {assignee && (
          <div className="text-xs text-gray-600 truncate">
            {assignee} {duration ? `• ${duration}min` : ''}
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <div className="calendar-container h-full flex flex-col bg-white">
      {/* Temporary header - we'll replace with CalendarHeader */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Household Calendar</h1>

          {/* Temporary view switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewType('month')}
              className={`px-3 py-1 text-sm rounded ${
                viewType === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewType('week')}
              className={`px-3 py-1 text-sm rounded ${
                viewType === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewType('day')}
              className={`px-3 py-1 text-sm rounded ${
                viewType === 'day'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Day
            </button>
          </div>
        </div>

        {/* Task count */}
        <p className="text-sm text-gray-600 mt-2">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          {loading && ' • Loading...'}
        </p>
      </div>

      {/* FullCalendar Component */}
      <div className="flex-1 overflow-hidden p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}

          // View Configuration
          initialView={getFullCalendarView(viewType)}
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
          datesSet={handleDatesSet}

          // Time Configuration
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="01:00:00"
          allDaySlot={true}

          // Event Display & Overflow (KEY FEATURE!)
          aspectRatio={window.innerWidth < 768 ? 1.2 : 1.8}
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

          // Loading callback (not a boolean)
          loading={(isLoading: boolean) => {
            // Loading state is handled by the component
            console.log('Calendar loading:', isLoading);
          }}

          // Weekend handling
          weekends={true}

          // First day of week
          firstDay={0} // Sunday = 0, Monday = 1

          // Event overlap and stacking (key for multiple tasks)
          slotEventOverlap={false} // Prevents visual overlap in time slots
          eventOverlap={false} // Prevents event overlap conflicts

          // Responsive
          nowIndicator={true} // Show current time line
          scrollTime="08:00:00" // Scroll to 8am by default

          // Styling
          dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
        />
      </div>

      {/* Task Detail Modal - Temporarily commented until we import it properly */}
      {/*
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
      */}
    </div>
  );
};

export default Calendar;