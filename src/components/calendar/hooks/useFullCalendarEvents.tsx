import { useMemo } from 'react';
import { EventInput } from '@fullcalendar/core';
import { parseISO, subMinutes } from 'date-fns';
import { TaskWithAssignment } from './useCalendarData';

type Status = TaskWithAssignment['status'];

// Direct status → color map (hex, matches app's Tailwind palette)
const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  pending: { bg: '#dbeafe', text: '#1e40af' }, // blue
  in_progress: { bg: '#fed7aa', text: '#9a3412' }, // orange
  completed: { bg: '#dcfce7', text: '#166534' }, // green
  overdue: { bg: '#fee2e2', text: '#991b1b' }, // red
  skipped: { bg: '#f3f4f6', text: '#4b5563' }, // gray
};

// Lower rank renders first (fed into FullCalendar's eventOrder)
const STATUS_RANK: Record<Status, number> = {
  overdue: 0,
  in_progress: 1,
  pending: 2,
  completed: 3,
  skipped: 4,
};

export interface FullCalendarEventData extends EventInput {
  id: string;
  title: string;
  start: Date;
  end: Date;
  extendedProps: {
    task: TaskWithAssignment;
    assignee: string;
    duration: number;
    recurring: boolean;
    rank: number;
  };
}

/**
 * Transform assignment rows into FullCalendar events.
 * Events span [due - estimated_duration, due].
 */
export const useFullCalendarEvents = (tasks: TaskWithAssignment[]): FullCalendarEventData[] => {
  return useMemo(() => {
    return tasks
      .filter(task => task.due_datetime)
      .map(task => {
        const due = parseISO(task.due_datetime as string);
        const duration = task.tasks.estimated_duration || 0;
        const colors = STATUS_COLORS[task.status];

        return {
          id: `task-${task.id}`,
          title: task.tasks.name,
          start: duration ? subMinutes(due, duration) : due,
          end: due,
          backgroundColor: colors.bg,
          borderColor: task.tasks.task_categories?.color || colors.bg,
          textColor: colors.text,
          extendedProps: {
            task,
            assignee: task.user_profiles?.display_name || 'Unassigned',
            duration,
            recurring: task.tasks.recurrence_type !== 'none',
            rank: STATUS_RANK[task.status],
          },
        };
      });
  }, [tasks]);
};
