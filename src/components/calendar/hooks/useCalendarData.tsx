import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useHousehold } from '../../../hooks/useHousehold';
import { TaskWithAssignment, fetchAssignments, attachAssignees, deriveStatus } from '../../../lib/api/tasks';

export interface CalendarFilters {
  memberId: string; // '' = all members
  status: string; // '' = all statuses
}

/** Calendar row: real DB `status` (guards read this) + display-only `displayStatus` (chips/filter). */
export type CalendarTask = TaskWithAssignment & {
  displayStatus: ReturnType<typeof deriveStatus<TaskWithAssignment['status']>>;
};

export interface CalendarDataState {
  tasks: CalendarTask[];
  loading: boolean;
  error: string | null;
  filters: CalendarFilters;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  refreshData: () => Promise<void>;
}

// supabase.channel(topic) hands back a same-named channel that is still leaving
// (fast unmount/remount, StrictMode), whose subscribe() then no-ops → unique topic per mount.
let channelSeq = 0;

export const useCalendarData = (
  startDate: Date | null,
  endDate: Date | null
): CalendarDataState => {
  const { currentHousehold, members } = useHousehold();
  const [rawTasks, setRawTasks] = useState<TaskWithAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<CalendarFilters>({ memberId: '', status: '' });

  // Latest-wins: rapid prev/prev/next must not let an older range's response
  // overwrite the newer one.
  const fetchSeq = useRef(0);

  // Fetch the visible range reported by FullCalendar's datesSet ([start, end))
  const fetchCalendarTasks = useCallback(async () => {
    if (!currentHousehold || !startDate || !endDate) return;
    const seq = ++fetchSeq.current;

    try {
      setLoading(true);
      setError(null);
      const rows = await fetchAssignments({ householdId: currentHousehold.id, from: startDate, to: endDate });
      if (seq !== fetchSeq.current) return; // stale response
      setRawTasks(rows);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      console.error('Error fetching calendar tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [currentHousehold, startDate, endDate]);

  // Attach assignee profile, derive overdue (display-only, day-based like scoring), apply filters.
  // `status` keeps the real DB value: overwriting it with 'overdue' broke completionBlocker
  // (and so the modal's Mark Complete button) for every overdue row. Display status goes in
  // `displayStatus`, which is what the chips colour by and what the status filter matches.
  const tasks = useMemo(
    () =>
      attachAssignees(rawTasks, members)
        .map(t => ({ ...t, displayStatus: deriveStatus(t) }))
        .filter(
          t =>
            (!filters.memberId || t.assigned_to === filters.memberId) &&
            (!filters.status || t.displayStatus === filters.status)
        ),
    [rawTasks, members, filters]
  );

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
    // Debounced: a materialization batch fires one event per row.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`calendar-tasks-${householdId}-${++channelSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignments' },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => refetchRef.current(), 300);
        }
      )
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Calendar realtime subscription ${status}`);
        }
      });

    return () => {
      clearTimeout(timer);
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
