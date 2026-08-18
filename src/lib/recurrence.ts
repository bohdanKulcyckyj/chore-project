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
  const day = opts.dtstart.getDate();
  const rule = new RRule({
    freq: Frequency[opts.freq],
    interval: opts.interval ?? 1,
    ...(opts.byweekday?.length ? { byweekday: opts.byweekday } : {}),
    // Monthly on the 29th–31st: fall back to the last day of shorter months
    // instead of silently skipping them (plain FREQ=MONTHLY skips Feb for the 31st).
    ...(opts.freq === 'MONTHLY' && day >= 29 ? { bymonthday: [day, -1], bysetpos: 1 } : {}),
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
    const text = rrulestr(toRRuleString(pattern)).toText();
    // buildPattern's last-day fallback reads "on the 31st and last" — say what it means
    return pattern.rrule.includes('BYSETPOS=1') ? text.replace(' and last', ' or last day') : text;
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

/**
 * Rotation pool restricted to current household members. A row assigned to
 * someone who left fails RLS and aborts the whole per-task upsert (even the
 * duplicate rows), so departed members must be dropped before the modulo.
 * Falls back to the task creator when the whole rotation has left; [] = skip.
 */
export const activeRotation = (
  members: string[],
  activeIds: Set<string>,
  fallback: string | null
): string[] => {
  const active = members.filter(id => activeIds.has(id));
  if (active.length > 0) return active;
  return fallback && activeIds.has(fallback) ? [fallback] : [];
};

export const materializeTask = async (
  task: Task,
  supabaseClient: SupabaseClient<Database>,
  opts: {
    /** Current household member ids. Omit only right after creation, when the
     * rotation was just picked from the live member list. */
    activeMemberIds?: Set<string>;
    /** Must be the calling user (RLS: assigned_by = auth.uid()). Defaults to the
     * task creator, which is the caller at creation time. */
    assignedBy?: string;
    horizonDays?: number;
  } = {}
): Promise<number> => {
  const { activeMemberIds, assignedBy = task.created_by, horizonDays = 28 } = opts;
  if (task.recurrence_type === 'none') return 0;
  const pattern = task.recurrence_pattern as RecurrencePattern | null;
  if (!pattern?.rrule || !pattern.dtstart) return 0;
  const rotation = pattern.rotation?.members ?? [];
  const members = activeMemberIds
    ? activeRotation(rotation, activeMemberIds, task.created_by)
    : rotation;
  if (members.length === 0) {
    console.warn('No active rotation members; skipping task', task.id);
    return 0;
  }

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
    assigned_by: assignedBy,
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
  userId: string,
  supabaseClient: SupabaseClient<Database>
): Promise<boolean> => {
  const [tasksRes, membersRes] = await Promise.all([
    supabaseClient
      .from('tasks')
      .select('*')
      .eq('household_id', householdId)
      .neq('recurrence_type', 'none')
      .eq('is_active', true),
    supabaseClient.from('household_members').select('user_id').eq('household_id', householdId),
  ]);
  const error = tasksRes.error ?? membersRes.error;
  if (error) {
    console.error('Error materializing household:', householdId, error);
    return false;
  }
  const activeMemberIds = new Set((membersRes.data ?? []).map(m => m.user_id));
  let ok = true;
  for (const task of tasksRes.data ?? []) {
    try {
      await materializeTask(task, supabaseClient, { activeMemberIds, assignedBy: userId });
    } catch (taskError) {
      // one bad task must not abort the rest
      console.error('Error materializing task:', task.id, taskError);
      ok = false;
    }
  }
  return ok;
};
