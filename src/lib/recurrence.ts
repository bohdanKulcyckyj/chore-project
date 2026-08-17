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

// rrule computes in UTC. To get local wall-clock semantics (weekday of BYDAY,
// fixed local hour across DST) we feed it a "floating" date whose UTC fields
// equal the local fields, then map each occurrence back the same way.
// ponytail: assumes the browser's own timezone; store a TZID + luxon only if
// cross-timezone households appear. Spring-forward gap times shift +1h (JS Date).
const toFloating = (d: Date): Date =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
const fromFloating = (d: Date): Date =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());

const toRRuleString = (pattern: RecurrencePattern): string => {
  const dtstart = toFloating(new Date(pattern.dtstart))
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
    ...(opts.until ? { until: toFloating(opts.until) } : {}),
    dtstart: toFloating(opts.dtstart),
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
    rule.all((floating, i) => {
      const date = fromFloating(floating);
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
  if (task.recurrence_type === 'none') return 0;
  const pattern = task.recurrence_pattern as RecurrencePattern | null;
  const members = pattern?.rotation?.members ?? [];
  if (!pattern?.rrule || !pattern.dtstart || members.length === 0) return 0;

  // Window starts at local start-of-today so an occurrence typed for earlier
  // today (allowed by the form) is not dropped.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const occurrences = generateOccurrences(pattern, start, end);
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
};

export const materializeHousehold = async (
  householdId: string,
  supabaseClient: SupabaseClient<Database>
): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from('tasks')
    .select('*')
    .eq('household_id', householdId)
    .neq('recurrence_type', 'none')
    .eq('is_active', true);
  if (error) {
    console.error('Error materializing household:', householdId, error);
    return false;
  }
  let ok = true;
  for (const task of data ?? []) {
    try {
      await materializeTask(task, supabaseClient);
    } catch (taskError) {
      // one bad task must not abort the rest
      console.error('Error materializing task:', task.id, taskError);
      ok = false;
    }
  }
  return ok;
};
