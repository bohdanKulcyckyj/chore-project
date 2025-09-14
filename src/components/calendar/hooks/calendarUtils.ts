import { format, parseISO, subMinutes, getHours, startOfHour, addHours } from 'date-fns';
import { TaskWithAssignment } from './useCalendarData';

/**
 * Calculate the effective start time for a task based on due time and duration
 * This shows when the task should START rather than when it's due
 */
export const getTaskStartTime = (task: TaskWithAssignment): Date | null => {
  if (!task.due_datetime || !task.tasks.estimated_duration) return null;

  const dueTime = parseISO(task.due_datetime);
  const durationMinutes = task.tasks.estimated_duration;

  return subMinutes(dueTime, durationMinutes);
};

/**
 * Get the time range for a task (start time to due time)
 */
export const getTaskTimeRange = (task: TaskWithAssignment): { start: Date; end: Date } | null => {
  if (!task.due_datetime) return null;

  const dueTime = parseISO(task.due_datetime);
  const startTime = getTaskStartTime(task);

  return {
    start: startTime || dueTime,
    end: dueTime
  };
};

/**
 * Format task time for display (e.g., "2:30 PM - 3:00 PM")
 */
export const formatTaskTimeRange = (task: TaskWithAssignment): string => {
  const timeRange = getTaskTimeRange(task);
  if (!timeRange) return 'No time set';

  const startStr = format(timeRange.start, 'h:mm a');
  const endStr = format(timeRange.end, 'h:mm a');

  return `${startStr} - ${endStr}`;
};

/**
 * Check if two tasks have overlapping time ranges
 */
export const tasksOverlap = (task1: TaskWithAssignment, task2: TaskWithAssignment): boolean => {
  const range1 = getTaskTimeRange(task1);
  const range2 = getTaskTimeRange(task2);

  if (!range1 || !range2) return false;

  return range1.start < range2.end && range2.start < range1.end;
};

/**
 * Sort tasks by priority for display in time slots
 * Priority order: overdue -> in_progress -> pending -> completed/skipped
 */
export const sortTasksByPriority = (tasks: TaskWithAssignment[]): TaskWithAssignment[] => {
  const priorityOrder = {
    'overdue': 1,
    'in_progress': 2,
    'pending': 3,
    'completed': 4,
    'skipped': 5
  };

  return [...tasks].sort((a, b) => {
    // First sort by status priority
    const priorityDiff = priorityOrder[a.status] - priorityOrder[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by start time (earlier first)
    const startTimeA = getTaskStartTime(a);
    const startTimeB = getTaskStartTime(b);

    if (startTimeA && startTimeB) {
      return startTimeA.getTime() - startTimeB.getTime();
    }

    // If no start time, sort by due time
    if (a.due_datetime && b.due_datetime) {
      return parseISO(a.due_datetime).getTime() - parseISO(b.due_datetime).getTime();
    }

    return 0;
  });
};

/**
 * Get tasks grouped by hour slots for day/week views
 */
export const getTasksByHourSlots = (
  tasks: TaskWithAssignment[],
  date: Date,
  startHour: number = 0,
  endHour: number = 23
): Record<number, TaskWithAssignment[]> => {
  const tasksByHour: Record<number, TaskWithAssignment[]> = {};

  // Initialize empty slots
  for (let hour = startHour; hour <= endHour; hour++) {
    tasksByHour[hour] = [];
  }

  // Group tasks by their effective hour slot
  tasks.forEach(task => {
    if (!task.due_datetime) return;

    const taskDate = parseISO(task.due_datetime);
    const startTime = getTaskStartTime(task);

    // Use start time if available, otherwise use due time
    const effectiveTime = startTime || taskDate;
    const hour = getHours(effectiveTime);

    if (hour >= startHour && hour <= endHour) {
      tasksByHour[hour].push(task);
    }
  });

  // Sort tasks within each hour slot by priority
  Object.keys(tasksByHour).forEach(hourStr => {
    const hour = parseInt(hourStr);
    tasksByHour[hour] = sortTasksByPriority(tasksByHour[hour]);
  });

  return tasksByHour;
};

/**
 * Detect conflicting tasks (overlapping time ranges)
 */
export const detectConflicts = (tasks: TaskWithAssignment[]): TaskWithAssignment[][] => {
  const conflicts: TaskWithAssignment[][] = [];
  const processedTasks = new Set<string>();

  tasks.forEach((task1, index) => {
    if (processedTasks.has(task1.id)) return;

    const conflictingTasks = [task1];

    for (let i = index + 1; i < tasks.length; i++) {
      const task2 = tasks[i];
      if (processedTasks.has(task2.id)) continue;

      if (tasksOverlap(task1, task2)) {
        conflictingTasks.push(task2);
        processedTasks.add(task2.id);
      }
    }

    if (conflictingTasks.length > 1) {
      conflicts.push(conflictingTasks);
      conflictingTasks.forEach(task => processedTasks.add(task.id));
    }
  });

  return conflicts;
};

/**
 * Format hour for display (e.g., "2 PM", "14:00")
 */
export const formatHour = (hour: number, use24Hour: boolean = false): string => {
  const date = startOfHour(addHours(new Date(0), hour));
  return format(date, use24Hour ? 'HH:mm' : 'h a');
};

/**
 * Get the color class for a task status
 */
export const getTaskStatusColor = (status: TaskWithAssignment['status']): string => {
  const statusColors = {
    'pending': 'bg-blue-100 border-blue-300 text-blue-800',
    'in_progress': 'bg-orange-100 border-orange-300 text-orange-800',
    'completed': 'bg-green-100 border-green-300 text-green-800',
    'overdue': 'bg-red-100 border-red-300 text-red-800',
    'skipped': 'bg-gray-100 border-gray-300 text-gray-600'
  };

  return statusColors[status];
};

/**
 * Get tasks that should be displayed in overflow (beyond visible limit)
 */
export const splitTasksForDisplay = (
  tasks: TaskWithAssignment[],
  maxVisible: number
): { visible: TaskWithAssignment[]; overflow: TaskWithAssignment[] } => {
  const sortedTasks = sortTasksByPriority(tasks);

  return {
    visible: sortedTasks.slice(0, maxVisible),
    overflow: sortedTasks.slice(maxVisible)
  };
};