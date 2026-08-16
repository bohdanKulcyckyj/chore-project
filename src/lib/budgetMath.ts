import { format, startOfMonth, subMonths } from 'date-fns';

// Structural types (subset of the DB rows) so tests don't pull in the supabase client
export interface BudgetItem {
  owner_id: string | null; // null = shared
  total_price: number;
}

export interface BudgetPurchase {
  purchased_at: string;
  paid_by: string;
  settled_at: string | null;
  purchase_items: BudgetItem[];
}

export interface Debt {
  from: string; // debtor user id
  to: string; // creditor user id
  amount: number;
}

// Pairwise net debts over unsettled purchases.
// Item owned by O ≠ payer → O owes payer full price; shared item → each
// non-payer owes price / N (N = current member count).
export function computeDebts(purchases: BudgetPurchase[], memberIds: string[]): Debt[] {
  const net = new Map<string, number>(); // key "a|b" with a < b, positive = a owes b
  const add = (from: string, to: string, amount: number) => {
    const [a, b] = from < to ? [from, to] : [to, from];
    const key = `${a}|${b}`;
    net.set(key, (net.get(key) || 0) + (from < to ? amount : -amount));
  };

  const n = memberIds.length || 1;
  for (const purchase of purchases) {
    if (purchase.settled_at) continue;
    for (const item of purchase.purchase_items) {
      if (item.owner_id === null) {
        for (const member of memberIds) {
          if (member !== purchase.paid_by) {
            add(member, purchase.paid_by, item.total_price / n);
          }
        }
      } else if (item.owner_id !== purchase.paid_by) {
        add(item.owner_id, purchase.paid_by, item.total_price);
      }
    }
  }

  const debts: Debt[] = [];
  for (const [key, amount] of net) {
    if (Math.abs(amount) < 0.005) continue; // rounds to 0,00 Kč
    const [a, b] = key.split('|');
    debts.push(amount > 0 ? { from: a, to: b, amount } : { from: b, to: a, amount: -amount });
  }
  return debts;
}

export interface PeriodStats {
  total: number; // everything bought in the period
  mine: number; // my consumption: items I own + my share of shared
  myShareOfShared: number; // shared items / N
}

// Spending (consumption) stats for purchases on/after `since`, settled included.
export function periodStats(
  purchases: BudgetPurchase[],
  userId: string,
  memberCount: number,
  since: Date
): PeriodStats {
  let total = 0;
  let own = 0;
  let shared = 0;
  for (const purchase of purchases) {
    if (new Date(purchase.purchased_at) < since) continue;
    for (const item of purchase.purchase_items) {
      total += item.total_price;
      if (item.owner_id === userId) own += item.total_price;
      else if (item.owner_id === null) shared += item.total_price;
    }
  }
  const myShareOfShared = shared / (memberCount || 1);
  return { total, mine: own + myShareOfShared, myShareOfShared };
}

export interface MonthBar {
  label: string; // "Aug"
  total: number;
  segments: { owner: string | null; amount: number }[];
}

// Per-month per-owner totals for the last `months` calendar months (oldest first).
export function monthlyBreakdown(
  purchases: BudgetPurchase[],
  months: number,
  now: Date
): MonthBar[] {
  const bars = Array.from({ length: months }, (_, i) => {
    const start = startOfMonth(subMonths(now, months - 1 - i));
    return {
      key: format(start, 'yyyy-MM'),
      label: format(start, 'MMM'),
      total: 0,
      byOwner: new Map<string | null, number>(),
    };
  });
  const byKey = new Map(bars.map(bar => [bar.key, bar]));

  for (const purchase of purchases) {
    const bar = byKey.get(format(new Date(purchase.purchased_at), 'yyyy-MM'));
    if (!bar) continue;
    for (const item of purchase.purchase_items) {
      bar.total += item.total_price;
      bar.byOwner.set(item.owner_id, (bar.byOwner.get(item.owner_id) || 0) + item.total_price);
    }
  }

  return bars.map(({ label, total, byOwner }) => ({
    label,
    total,
    segments: [...byOwner.entries()].map(([owner, amount]) => ({ owner, amount })),
  }));
}
