import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Tables } from '../../../lib/supabase';
import { useHousehold } from '../../../hooks/useHousehold';
import { format, parseISO, getHours } from 'date-fns';

// Types
export type TaskAssignment = Tables<'task_assignments'>;
export type Task = Tables<'tasks'>;
export type TaskCategory = Tables<'task_categories'>;
export type UserProfile = Tables<'user_profiles'>;

export interface TaskWithAssignment extends TaskAssignment {
  tasks: Task & {
    task_categories?: TaskCategory | null;
  };
  user_profiles?: UserProfile | null;
}

export interface CalendarFilters {
  memberIds: string[];
  statuses: ('pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped')[];
  categoryIds: string[];
}

export interface CalendarDataState {
  // Data
  tasks: TaskWithAssignment[];
  loading: boolean;
  error: string | null;

  // Filtering
  filters: CalendarFilters;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  clearFilters: () => void;

  // Data organization
  getTasksForDate: (date: Date) => TaskWithAssignment[];
  getTasksForTimeSlot: (date: Date, hour: number) => TaskWithAssignment[];

  // Actions
  refreshData: () => Promise<void>;
}

const DEFAULT_FILTERS: CalendarFilters = {
  memberIds: [],
  statuses: [],
  categoryIds: []
};

export const useCalendarData = (
  startDate: Date,
  endDate: Date
): CalendarDataState => {
  const { currentHousehold } = useHousehold();
  const [rawTasks, setRawTasks] = useState<TaskWithAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<CalendarFilters>(DEFAULT_FILTERS);

  // Fetch calendar tasks for the specified date range
  const fetchCalendarTasks = useCallback(async () => {
    if (!currentHousehold) return;

    try {
      setLoading(true);
      setError(null);

      const startISO = format(startDate, 'yyyy-MM-dd\'T\'00:00:00');
      const endISO = format(endDate, 'yyyy-MM-dd\'T\'23:59:59');

      const { data, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          tasks!inner(
            id,
            name,
            description,
            category_id,
            difficulty,
            points,
            estimated_duration,
            task_categories(name, color, icon)
          ),
          user_profiles!assigned_to(
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('tasks.household_id', currentHousehold.id)
        .gte('due_datetime', startISO)
        .lte('due_datetime', endISO)
        .order('due_datetime', { ascending: true });

      if (error) throw error;

      setRawTasks((data as TaskWithAssignment[]) || []);
    } catch (err) {
      console.error('Error fetching calendar tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [currentHousehold, startDate, endDate]);

  // Filter tasks based on current filters
  const filteredTasks = useMemo(() => {
    return rawTasks.filter(task => {
      // Member filter
      if (filters.memberIds.length > 0) {
        if (!filters.memberIds.includes(task.assigned_to)) return false;
      }

      // Status filter
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(task.status)) return false;
      }

      // Category filter
      if (filters.categoryIds.length > 0) {
        if (!task.tasks.category_id || !filters.categoryIds.includes(task.tasks.category_id)) return false;
      }

      return true;
    });
  }, [rawTasks, filters]);

  // Get tasks for a specific date
  const getTasksForDate = useCallback((date: Date): TaskWithAssignment[] => {
    const targetDateStr = format(date, 'yyyy-MM-dd');
    return filteredTasks.filter(task => {
      if (!task.due_datetime) return false;
      const taskDateStr = format(parseISO(task.due_datetime), 'yyyy-MM-dd');
      return taskDateStr === targetDateStr;
    });
  }, [filteredTasks]);

  // Get tasks for a specific time slot (hour) on a date
  const getTasksForTimeSlot = useCallback((date: Date, hour: number): TaskWithAssignment[] => {
    const tasksForDate = getTasksForDate(date);
    return tasksForDate.filter(task => {
      if (!task.due_datetime) return false;
      const taskHour = getHours(parseISO(task.due_datetime));
      return taskHour === hour;
    });
  }, [getTasksForDate]);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<CalendarFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // Refresh data
  const refreshData = useCallback(async () => {
    await fetchCalendarTasks();
  }, [fetchCalendarTasks]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchCalendarTasks();
  }, [fetchCalendarTasks]);

  // Real-time subscription for task changes
  useEffect(() => {
    if (!currentHousehold) return;

    const subscription = supabase
      .channel('calendar-tasks')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
          filter: `tasks.household_id=eq.${currentHousehold.id}`
        },
        () => {
          // Refresh calendar data when task assignments change
          refreshData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentHousehold, refreshData]);

  return {
    tasks: filteredTasks,
    loading,
    error,
    filters,
    setFilters,
    clearFilters,
    getTasksForDate,
    getTasksForTimeSlot,
    refreshData
  };
};