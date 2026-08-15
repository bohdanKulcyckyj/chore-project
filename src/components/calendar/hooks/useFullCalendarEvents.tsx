import { useMemo } from 'react';
import { EventInput } from '@fullcalendar/core';
import { TaskWithAssignment } from './useCalendarData';
import { getTaskStartTime, getTaskStatusColor } from './calendarUtils';

export interface FullCalendarEventData extends EventInput {
  id: string;
  title: string;
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  classNames?: string[];
  extendedProps: {
    task: TaskWithAssignment;
    status: TaskWithAssignment['status'];
    assignee: string;
    category: TaskWithAssignment['tasks']['task_categories'];
    duration: number;
    difficulty: string;
    points: number;
    description: string;
  };
}

/**
 * Custom hook to transform TaskWithAssignment data into FullCalendar events
 * This hook handles the data transformation and memoization for optimal performance
 */
export const useFullCalendarEvents = (tasks: TaskWithAssignment[]): FullCalendarEventData[] => {
  return useMemo(() => {
    return tasks
      .filter(task => task.due_datetime) // Only include tasks with due dates
      .map(task => {
        const startTime = getTaskStartTime(task);
        const endTime = task.due_datetime ? new Date(task.due_datetime) : null;
        const categoryColor = task.tasks.task_categories?.color || '#6b7280';
        const statusColors = getTaskStatusColor(task.status);

        // Extract background color from status colors (remove 'bg-' prefix and convert to hex)
        const bgColorClass = statusColors.match(/bg-(\w+)-(\d+)/);
        const backgroundColor = getBackgroundColorFromTailwind(bgColorClass);

        // Generate event ID
        const eventId = `task-${task.id}`;

        // Determine if it's an all-day event (no specific time set)
        const isAllDay = !startTime && !endTime;

        return {
          id: eventId,
          title: task.tasks.name,
          start: startTime || endTime || task.due_datetime,
          end: endTime,
          allDay: isAllDay,
          backgroundColor: backgroundColor,
          borderColor: categoryColor,
          textColor: getTextColorFromTailwind(statusColors),
          classNames: [
            'fc-event-task',
            `fc-event-${task.status}`,
            `fc-event-${task.tasks.difficulty}`,
            task.tasks.task_categories ? `fc-event-category-${task.tasks.task_categories.name.toLowerCase().replace(/\s+/g, '-')}` : ''
          ].filter(Boolean),
          extendedProps: {
            task,
            status: task.status,
            assignee: task.user_profiles?.display_name || 'Unassigned',
            category: task.tasks.task_categories,
            duration: task.tasks.estimated_duration || 0,
            difficulty: task.tasks.difficulty,
            points: task.tasks.points,
            description: task.tasks.description || ''
          }
        } as FullCalendarEventData;
      });
  }, [tasks]);
};

/**
 * Convert Tailwind background color classes to actual hex colors
 * This provides better visual consistency with the app's design system
 */
function getBackgroundColorFromTailwind(bgColorMatch: RegExpMatchArray | null): string {
  if (!bgColorMatch) return '#e5e7eb'; // gray-200 default

  const [, colorName, shade] = bgColorMatch;

  const colorMap: Record<string, Record<string, string>> = {
    blue: {
      '100': '#dbeafe',
      '200': '#bfdbfe',
      '500': '#3b82f6'
    },
    orange: {
      '100': '#fed7aa',
      '200': '#fbb174',
      '500': '#f97316'
    },
    green: {
      '100': '#dcfce7',
      '200': '#bbf7d0',
      '500': '#22c55e'
    },
    red: {
      '100': '#fee2e2',
      '200': '#fecaca',
      '500': '#ef4444'
    },
    gray: {
      '100': '#f3f4f6',
      '200': '#e5e7eb',
      '500': '#6b7280'
    }
  };

  return colorMap[colorName]?.[shade] || '#e5e7eb';
}

/**
 * Extract text color from Tailwind classes
 */
function getTextColorFromTailwind(statusColors: string): string {
  if (statusColors.includes('text-blue-800')) return '#1e40af';
  if (statusColors.includes('text-orange-800')) return '#9a3412';
  if (statusColors.includes('text-green-800')) return '#166534';
  if (statusColors.includes('text-red-800')) return '#991b1b';
  if (statusColors.includes('text-gray-600')) return '#4b5563';

  return '#374151'; // gray-700 default
}

/**
 * Hook to get events filtered by current filters
 * This can be used to apply additional filtering on top of the base events
 */
export const useFilteredFullCalendarEvents = (
  tasks: TaskWithAssignment[],
  filters: {
    memberIds: string[];
    statuses: string[];
    categoryIds: string[];
  }
): FullCalendarEventData[] => {
  const allEvents = useFullCalendarEvents(tasks);

  return useMemo(() => {
    return allEvents.filter(event => {
      const task = event.extendedProps.task;

      // Filter by member
      if (filters.memberIds.length > 0 && !filters.memberIds.includes(task.assigned_to)) {
        return false;
      }

      // Filter by status
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        return false;
      }

      // Filter by category
      if (filters.categoryIds.length > 0) {
        const categoryId = task.tasks.category_id;
        if (!categoryId || !filters.categoryIds.includes(categoryId)) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, filters]);
};

export default useFullCalendarEvents;