import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, CheckCircle } from 'lucide-react';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { PurchaseWithItems, formatCzk, settleUp } from '../../lib/api/purchases';
import {
  MonthBar,
  computeDebts,
  monthlyBreakdown,
  periodStats,
} from '../../lib/budgetMath';

interface BudgetOverviewProps {
  purchases: PurchaseWithItems[];
  memberName: (id: string | null) => string;
  onSettled: () => void;
}

const OTHER_COLORS = ['bg-blue-400', 'bg-purple-400', 'bg-orange-400'];

const BudgetOverview: React.FC<BudgetOverviewProps> = ({ purchases, memberName, onSettled }) => {
  const { user } = useAuth();
  const { currentHousehold, members } = useHousehold();
  const [settling, setSettling] = useState(false);
  // Whose stats the week/month cards show: a member id, or null for the whole household
  const [viewAs, setViewAs] = useState<string | null>(user?.id ?? null);

  const memberIds = members.map(member => member.user_id);
  const otherIds = memberIds.filter(id => id !== user?.id);
  const now = new Date();

  const debts = computeDebts(purchases, memberIds);
  const week = periodStats(purchases, viewAs, memberIds.length, startOfWeek(now, { weekStartsOn: 1 }));
  const month = periodStats(purchases, viewAs, memberIds.length, startOfMonth(now));
  const bars = monthlyBreakdown(purchases, 6, now);
  const maxTotal = Math.max(...bars.map(bar => bar.total), 1);

  const segmentColor = (owner: string | null): string => {
    if (owner === null) return 'bg-gray-300';
    if (owner === user?.id) return 'bg-teal-500';
    return OTHER_COLORS[otherIds.indexOf(owner) % OTHER_COLORS.length];
  };

  // me at the bottom of the stack, shared on top
  const orderedSegments = (bar: MonthBar) =>
    [...bar.segments]
      .filter(segment => segment.amount > 0)
      .sort((a, b) => {
        const rank = (owner: string | null) =>
          owner === user?.id ? 0 : owner === null ? 2 : 1;
        return rank(a.owner) - rank(b.owner);
      });

  const debtText = (debt: { from: string; to: string; amount: number }): string => {
    if (debt.from === user?.id) return `You owe ${memberName(debt.to)} ${formatCzk(debt.amount)}`;
    if (debt.to === user?.id) return `${memberName(debt.from)} owes you ${formatCzk(debt.amount)}`;
    return `${memberName(debt.from)} owes ${memberName(debt.to)} ${formatCzk(debt.amount)}`;
  };

  const handleSettleUp = async () => {
    if (!currentHousehold) return;
    if (!window.confirm('Mark all open purchases as settled? This clears the current balance.')) {
      return;
    }
    setSettling(true);
    try {
      await settleUp(currentHousehold.id);
      toast.success('Settled up');
      onSettled();
    } catch (error: unknown) {
      console.error('Error settling up:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to settle up');
    } finally {
      setSettling(false);
    }
  };

  const statRow = (label: string, value: number, bold = false) => (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-700'}>{formatCzk(value)}</span>
    </div>
  );

  // One shared tab state drives both cards
  const tabs: { id: string | null; label: string }[] = [
    ...(user ? [{ id: user.id, label: 'Me' }] : []),
    ...otherIds.map(id => ({ id, label: memberName(id) })),
    { id: null, label: 'Total' },
  ];
  const tabBar = (
    <div className="flex flex-wrap gap-1 mb-3">
      {tabs.map(tab => (
        <button
          key={tab.id ?? 'total'}
          onClick={() => setViewAs(tab.id)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            viewAs === tab.id
              ? 'bg-teal-100 text-teal-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
  const statRows = (stats: { own: number; sharedPart: number; spend: number }) => (
    <div className="space-y-1">
      {statRow('Own items', stats.own)}
      {statRow('Shared part', stats.sharedPart)}
      {statRow('Total', stats.spend, true)}
    </div>
  );

  return (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-teal-500" />
            <h3 className="font-semibold text-gray-900">Balance</h3>
          </div>
          {debts.length === 0 ? (
            <p className="flex items-center gap-2 text-green-600 font-medium">
              <CheckCircle className="w-5 h-5" />
              All settled up
            </p>
          ) : (
            <>
              <div className="space-y-1 mb-4">
                {debts.map(debt => (
                  <p key={`${debt.from}-${debt.to}`} className="font-bold text-gray-900">
                    {debtText(debt)}
                  </p>
                ))}
              </div>
              <button
                onClick={handleSettleUp}
                disabled={settling}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl hover:from-teal-600 hover:to-emerald-600 transition-all font-medium text-sm disabled:opacity-50"
              >
                {settling ? 'Settling…' : 'Settle up'}
              </button>
            </>
          )}
        </motion.div>

        {/* This week */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-lg p-5"
        >
          <h3 className="font-semibold text-gray-900 mb-3">This week</h3>
          {tabBar}
          {statRows(week)}
        </motion.div>

        {/* This month */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-5"
        >
          <h3 className="font-semibold text-gray-900 mb-3">
            This month · {format(now, 'MMMM')}
          </h3>
          {tabBar}
          {statRows(month)}
        </motion.div>
      </div>

      {/* Past months */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl shadow-lg p-5"
      >
        <h3 className="font-semibold text-gray-900 mb-4">Last 6 months</h3>
        <div className="flex items-end gap-3 h-40">
          {bars.map(bar => (
            <div key={bar.label} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
              {bar.total > 0 && (
                <span className="text-xs text-gray-500">{Math.round(bar.total)}</span>
              )}
              <div
                className="w-full max-w-12 flex flex-col-reverse rounded-t-md overflow-hidden"
                style={{ height: `${(Math.max(bar.total, 0) / maxTotal) * 100}%` }}
              >
                {orderedSegments(bar).map(segment => (
                  <div
                    key={segment.owner ?? 'shared'}
                    className={segmentColor(segment.owner)}
                    style={{ flexGrow: segment.amount, flexBasis: 0 }}
                    title={`${memberName(segment.owner)} ${formatCzk(segment.amount)}`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-gray-600">{bar.label}</span>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4">
          {[...(user ? [user.id] : []), ...otherIds, null].map(owner => (
            <span key={owner ?? 'shared'} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-3 h-3 rounded-sm ${segmentColor(owner)}`} />
              {memberName(owner)}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default BudgetOverview;
