import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { isDueAfterToday } from '../lib/api/tasks';

describe('isDueAfterToday', () => {
  const now = new Date(2026, 7, 17, 20, 1); // local Aug 17 2026 20:01

  it('is false for undated, past, and later-today due times', () => {
    expect(isDueAfterToday(null, now)).toBe(false);
    expect(isDueAfterToday(new Date(2026, 7, 10, 9).toISOString(), now)).toBe(false);
    expect(isDueAfterToday(new Date(2026, 7, 17, 23, 30).toISOString(), now)).toBe(false);
  });

  it('is true from local midnight tomorrow onward (no 24h leak)', () => {
    expect(isDueAfterToday(new Date(2026, 7, 18, 0, 0, 0, 1).toISOString(), now)).toBe(true);
    expect(isDueAfterToday(new Date(2026, 7, 18, 9).toISOString(), now)).toBe(true);
  });
});
