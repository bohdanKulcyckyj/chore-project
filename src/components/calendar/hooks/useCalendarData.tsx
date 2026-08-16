import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, Tables } from '../../../lib/supabase';
import { useHousehold } from '../../../hooks/useHousehold';

export type TaskAssignment = Tables<'task_assignments'>;

export interface TaskWithAssignment extends TaskAssignment {
  tasks: Tables<'tasks'> & {
    task_categories?: Tables<'task_categories'> | null;
  };
  user_profiles?: Tables<'user_profiles'> | null;
}

export interface CalendarFilters {
  memberId: string; // '' = all members
  status: string; // '' = all statuses
}

export interface CalendarDataState {
  tasks: TaskWithAssignment[];
  loading: boolean;
  error: string | null;
  filters: CalendarFilters;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  refreshData: () => Promise<void>;
}

export const useCalendarData = (
  startDate: Date | null,
  endDate: Date | null
): CalendarDataState => {
  const { currentHousehold, members } = useHousehold();
  const [rawTasks, setRawTasks] = useState<TaskWithAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<CalendarFilters>({ memberId: '', status: '' });

  // Fetch exactly the visible range reported by FullCalendar's datesSet ([start, end))
  const fetchCalendarTasks = useCallback(async () => {
    if (!currentHousehold || !startDate || !endDate) return;

    try {
      setLoading(true);
      setError(null);

      // No FK from task_assignments to user_profiles, so no embed here —
      // assignee profiles are resolved client-side from household members below.
      const { data, error } = await supabase
        .from('task_assignments')
        .select('*, tasks!inner(*, task_categories(*))')
        .eq('tasks.household_id', currentHousehold.id)
        .gte('due_datetime', startDate.toISOString())
        .lt('due_datetime', endDate.toISOString())
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

  // Attach assignee profile + apply filters (single filtering layer)
  const tasks = useMemo(() => {
    const profileById = new Map(members.map(m => [m.user_id, m.user_profile]));
    return rawTasks
      .map(t => ({ ...t, user_profiles: profileById.get(t.assigned_to) ?? null }))
      .filter(t =>
        (!filters.memberId || t.assigned_to === filters.memberId) &&
        (!filters.status || t.status === filters.status)
      );
  }, [rawTasks, members, filters]);

  const setFilters = useCallback((newFilters: Partial<CalendarFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  useEffect(() => {
    fetchCalendarTasks();
  }, [fetchCalendarTasks]);

  // Realtime: one subscription per household; latest fetch via ref so date
  // changes don't resubscribe.
  const refetchRef = useRef(fetchCalendarTasks);
  refetchRef.current = fetchCalendarTasks;

  const householdId = currentHousehold?.id;
  useEffect(() => {
    if (!householdId) return;

    // ponytail: unfiltered — postgres_changes can't filter on the joined tasks
    // table's household_id, and the refetch is already scoped to household +
    // date window. Fine at household scale; add a household_id column on
    // task_assignments if fan-out ever matters.
    const channel = supabase
      .channel(`calendar-tasks-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignments' },
        () => refetchRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  return {
    tasks,
    loading,
    error,
    filters,
    setFilters,
    refreshData: fetchCalendarTasks,
  };
};
