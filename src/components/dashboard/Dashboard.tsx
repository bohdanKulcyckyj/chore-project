import React, { useMemo } from 'react';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase } from '../../lib/supabase';
import { attachAssignees, fetchAssignments } from '../../lib/api/tasks';
import { requireUser } from '../../lib/api/session';
import { motion } from 'framer-motion';
import {
  Trophy,
  Flame,
  CheckCircle,
  Star
} from 'lucide-react';
import StatsCard from './StatsCard';
import QuickActions from './QuickActions';
import TodaysTasks from './TodaysTasks';
import HouseholdOverview from './HouseholdOverview';

export async function loader({ params }: LoaderFunctionArgs) {
  const user = await requireUser();
  const householdId = params.householdId!;

  // Today's tasks in THIS household (local day)
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const [personal, todaysTasks, allPoints] = await Promise.all([
    supabase.from('user_points').select().eq('user_id', user.id).eq('household_id', householdId).single(),
    fetchAssignments({ householdId, assignedTo: user.id, from: todayStart, to: todayEnd }),
    supabase
      .from('user_points')
      .select('user_id, total_points')
      .eq('household_id', householdId)
      .order('total_points', { ascending: false }),
  ]);

  return {
    // ponytail: a missing user_points row is `error` + null data, same as before — not worth a throw.
    personalStats: personal.data ?? null,
    todaysTasks,
    completedToday: todaysTasks.filter(t => t.status === 'completed').length,
    householdRank: (allPoints.data ?? []).findIndex(p => p.user_id === user.id) + 1,
  };
}

const Dashboard: React.FC = () => {
  const { personalStats, todaysTasks, completedToday, householdRank } =
    useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const { currentHousehold, members } = useHousehold();

  // Assignee profiles live in the household context, which the loader can't read.
  // Members may arrive after the rows do; the join just yields null until they do.
  const tasks = useMemo(() => attachAssignees(todaysTasks, members), [todaysTasks, members]);

  // ponytail: no skeleton — the route loader means the page never renders without
  // data, and a revalidation keeps showing the old numbers instead of blanking.

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome back! 👋
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Ready to tackle some tasks in {currentHousehold?.name}?
          </p>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="hidden md:flex items-center gap-2 bg-gradient-to-r from-blue-500 to-emerald-500 text-white px-4 py-2 rounded-full"
        >
          <Trophy size={20} />
          <span className="font-semibold">Level {personalStats?.level_name}</span>
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatsCard
          title="Total Points"
          value={personalStats?.total_points || 0}
          icon={<Star className="w-6 h-6" />}
          color="from-yellow-500 to-orange-500"
          delay={0.1}
        />
        <StatsCard
          title="Current Streak"
          value={`${personalStats?.current_streak || 0} days`}
          icon={<Flame className="w-6 h-6" />}
          color="from-red-500 to-pink-500"
          delay={0.2}
        />
        <StatsCard
          title="Completed Today"
          value={completedToday}
          icon={<CheckCircle className="w-6 h-6" />}
          color="from-green-500 to-emerald-500"
          delay={0.3}
        />
        <StatsCard
          title="Household Rank"
          value={`#${householdRank} of ${members.length}`}
          icon={<Trophy className="w-6 h-6" />}
          color="from-purple-500 to-indigo-500"
          delay={0.4}
        />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Today's Tasks */}
        <div className="lg:col-span-2">
          <TodaysTasks tasks={tasks} />
        </div>

        {/* Household Overview */}
        <div>
          <HouseholdOverview />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
