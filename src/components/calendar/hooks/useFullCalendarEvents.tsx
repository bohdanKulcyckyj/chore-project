import { useMemo } from 'react';
import { EventInput } from '@fullcalendar/core';
import { parseISO } from 'date-fns';
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

export interface FullCalendarEventData extends EventInput {
  id: string;
  title: string;
  start: Date;
  extendedProps: {
    task: TaskWithAssignment;
    assignee: string;
  };
}

/**
 * Transform assignment rows into FullCalendar events.
 * Point events at the due time; views stack them in due order (FullCalendar's default eventOrder).
 */
export const useFullCalendarEvents = (tasks: TaskWithAssignment[]): FullCalendarEventData[] => {
  return useMemo(() => {
    return tasks
      .filter(task => task.due_datetime)
      .map(task => {
        const colors = STATUS_COLORS[task.status];

        return {
          id: `task-${task.id}`,
          title: task.tasks.name,
          start: parseISO(task.due_datetime as string),
          backgroundColor: colors.bg,
          borderColor: task.tasks.task_categories?.color || colors.bg,
          textColor: colors.text,
          extendedProps: {
            task,
            assignee: task.user_profiles?.display_name || 'Unassigned',
          },
        };
      });
  }, [tasks]);
};
