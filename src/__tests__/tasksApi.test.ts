import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal chainable supabase mock: records every query (table, op, filters,
// payload) and answers via a per-test `respond` handler.
type Call = {
  table: string;
  op: 'select' | 'insert' | 'update' | '';
  select?: string;
  payload?: unknown;
  filters: [string, string, unknown][];
  order?: [string, { ascending: boolean }];
  single?: boolean;
};
type Reply = { data: unknown; error: unknown };

const mock = vi.hoisted(() => {
  const state = { calls: [] as Call[], respond: (_c: Call): Reply => ({ data: null, error: null }) };
  const from = (table: string) => {
    const call: Call = { table, op: '', filters: [] };
    const b = {
      select(cols?: string) { if (!call.op) call.op = 'select'; call.select = cols; return b; },
      insert(p: unknown) { call.op = 'insert'; call.payload = p; return b; },
      update(p: unknown) { call.op = 'update'; call.payload = p; return b; },
      eq(k: string, v: unknown) { call.filters.push(['eq', k, v]); return b; },
      neq(k: string, v: unknown) { call.filters.push(['neq', k, v]); return b; },
      gte(k: string, v: unknown) { call.filters.push(['gte', k, v]); return b; },
      lt(k: string, v: unknown) { call.filters.push(['lt', k, v]); return b; },
      in(k: string, v: unknown) { call.filters.push(['in', k, v]); return b; },
      or(expr: string) { call.filters.push(['or', expr, undefined]); return b; },
      order(k: string, o: { ascending: boolean }) { call.order = [k, o]; return b; },
      single() { call.single = true; return b; },
      then(res: (v: Reply) => unknown, rej?: (e: unknown) => unknown) {
        state.calls.push(call);
        return Promise.resolve(state.respond(call)).then(res, rej);
      },
    };
    return b;
  };
  return {
    state,
    supabase: { from, auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } },
  };
});

vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));

import {
  canCompleteNow,
  completeTask,
  completionBlocker,
  daysBetween,
  deriveStatus,
  fetchAssignments,
  fetchAssignmentsForTasks,
  isDueAfterToday,
  isOverdue,
  pickCurrentOccurrence,
  ASSIGNMENT_SELECT,
} from '../lib/api/tasks';

const now = new Date(2026, 7, 17, 20, 1); // local Aug 17 2026 20:01
const local = (...args: [number, number, number, number?]) => new Date(...args).toISOString();

describe('isDueAfterToday', () => {
  it('is false for undated, past, and later-today due times', () => {
    expect(isDueAfterToday(null, now)).toBe(false);
    expect(isDueAfterToday(local(2026, 7, 10, 9), now)).toBe(false);
    expect(isDueAfterToday(new Date(2026, 7, 17, 23, 30).toISOString(), now)).toBe(false);
  });

  it('is true from local midnight tomorrow onward (no 24h leak)', () => {
    expect(isDueAfterToday(new Date(2026, 7, 18, 0, 0, 0, 1).toISOString(), now)).toBe(true);
    expect(isDueAfterToday(local(2026, 7, 18, 9), now)).toBe(true);
  });
});

describe('isOverdue / deriveStatus (day-based)', () => {
  it('is overdue only when the due DATE is before today', () => {
    expect(isOverdue({ status: 'pending', due_datetime: local(2026, 7, 16, 23) }, now)).toBe(true);
    expect(isOverdue({ status: 'in_progress', due_datetime: local(2026, 7, 16, 23) }, now)).toBe(true);
    // due earlier today at 09:00, now is 20:01 → NOT overdue (same day)
    expect(isOverdue({ status: 'pending', due_datetime: local(2026, 7, 17, 9) }, now)).toBe(false);
    expect(isOverdue({ status: 'pending', due_datetime: local(2026, 7, 18, 9) }, now)).toBe(false);
  });

  it('never flags completed/skipped/undated rows', () => {
    expect(isOverdue({ status: 'completed', due_datetime: local(2026, 7, 1, 9) }, now)).toBe(false);
    expect(isOverdue({ status: 'skipped', due_datetime: local(2026, 7, 1, 9) }, now)).toBe(false);
    expect(isOverdue({ status: 'pending', due_datetime: null }, now)).toBe(false);
  });

  it('deriveStatus returns overdue or the stored status', () => {
    expect(deriveStatus({ status: 'pending', due_datetime: local(2026, 7, 16, 9) }, now)).toBe('overdue');
    expect(deriveStatus({ status: 'pending', due_datetime: local(2026, 7, 17, 9) }, now)).toBe('pending');
  });

  it('daysBetween counts local calendar days', () => {
    expect(daysBetween(new Date(2026, 7, 17, 9), new Date(2026, 7, 17, 23))).toBe(0);
    expect(daysBetween(new Date(2026, 7, 16, 23), new Date(2026, 7, 17, 0, 1))).toBe(1);
    expect(daysBetween(new Date(2026, 7, 20), new Date(2026, 7, 17))).toBe(0); // early
  });
});

describe('canCompleteNow', () => {
  const base = { status: 'pending', assigned_to: 'u1', due_datetime: local(2026, 7, 20, 9) };
  it('one-off future OK; recurring future blocked', () => {
    expect(canCompleteNow({ ...base, task: { recurrence_type: 'none' } }, 'u1', now)).toBe(true);
    expect(canCompleteNow({ ...base, task: { recurrence_type: 'weekly' } }, 'u1', now)).toBe(false);
    expect(canCompleteNow({ ...base, due_datetime: local(2026, 7, 17, 22), task: { recurrence_type: 'weekly' } }, 'u1', now)).toBe(true);
  });
  it('non-assignee, completed, and unassigned blocked', () => {
    expect(canCompleteNow({ ...base, task: { recurrence_type: 'none' } }, 'u2', now)).toBe(false);
    expect(canCompleteNow({ ...base, task: { recurrence_type: 'none' } }, undefined, now)).toBe(false);
    expect(canCompleteNow({ ...base, status: 'completed', task: { recurrence_type: 'none' } }, 'u1', now)).toBe(false);
    expect(canCompleteNow({ ...base, assigned_to: null, task: { recurrence_type: 'none' } }, 'u1', now)).toBe(false);
  });
  it('completionBlocker returns the API message (or null when allowed)', () => {
    expect(completionBlocker({ ...base, task: { recurrence_type: 'none' } }, 'u1', now)).toBeNull();
    expect(completionBlocker({ ...base, task: { recurrence_type: 'none' } }, 'u2', now)).toBe('You are not assigned to this task');
    expect(completionBlocker({ ...base, status: 'completed', task: { recurrence_type: 'none' } }, 'u1', now)).toBe('Task is already completed');
    expect(completionBlocker({ ...base, task: { recurrence_type: 'weekly' } }, 'u1', now)).toMatch(/^This chore isn't due until /);
  });
});

describe('pickCurrentOccurrence', () => {
  const row = (day: number, status = 'pending', hour = 9) => ({ status, due_datetime: local(2026, 7, day, hour) });

  it('missed daily week → today\'s occurrence (latest open due by end of today)', () => {
    const rows = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(d => row(d));
    expect(pickCurrentOccurrence(rows, now)).toEqual(row(17));
  });
  it('weekly due yesterday, next in 6 days → yesterday\'s (overdue, still completable)', () => {
    const rows = [row(16), row(23)];
    expect(pickCurrentOccurrence(rows, now)).toEqual(row(16));
    expect(deriveStatus(pickCurrentOccurrence(rows, now)!, now)).toBe('overdue');
  });
  it('all completed → the latest completed one', () => {
    const rows = [row(15, 'completed'), row(17, 'completed'), row(16, 'completed')];
    expect(pickCurrentOccurrence(rows, now)).toEqual(row(17, 'completed'));
  });
  it('only future → the earliest future one; order-independent', () => {
    const rows = [row(25), row(18), row(20)];
    expect(pickCurrentOccurrence(rows, now)).toEqual(row(18));
  });
  it('completed today + open tomorrow → tomorrow (open beats closed); empty → undefined', () => {
    expect(pickCurrentOccurrence([row(17, 'completed'), row(18)], now)).toEqual(row(18));
    expect(pickCurrentOccurrence([], now)).toBeUndefined();
  });
});

describe('fetchAssignmentsForTasks query shape', () => {
  beforeEach(() => { mock.state.calls = []; });
  const oneOff = { id: 't1', recurrence_type: 'none' } as const;
  const daily = { id: 't2', recurrence_type: 'daily' } as const;

  it('scopes to the tasks, keeps every one-off row, bounds recurring rows to the last 30 days', async () => {
    mock.state.respond = () => ({ data: [{ id: 'a1' }], error: null });
    const before = Date.now();
    const rows = await fetchAssignmentsForTasks([oneOff, daily]);
    expect(rows).toEqual([{ id: 'a1' }]);
    const [call] = mock.state.calls;
    expect(call.table).toBe('task_assignments');
    expect(call.filters[0]).toEqual(['in', 'task_id', ['t1', 't2']]);
    const [op, expr] = call.filters[1];
    expect(op).toBe('or');
    const m = /^task_id\.in\.\(t1\),due_datetime\.gte\.(.+)$/.exec(expr);
    expect(m).not.toBeNull();
    const cutoff = new Date(m![1]).getTime();
    expect(before - cutoff).toBeGreaterThanOrEqual(30 * 86400000 - 1000);
    expect(before - cutoff).toBeLessThan(30 * 86400000 + 5000);
    expect(call.order).toEqual(['due_datetime', { ascending: true }]);
  });

  it('no one-off tasks → plain gte (PostgREST rejects an empty in.())', async () => {
    mock.state.respond = () => ({ data: [], error: null });
    await fetchAssignmentsForTasks([daily]);
    const [call] = mock.state.calls;
    expect(call.filters.map(f => f[0])).toEqual(['in', 'gte']);
  });

  it('no tasks → no query; error → throws', async () => {
    expect(await fetchAssignmentsForTasks([])).toEqual([]);
    expect(mock.state.calls).toHaveLength(0);
    mock.state.respond = () => ({ data: null, error: new Error('boom') });
    await expect(fetchAssignmentsForTasks([oneOff])).rejects.toThrow('boom');
  });
});

describe('fetchAssignments query shape', () => {
  beforeEach(() => { mock.state.calls = []; });

  it('embeds task+category, filters household via the inner join, ranges due_datetime', async () => {
    mock.state.respond = () => ({ data: [{ id: 'a1' }], error: null });
    const rows = await fetchAssignments({
      householdId: 'h1', assignedTo: 'u1', from: new Date('2026-08-17T00:00:00Z'), to: '2026-08-18T00:00:00Z', withCompletions: true,
    });
    expect(rows).toEqual([{ id: 'a1' }]);
    const [call] = mock.state.calls;
    expect(call.table).toBe('task_assignments');
    expect(call.select).toBe(`${ASSIGNMENT_SELECT}, task_completions(*)`);
    expect(call.filters).toEqual([
      ['eq', 'task.household_id', 'h1'],
      ['eq', 'assigned_to', 'u1'],
      ['gte', 'due_datetime', '2026-08-17T00:00:00.000Z'],
      ['lt', 'due_datetime', '2026-08-18T00:00:00Z'],
    ]);
    expect(call.order).toEqual(['due_datetime', { ascending: true }]);
  });

  it('throws on error', async () => {
    mock.state.respond = () => ({ data: null, error: new Error('boom') });
    await expect(fetchAssignments({ householdId: 'h1' })).rejects.toThrow('boom');
  });
});

describe('completeTask', () => {
  const task = { id: 't1', household_id: 'h1', points: 10, requires_approval: false, recurrence_type: 'none' };
  const assignment = { id: 'a1', assigned_to: 'u1', status: 'pending', due_datetime: null, task };
  const calls = (op: Call['op'], table: string) => mock.state.calls.filter(c => c.op === op && c.table === table);

  beforeEach(() => { mock.state.calls = []; });

  it('happy path: CAS status → insert completion → points scoped to task.household_id', async () => {
    mock.state.respond = c => {
      if (c.table === 'task_assignments' && c.op === 'select') return { data: assignment, error: null };
      if (c.table === 'task_assignments' && c.op === 'update') return { data: [{ id: 'a1' }], error: null };
      if (c.table === 'task_completions') return { data: { id: 'c1' }, error: null };
      if (c.table === 'user_points' && c.op === 'select') {
        return { data: { total_points: 5, current_streak: 1, longest_streak: 1, tasks_completed: 1 }, error: null };
      }
      return { data: null, error: null };
    };
    const result = await completeTask('a1', {});
    expect(result).toMatchObject({ points: 10, completionId: 'c1' });

    const cas = calls('update', 'task_assignments')[0];
    expect(cas.payload).toEqual({ status: 'completed' });
    expect(cas.filters).toEqual([['eq', 'id', 'a1'], ['neq', 'status', 'completed']]);
    // CAS runs before the completion insert
    expect(mock.state.calls.indexOf(cas)).toBeLessThan(mock.state.calls.indexOf(calls('insert', 'task_completions')[0]));
    // no household_members lookup; points keyed by the task's household
    expect(mock.state.calls.some(c => c.table === 'household_members')).toBe(false);
    for (const c of calls('select', 'user_points').concat(calls('update', 'user_points'))) {
      expect(c.filters).toContainEqual(['eq', 'household_id', 'h1']);
    }
  });

  it('already completed (lost the race): throws, inserts nothing', async () => {
    mock.state.respond = c => {
      if (c.table === 'task_assignments' && c.op === 'select') return { data: assignment, error: null }; // stale read
      if (c.table === 'task_assignments' && c.op === 'update') return { data: [], error: null }; // 0 rows: someone else won
      return { data: null, error: null };
    };
    await expect(completeTask('a1', {})).rejects.toThrow('Task is already completed');
    expect(calls('insert', 'task_completions')).toHaveLength(0);
    expect(calls('update', 'user_points')).toHaveLength(0);
  });

  it('completion insert fails: reverts status and rethrows', async () => {
    mock.state.respond = c => {
      if (c.table === 'task_assignments' && c.op === 'select') return { data: assignment, error: null };
      if (c.table === 'task_assignments' && c.op === 'update') return { data: [{ id: 'a1' }], error: null };
      if (c.table === 'task_completions') return { data: null, error: new Error('insert failed') };
      return { data: null, error: null };
    };
    await expect(completeTask('a1', {})).rejects.toThrow('insert failed');
    const updates = calls('update', 'task_assignments');
    expect(updates).toHaveLength(2);
    expect(updates[1].payload).toEqual({ status: 'pending' });
    expect(calls('update', 'user_points')).toHaveLength(0);
  });

  it('non-assignee is rejected before any write', async () => {
    mock.state.respond = () => ({ data: { ...assignment, assigned_to: 'u2' }, error: null });
    await expect(completeTask('a1', {})).rejects.toThrow('You are not assigned to this task');
    expect(calls('update', 'task_assignments')).toHaveLength(0);
  });
});
