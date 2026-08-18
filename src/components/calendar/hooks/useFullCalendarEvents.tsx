import { useMemo } from 'react';
import { EventInput } from '@fullcalendar/core';
import { parseISO } from 'date-fns';
import { TaskWithAssignment } from '../../../lib/api/tasks';
import { STATUS_STYLE } from '../../../lib/taskStyles';

/**
 * Transform assignment rows into FullCalendar events.
 * Point events at the due time; views stack them in due order (FullCalendar's default eventOrder).
 */
export const useFullCalendarEvents = (tasks: TaskWithAssignment[]): EventInput[] =>
  useMemo(
    () =>
      tasks
        .filter(t => t.due_datetime)
        .map(t => {
          const colors = STATUS_STYLE[t.status];
          return {
            id: `task-${t.id}`,
            title: t.task.name,
            start: parseISO(t.due_datetime as string),
            backgroundColor: colors.bg,
            borderColor: t.task.category?.color || colors.bg,
            textColor: colors.text,
            extendedProps: { task: t, assignee: t.assigned_user?.display_name || 'Unassigned' },
          };
        }),
    [tasks]
  );
