import React, { useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DatesSetArg, EventContentArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

import { useHousehold } from '../../hooks/useHousehold';
import { useCalendarData, TaskWithAssignment } from './hooks/useCalendarData';
import { useTaskActions } from './hooks/useTaskActions';
import { useFullCalendarEvents } from './hooks/useFullCalendarEvents';
import TaskDetailModal, { TaskWithAssignment as ModalTask } from '../tasks/TaskDetailModal';

// ponytail: no hour grid — chores stack per day in due order (Google-Calendar-style chips)
const FC_VIEWS = {
  month: 'dayGridMonth',
  week: 'dayGridWeek',
  day: 'dayGridDay',
} as const;
type ViewType = keyof typeof FC_VIEWS;

// Map the calendar's assignment-centric shape to the modal's task-centric one
const toModalTask = (a: TaskWithAssignment): ModalTask => ({
  id: a.id,
  task: { ...a.tasks, category: a.tasks.task_categories ?? undefined },
  assigned_to: a.assigned_to,
  assigned_user: a.user_profiles ?? undefined,
  due_datetime: a.due_datetime ?? undefined,
  status: a.status,
  assigned_at: a.assigned_at,
  assigned_by: a.assigned_by ?? undefined,
});

const Calendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const { members } = useHousehold();

  // FullCalendar is the source of truth for view + visible range (via datesSet)
  const [viewType, setViewType] = useState<ViewType>('week');
  const [title, setTitle] = useState('');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);

  const { tasks, loading, error, filters, setFilters, refreshData } = useCalendarData(
    range?.start ?? null,
    range?.end ?? null
  );
  const {
    selectedTask,
    isModalOpen,
    openTaskModal,
    closeTaskModal,
    completeTask,
    actionLoading,
  } = useTaskActions();

  const events = useFullCalendarEvents(tasks);

  const getApi = () => calendarRef.current?.getApi();

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setTitle(info.view.title);
    setRange({ start: info.start, end: info.end });
    const entry = (Object.entries(FC_VIEWS) as [ViewType, string][]).find(
      ([, fcView]) => fcView === info.view.type
    );
    if (entry) setViewType(entry[0]);
  }, []);

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      openTaskModal(clickInfo.event.extendedProps.task as TaskWithAssignment);
    },
    [openTaskModal]
  );

  // Single-line chip: "18:00 Title · Assignee". Day view has room for all of it;
  // month/week columns are ~48px at 375px → 10px title only, extras from md up. No icons — every char counts.
  const renderEventContent = useCallback((arg: EventContentArg) => {
    const isDay = arg.view.type === FC_VIEWS.day;
    const extra = isDay ? '' : 'hidden md:inline';
    return (
      <div className={`px-1 truncate leading-tight ${isDay ? 'text-xs' : 'text-[10px] md:text-xs'}`}>
        <span className={`font-semibold mr-1 ${extra}`}>{arg.timeText}</span>
        <span className="font-medium">{arg.event.title}</span>
        <span className={`opacity-75 ${extra}`}> · {arg.event.extendedProps.assignee}</span>
      </div>
    );
  }, []);

  const handleComplete = async () => {
    if (selectedTask && (await completeTask(selectedTask))) {
      closeTaskModal();
      refreshData();
    }
  };

  return (
    <div className="calendar-container h-[calc(100dvh-5rem)] md:h-dvh flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-200 bg-white space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Calendar</h1>

          {/* View switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {(Object.keys(FC_VIEWS) as ViewType[]).map(type => (
              <button
                key={type}
                onClick={() => getApi()?.changeView(FC_VIEWS[type])}
                className={`px-3 py-1.5 text-sm rounded capitalize ${
                  viewType === type
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation + title */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => getApi()?.prev()}
              aria-label="Previous"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => getApi()?.next()}
              aria-label="Next"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => getApi()?.today()}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
          </div>
          <h2 className="text-sm md:text-base font-semibold text-gray-900 text-right">
            {title}
            {loading && <span className="ml-2 text-xs font-normal text-gray-400">Loading…</span>}
          </h2>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={filters.memberId}
            onChange={e => setFilters({ memberId: e.target.value })}
            className="flex-1 min-w-0 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            <option value="">All members</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.user_profile?.display_name || 'Unknown'}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={e => setFilters({ status: e.target.value })}
            className="flex-1 min-w-0 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mx-3 md:mx-4 mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0 truncate">Couldn't load tasks: {error}</span>
          <button
            onClick={() => refreshData()}
            className="shrink-0 min-h-[44px] px-3 rounded-lg font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      {/* text-sm on mobile shrinks day numbers/headers (FullCalendar inherits 1em) */}
      <div className="flex-1 min-h-0 p-2 md:p-4 text-sm md:text-base">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin]}
          initialView={FC_VIEWS.week}
          headerToolbar={false}
          height="100%"
          events={events}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          datesSet={handleDatesSet}
          eventDisplay="block"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          // Point events: without this a 23:30 chore gets an implicit 1h end and spans two days
          defaultTimedEventDuration="00:00:00"
          // Fit as many chips as the row height allows, then "+N more" popover
          dayMaxEvents={true}
          moreLinkClick="popover"
          firstDay={0}
          // Compact headers so 375px doesn't overlap
          dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
          views={{ dayGridMonth: { dayHeaderFormat: { weekday: 'short' } } }}
        />
      </div>

      <TaskDetailModal
        isOpen={isModalOpen}
        task={selectedTask ? toModalTask(selectedTask) : null}
        onClose={closeTaskModal}
        onMarkComplete={handleComplete}
        isActionPending={actionLoading}
      />
    </div>
  );
};

export default Calendar;
