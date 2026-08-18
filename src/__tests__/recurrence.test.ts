import { describe, expect, it } from 'vitest';
import {
  activeRotation,
  buildPattern,
  generateOccurrences,
  getRecurrenceText,
  RecurrencePattern,
} from '../lib/recurrence';

const WINDOW_START = new Date('2026-01-01T00:00:00Z');
const WINDOW_END = new Date('2026-03-01T00:00:00Z');

// vitest.config.ts pins TZ=Europe/Prague (CET/CEST); the DST tests below assert
// explicit UTC instants and are only meaningful in a DST-observing zone.
it('runs under Europe/Prague', () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
  expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
});

describe('buildPattern', () => {
  it('stores rrule without DTSTART and dtstart as ISO', () => {
    const dtstart = new Date('2026-01-05T09:00:00Z');
    const pattern = buildPattern({ freq: 'WEEKLY', byweekday: [0, 2, 4], dtstart });
    expect(pattern.rrule).toContain('FREQ=WEEKLY');
    expect(pattern.rrule).toContain('BYDAY=MO,WE,FR');
    expect(pattern.rrule).not.toContain('DTSTART');
    expect(pattern.dtstart).toBe('2026-01-05T09:00:00.000Z');
  });

  it('monthly on the 29th–31st falls back to the last day of short months', () => {
    const dtstart = new Date(2026, 0, 31, 9, 0); // Jan 31 2026, 09:00 local
    const pattern = buildPattern({ freq: 'MONTHLY', dtstart });
    expect(pattern.rrule).toContain('BYMONTHDAY=31,-1');
    expect(pattern.rrule).toContain('BYSETPOS=1');
    const occ = generateOccurrences(pattern, dtstart, new Date(2026, 4, 1));
    expect(occ.map(o => [o.date.getMonth() + 1, o.date.getDate()])).toEqual([
      [1, 31],
      [2, 28],
      [3, 31],
      [4, 30],
    ]);
    occ.forEach(o => expect(o.date.getHours()).toBe(9));
    expect(getRecurrenceText(pattern)).toBe('every month on the 31st or last day');
  });

  it('monthly before the 29th stays a plain monthly rule', () => {
    const pattern = buildPattern({ freq: 'MONTHLY', dtstart: new Date(2026, 0, 15, 9, 0) });
    expect(pattern.rrule).not.toContain('BYMONTHDAY');
    expect(getRecurrenceText(pattern)).toBe('every month');
  });
});

describe('activeRotation', () => {
  const active = new Set(['u1', 'u3', 'creator']);

  it('drops members who left the household, keeps order', () => {
    expect(activeRotation(['u1', 'u2', 'u3'], active, 'creator')).toEqual(['u1', 'u3']);
  });

  it('falls back to the creator when the whole rotation left', () => {
    expect(activeRotation(['u2', 'u4'], active, 'creator')).toEqual(['creator']);
  });

  it('is empty when nobody eligible remains (caller skips the task)', () => {
    expect(activeRotation(['u2'], active, 'gone')).toEqual([]);
    expect(activeRotation(['u2'], active, null)).toEqual([]);
    expect(activeRotation([], new Set(), 'creator')).toEqual([]);
  });

  it('assignees never include an inactive member', () => {
    const rotation = ['u1', 'u2', 'u3', 'u4'];
    const pool = activeRotation(rotation, active, 'creator');
    for (let index = 0; index < 20; index++) {
      expect(active.has(pool[index % pool.length])).toBe(true);
    }
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
      expect([1, 3, 5]).toContain(o.date.getDay()); // Mon/Wed/Fri, local
    });
  });

  it('weekly Mon 20:00 local yields Mondays at 20:00 local (any TZ)', () => {
    const dtstart = new Date(2026, 0, 5, 20, 0); // Mon Jan 5 2026, 20:00 local
    const pattern = buildPattern({ freq: 'WEEKLY', byweekday: [0], dtstart });
    expect(pattern.rrule).toContain('BYDAY=MO');
    const occ = generateOccurrences(pattern, dtstart, new Date(2026, 2, 1));
    expect(occ).toHaveLength(8);
    expect(occ[0].date.getTime()).toBe(dtstart.getTime());
    occ.forEach(o => {
      expect(o.date.getDay()).toBe(1);
      expect(o.date.getHours()).toBe(20);
    });
  });

  it('daily 21:00 local stays 21:00 local across a DST boundary', () => {
    const dtstart = new Date(2026, 9, 20, 21, 0); // Oct 20 2026 (EU DST ends Oct 25, US Nov 1)
    const pattern = buildPattern({ freq: 'DAILY', dtstart });
    const occ = generateOccurrences(pattern, dtstart, new Date(2026, 10, 5));
    expect(occ).toHaveLength(16);
    occ.forEach(o => {
      expect(o.date.getHours()).toBe(21);
      expect(o.date.getMinutes()).toBe(0);
    });
  });

  it('daily 09:00 Prague resolves to the right UTC instant on both sides of DST', () => {
    // Fall back: CEST (UTC+2) → CET (UTC+1) on 2026-10-25 03:00
    const fall = buildPattern({ freq: 'DAILY', dtstart: new Date(2026, 9, 24, 9, 0) });
    const fallOcc = generateOccurrences(fall, new Date(2026, 9, 24), new Date(2026, 9, 26));
    expect(fallOcc.map(o => o.date.toISOString())).toEqual([
      '2026-10-24T07:00:00.000Z',
      '2026-10-25T08:00:00.000Z',
    ]);
    // Spring forward: CET → CEST on 2026-03-29 02:00
    const spring = buildPattern({ freq: 'DAILY', dtstart: new Date(2026, 2, 28, 9, 0) });
    const springOcc = generateOccurrences(spring, new Date(2026, 2, 28), new Date(2026, 2, 30));
    expect(springOcc.map(o => o.date.toISOString())).toEqual([
      '2026-03-28T08:00:00.000Z',
      '2026-03-29T07:00:00.000Z',
    ]);
  });

  it('weekly BYDAY=MO at 00:30 local (Sunday in UTC) lands on local Mondays', () => {
    const dtstart = new Date(2026, 0, 5, 0, 30); // Mon Jan 5 2026 00:30 Prague = Sun Jan 4 23:30Z
    expect(dtstart.toISOString()).toBe('2026-01-04T23:30:00.000Z');
    const pattern = buildPattern({ freq: 'WEEKLY', byweekday: [0], dtstart });
    const occ = generateOccurrences(pattern, dtstart, new Date(2026, 1, 1));
    expect(occ.map(o => o.date.toISOString())).toEqual([
      '2026-01-04T23:30:00.000Z',
      '2026-01-11T23:30:00.000Z',
      '2026-01-18T23:30:00.000Z',
      '2026-01-25T23:30:00.000Z',
    ]);
    occ.forEach(o => {
      expect(o.date.getDay()).toBe(1);
      expect(o.date.getHours()).toBe(0);
      expect(o.date.getMinutes()).toBe(30);
    });
  });

  it('monthly BYMONTHDAY lands on that day', () => {
    const pattern: RecurrencePattern = {
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=15',
      dtstart: '2026-01-15T09:00:00.000Z',
    };
    const occ = generateOccurrences(pattern, WINDOW_START, new Date('2026-06-01T00:00:00Z'));
    expect(occ).toHaveLength(5); // Jan–May
    occ.forEach(o => expect(o.date.getDate()).toBe(15));
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
