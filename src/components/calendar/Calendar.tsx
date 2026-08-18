import React, { useRef, useState, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DatesSetArg, EventContentArg, DayHeaderContentArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

import { useHousehold } from '../../hooks/useHousehold';
import { TaskWithAssignment } from '../../lib/api/tasks';
import { TIME_FMT } from '../../lib/utils';
import { useCalendarData } from './hooks/useCalendarData';
import { useFullCalendarEvents } from './hooks/useFullCalendarEvents';
import TaskDetailModal from '../tasks/TaskDetailModal';
import { useTaskCompletion } from '../tasks/useTaskCompletion';

// ponytail: no hour grid — chores stack per day in due order (Google-Calendar-style chips)
const FC_VIEWS = {
  month: 'dayGridMonth',
  week: 'dayGridWeek',
  day: 'dayGridDay',
} as const;
type ViewType = keyof typeof FC_VIEWS;

// Module-level renderers: FullCalendar compares options by reference, so inline
// literals/closures would make it re-process options on every render.

// Week/day: "Mon 17" (compact for 375px; ICU's own order is "17 Mon"). Month keeps FC's default "Mon".
const renderDayHeader = (a: DayHeaderContentArg) =>
  a.view.type === FC_VIEWS.month ? a.text : format(a.date, 'EEE d');

// Single-line chip: "18:00 Title · Assignee". Day view has room for all of it;
// month/week columns are ~48px at 375px → 10px title only, extras from md up. No icons — every char counts.
const renderEventContent = (arg: EventContentArg) => {
  const isDay = arg.view.type === FC_VIEWS.day;
  const extra = isDay ? '' : 'hidden md:inline';
  return (
    <div className={`px-1 truncate leading-tight ${isDay ? 'text-xs' : 'text-[10px] md:text-xs'}`}>
      <span className={`font-semibold mr-1 ${extra}`}>{arg.event.start && format(arg.event.start, TIME_FMT)}</span>
      <span className="font-medium">{arg.event.title}</span>
      <span className={`opacity-75 ${extra}`}> · {arg.event.extendedProps.assignee}</span>
    </div>
  );
};

const Calendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { members } = useHousehold();

  // FullCalendar is the source of truth for view + visible range (via datesSet)
  const [viewType, setViewType] = useState<ViewType>('week');
  const [title, setTitle] = useState('');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignment | null>(null);

  const { tasks, loading, error, filters, setFilters, refreshData } = useCalendarData(
    range?.start ?? null,
    range?.end ?? null
  );
  // Same completion flow as the Tasks page (proof/notes/celebration/purchase editor)
  const { startCompletion, modals } = useTaskCompletion({ onCompleted: () => { setSelectedTask(null); refreshData(); } });

  const events = useFullCalendarEvents(tasks);

  const getApi = () => calendarRef.current?.getApi();

  // FullCalendar only re-measures on window resize, and does so mid sidebar
  // transition (stale inner width after crossing md) — re-measure whenever the wrapper settles.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => calendarRef.current?.getApi().updateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setTitle(info.view.title);
    setRange({ start: info.start, end: info.end });
    const entry = (Object.entries(FC_VIEWS) as [ViewType, string][]).find(
      ([, fcView]) => fcView === info.view.type
    );
    if (entry) setViewType(entry[0]);
  }, []);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    setSelectedTask(clickInfo.event.extendedProps.task as TaskWithAssignment);
  }, []);


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
                // Land on today when it's on screen, else keep the anchor (browsing March stays in March)
                onClick={() => {
                  const now = new Date();
                  const inView = range && now >= range.start && now < range.end;
                  getApi()?.changeView(FC_VIEWS[type], inView ? now : undefined);
                }}
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

        {/* Filters (text-base on mobile: iOS zooms on focus below 16px) */}
        <div className="flex items-center gap-2">
          <select
            value={filters.memberId}
            onChange={e => setFilters({ memberId: e.target.value })}
            className="flex-1 min-w-0 text-base md:text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700"
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
            className="flex-1 min-w-0 text-base md:text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700"
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
      <div ref={gridRef} className="flex-1 min-h-0 p-2 md:p-4 text-sm md:text-base">
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
          // Point events: without this a 23:30 chore gets an implicit 1h end and spans two days
          defaultTimedEventDuration="00:00:00"
          // Fit as many chips as the row height allows, then "+N more" jumps to the day view
          // (FC's popover sits at z-index 9999, above TaskDetailModal, and only closes on outside mousedown)
          dayMaxEvents={true}
          moreLinkClick="day"
          firstDay={0}
          dayHeaderContent={renderDayHeader}
        />
      </div>

      <TaskDetailModal
        isOpen={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onMarkComplete={startCompletion}
      />
      {modals}
    </div>
  );
};

export default Calendar;
