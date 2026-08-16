import { RRule, rrulestr, Frequency } from 'rrule';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, RecurrencePattern } from '../types/database';

type Task = Database['public']['Tables']['tasks']['Row'];

export type { RecurrencePattern };

// ponytail: no exceptions/exdates support yet; add an `exceptions: string[]`
// field + RRuleSet.exdate() when "skip this holiday" becomes a real request.

// ponytail: runaway guard — never iterate more than this many occurrences from
// dtstart. Tasks whose dtstart is >1000 occurrences in the past stop generating;
// fix path: advance the stored dtstart periodically or seek with rule.after().
const MAX_OCCURRENCES = 1000;

const toRRuleString = (pattern: RecurrencePattern): string => {
  const dtstart = new Date(pattern.dtstart)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return `DTSTART:${dtstart}\nRRULE:${pattern.rrule}`;
};

export const buildPattern = (opts: {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval?: number;
  byweekday?: number[]; // 0=Mon ... 6=Sun (RRule convention)
  until?: Date;
  dtstart: Date;
}): RecurrencePattern => {
  const rule = new RRule({
    freq: Frequency[opts.freq],
    interval: opts.interval ?? 1,
    ...(opts.byweekday?.length ? { byweekday: opts.byweekday } : {}),
    ...(opts.until ? { until: opts.until } : {}),
    dtstart: opts.dtstart,
  });
  const rruleLine = rule
    .toString()
    .split('\n')
    .find(line => line.startsWith('RRULE:'));
  return {
    rrule: (rruleLine ?? '').replace('RRULE:', ''),
    dtstart: opts.dtstart.toISOString(),
  };
};

export const getRecurrenceText = (pattern: RecurrencePattern): string => {
  try {
    return rrulestr(toRRuleString(pattern)).toText();
  } catch {
    return 'Custom recurrence';
  }
};

// ponytail: rrule computes in UTC-as-floating time — dtstart is fed as the real
// UTC instant, so across a DST boundary a "21:00 local" task drifts by an hour.
// Fix path: luxon + TZID-aware rrule (or store tz and re-anchor per occurrence).
export const generateOccurrences = (
  pattern: RecurrencePattern,
  windowStart: Date,
  windowEnd: Date
): { date: Date; index: number }[] => {
  if (!pattern?.rrule || !pattern?.dtstart) return [];
  try {
    const rule = rrulestr(toRRuleString(pattern));
    // Iterate from dtstart so `index` is the absolute occurrence index —
    // rotation stays stable no matter which window we generate for.
    // Window is [windowStart, windowEnd).
    const out: { date: Date; index: number }[] = [];
    rule.all((date, i) => {
      if (i >= MAX_OCCURRENCES || date >= windowEnd) return false;
      if (date >= windowStart) out.push({ date, index: i });
      return true;
    });
    return out;
  } catch (error) {
    console.error('Invalid recurrence pattern:', error, pattern);
    return [];
  }
};

export const materializeTask = async (
  task: Task,
  supabaseClient: SupabaseClient<Database>,
  horizonDays = 28
): Promise<number> => {
  try {
    if (task.recurrence_type === 'none') return 0;
    const pattern = task.recurrence_pattern as RecurrencePattern | null;
    const members = pattern?.rotation?.members ?? [];
    if (!pattern?.rrule || !pattern.dtstart || members.length === 0) return 0;

    const now = new Date();
    const end = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const occurrences = generateOccurrences(pattern, now, end);
    if (occurrences.length === 0) return 0;

    const startIndex = pattern.rotation?.startIndex ?? 0;
    const rows = occurrences.map(({ date, index }) => ({
      task_id: task.id,
      assigned_to: members[(startIndex + index) % members.length],
      due_datetime: date.toISOString(),
      assigned_by: task.created_by ?? members[0],
      status: 'pending' as const,
    }));

    const { error } = await supabaseClient
      .from('task_assignments')
      .upsert(rows, { onConflict: 'task_id,due_datetime', ignoreDuplicates: true });
    if (error) throw error;
    return rows.length;
  } catch (error) {
    console.error('Error materializing task:', task.id, error);
    return 0;
  }
};

export const materializeHousehold = async (
  householdId: string,
  supabaseClient: SupabaseClient<Database>
): Promise<void> => {
  try {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('household_id', householdId)
      .neq('recurrence_type', 'none')
      .eq('is_active', true);
    if (error) throw error;
    for (const task of data ?? []) {
      await materializeTask(task, supabaseClient);
    }
  } catch (error) {
    console.error('Error materializing household:', householdId, error);
  }
};
