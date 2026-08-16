import { describe, expect, it } from 'vitest';
import {
  BudgetPurchase,
  computeDebts,
  monthlyBreakdown,
  periodStats,
} from '../lib/budgetMath';

const ME = 'user-a';
const BRO = 'user-b';
const MEMBERS = [ME, BRO];

const purchase = (over: Partial<BudgetPurchase>): BudgetPurchase => ({
  purchased_at: '2026-08-10T10:00:00Z',
  paid_by: ME,
  settled_at: null,
  purchase_items: [],
  ...over,
});

describe('computeDebts', () => {
  it('splits shared items evenly and charges owned items fully', () => {
    const debts = computeDebts(
      [
        purchase({
          purchase_items: [
            { owner_id: null, total_price: 100 }, // BRO owes 50
            { owner_id: BRO, total_price: 30 }, // BRO owes 30
            { owner_id: ME, total_price: 20 }, // payer's own item, no debt
          ],
        }),
      ],
      MEMBERS
    );
    expect(debts).toEqual([{ from: BRO, to: ME, amount: 80 }]);
  });

  it('nets debts in both directions across purchases', () => {
    const debts = computeDebts(
      [
        purchase({ purchase_items: [{ owner_id: BRO, total_price: 100 }] }), // BRO owes ME 100
        purchase({ paid_by: BRO, purchase_items: [{ owner_id: ME, total_price: 60 }] }), // ME owes BRO 60
      ],
      MEMBERS
    );
    expect(debts).toEqual([{ from: BRO, to: ME, amount: 40 }]);
  });

  it('ignores settled purchases and reports nothing when even', () => {
    const debts = computeDebts(
      [
        purchase({
          settled_at: '2026-08-11T00:00:00Z',
          purchase_items: [{ owner_id: BRO, total_price: 999 }],
        }),
        purchase({ purchase_items: [{ owner_id: BRO, total_price: 50 }] }),
        purchase({ paid_by: BRO, purchase_items: [{ owner_id: ME, total_price: 50 }] }),
      ],
      MEMBERS
    );
    expect(debts).toEqual([]);
  });

  it('splits shared items across three members', () => {
    const C = 'user-c';
    const debts = computeDebts(
      [purchase({ purchase_items: [{ owner_id: null, total_price: 90 }] })],
      [ME, BRO, C]
    );
    expect(debts).toHaveLength(2);
    for (const debt of debts) {
      expect(debt.to).toBe(ME);
      expect(debt.amount).toBeCloseTo(30, 5);
    }
  });

  it('handles negative rows (discounts) as negative debt', () => {
    const debts = computeDebts(
      [
        purchase({
          purchase_items: [
            { owner_id: BRO, total_price: 100 },
            { owner_id: BRO, total_price: -20 },
          ],
        }),
      ],
      MEMBERS
    );
    expect(debts).toEqual([{ from: BRO, to: ME, amount: 80 }]);
  });
});

describe('periodStats', () => {
  const purchases = [
    purchase({
      purchased_at: '2026-08-10T10:00:00Z',
      purchase_items: [
        { owner_id: ME, total_price: 100 },
        { owner_id: BRO, total_price: 40 },
        { owner_id: null, total_price: 60 },
      ],
    }),
    purchase({
      purchased_at: '2026-07-01T10:00:00Z', // before the window
      purchase_items: [{ owner_id: ME, total_price: 1000 }],
    }),
  ];

  it('computes total, mine (incl. shared split) and my share of shared', () => {
    const stats = periodStats(purchases, ME, 2, new Date('2026-08-01T00:00:00Z'));
    expect(stats.total).toBe(200);
    expect(stats.myShareOfShared).toBe(30);
    expect(stats.mine).toBe(130);
  });

  it('includes settled purchases (stats are about consumption, not balance)', () => {
    const settled = [
      purchase({
        settled_at: '2026-08-12T00:00:00Z',
        purchase_items: [{ owner_id: ME, total_price: 50 }],
      }),
    ];
    expect(periodStats(settled, ME, 2, new Date('2026-08-01T00:00:00Z')).total).toBe(50);
  });
});

describe('monthlyBreakdown', () => {
  it('buckets by calendar month with per-owner segments, oldest first', () => {
    const now = new Date('2026-08-15T12:00:00Z');
    const bars = monthlyBreakdown(
      [
        purchase({
          purchased_at: '2026-08-10T10:00:00Z',
          purchase_items: [
            { owner_id: ME, total_price: 100 },
            { owner_id: null, total_price: 50 },
          ],
        }),
        purchase({
          purchased_at: '2026-06-05T10:00:00Z',
          purchase_items: [{ owner_id: BRO, total_price: 200 }],
        }),
        purchase({
          purchased_at: '2025-12-31T10:00:00Z', // outside the 6-month window
          purchase_items: [{ owner_id: ME, total_price: 999 }],
        }),
      ],
      6,
      now
    );

    expect(bars).toHaveLength(6);
    expect(bars.map(bar => bar.label)).toEqual(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
    expect(bars[3].total).toBe(200);
    expect(bars[3].segments).toEqual([{ owner: BRO, amount: 200 }]);
    expect(bars[5].total).toBe(150);
    expect(bars[5].segments).toContainEqual({ owner: ME, amount: 100 });
    expect(bars[5].segments).toContainEqual({ owner: null, amount: 50 });
    expect(bars[0].total).toBe(0);
  });
});
