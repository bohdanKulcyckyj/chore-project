import { describe, expect, it } from 'vitest';
import {
  buildPattern,
  generateOccurrences,
  getRecurrenceText,
  RecurrencePattern,
} from '../lib/recurrence';

const WINDOW_START = new Date('2026-01-01T00:00:00Z');
const WINDOW_END = new Date('2026-03-01T00:00:00Z');

describe('buildPattern', () => {
  it('stores rrule without DTSTART and dtstart as ISO', () => {
    const dtstart = new Date('2026-01-05T09:00:00Z');
    const pattern = buildPattern({ freq: 'WEEKLY', byweekday: [0, 2, 4], dtstart });
    expect(pattern.rrule).toContain('FREQ=WEEKLY');
    expect(pattern.rrule).toContain('BYDAY=MO,WE,FR');
    expect(pattern.rrule).not.toContain('DTSTART');
    expect(pattern.dtstart).toBe('2026-01-05T09:00:00.000Z');
  });
});

describe('getRecurrenceText', () => {
  it('round-trips to human text', () => {
    const pattern = buildPattern({
      freq: 'DAILY',
      dtstart: new Date('2026-01-01T09:00:00Z'),
    });
    expect(getRecurrenceText(pattern)).toBe('every day');
  });

  it('falls back on parse failure', () => {
    expect(
      getRecurrenceText({ rrule: 'FREQ=BOGUS', dtstart: '2026-01-01T09:00:00Z' })
    ).toBe('Custom recurrence');
  });
});

describe('generateOccurrences', () => {
  it('respects daily COUNT', () => {
    const pattern: RecurrencePattern = {
      rrule: 'FREQ=DAILY;COUNT=5',
      dtstart: '2026-01-01T09:00:00.000Z',
    };
    const occ = generateOccurrences(pattern, WINDOW_START, WINDOW_END);
    expect(occ).toHaveLength(5);
    expect(occ.map(o => o.index)).toEqual([0, 1, 2, 3, 4]);
    expect(occ[0].date.toISOString()).toBe('2026-01-01T09:00:00.000Z');
    expect(occ[4].date.toISOString()).toBe('2026-01-05T09:00:00.000Z');
  });

  it('weekly BYDAY lands on the right weekdays', () => {
    const pattern: RecurrencePattern = {
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      dtstart: '2026-01-05T18:00:00.000Z', // a Monday
    };
    const occ = generateOccurrences(pattern, WINDOW_START, new Date('2026-02-01T00:00:00Z'));
    expect(occ.length).toBeGreaterThan(0);
    occ.forEach(o => {
      expect([1, 3, 5]).toContain(o.date.getUTCDay()); // Mon/Wed/Fri
    });
  });

  it('monthly BYMONTHDAY lands on that day', () => {
    const pattern: RecurrencePattern = {
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=15',
      dtstart: '2026-01-15T09:00:00.000Z',
    };
    const occ = generateOccurrences(pattern, WINDOW_START, new Date('2026-06-01T00:00:00Z'));
    expect(occ).toHaveLength(5); // Jan–May
    occ.forEach(o => expect(o.date.getUTCDate()).toBe(15));
  });

  it('rotation index is absolute: same date => same assignee across windows', () => {
    const pattern: RecurrencePattern = {
      rrule: 'FREQ=DAILY',
      dtstart: '2026-01-01T09:00:00.000Z',
      rotation: { members: ['u1', 'u2', 'u3'] },
    };
    const members = pattern.rotation!.members;
    const assignee = (index: number) => members[index % members.length];

    const fullWindow = generateOccurrences(pattern, WINDOW_START, new Date('2026-01-11T00:00:00Z'));
    const lateWindow = generateOccurrences(
      pattern,
      new Date('2026-01-05T00:00:00Z'),
      new Date('2026-01-11T00:00:00Z')
    );

    // round-robin wraps
    expect(fullWindow.slice(0, 4).map(o => assignee(o.index))).toEqual(['u1', 'u2', 'u3', 'u1']);

    // stable regardless of windowStart
    for (const late of lateWindow) {
      const full = fullWindow.find(o => o.date.getTime() === late.date.getTime());
      expect(full).toBeDefined();
      expect(assignee(late.index)).toBe(assignee(full!.index));
    }
  });

  it('respects UNTIL', () => {
    const pattern = buildPattern({
      freq: 'DAILY',
      dtstart: new Date('2026-01-01T09:00:00Z'),
      until: new Date('2026-01-10T09:00:00Z'),
    });
    const occ = generateOccurrences(pattern, WINDOW_START, WINDOW_END);
    expect(occ).toHaveLength(10); // Jan 1–10 inclusive (UNTIL is inclusive)
    expect(occ[occ.length - 1].date.toISOString()).toBe('2026-01-10T09:00:00.000Z');
  });

  it('window is inclusive of start, exclusive of end', () => {
    const pattern: RecurrencePattern = {
      rrule: 'FREQ=DAILY',
      dtstart: '2026-01-01T09:00:00.000Z',
    };
    const occ = generateOccurrences(
      pattern,
      new Date('2026-01-02T09:00:00Z'), // exactly on an occurrence
      new Date('2026-01-05T09:00:00Z') // exactly on an occurrence
    );
    expect(occ.map(o => o.date.toISOString())).toEqual([
      '2026-01-02T09:00:00.000Z',
      '2026-01-03T09:00:00.000Z',
      '2026-01-04T09:00:00.000Z',
    ]);
  });

  it('returns [] for invalid or empty patterns', () => {
    expect(
      generateOccurrences(
        { rrule: 'FREQ=BOGUS', dtstart: '2026-01-01T09:00:00Z' },
        WINDOW_START,
        WINDOW_END
      )
    ).toEqual([]);
    expect(
      generateOccurrences({ rrule: '', dtstart: '2026-01-01T09:00:00Z' }, WINDOW_START, WINDOW_END)
    ).toEqual([]);
    expect(
      generateOccurrences({ rrule: 'FREQ=DAILY', dtstart: 'not-a-date' }, WINDOW_START, WINDOW_END)
    ).toEqual([]);
  });
});
