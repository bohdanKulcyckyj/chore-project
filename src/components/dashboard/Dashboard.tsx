import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase, Tables } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { 
  Home, 
  Trophy, 
  Flame, 
  CheckCircle, 
  Clock, 
  Star,
  TrendingUp,
  Calendar,
  Users,
  Target
} from 'lucide-react';
import StatsCard from './StatsCard';
import QuickActions from './QuickActions';
import TodaysTasks from './TodaysTasks';
import HouseholdOverview from './HouseholdOverview';

type UserPoints = Tables<'user_points'>;
type TaskAssignment = Tables<'task_assignments'>;

interface DashboardStats {
  personalStats: UserPoints | null;
  todaysTasks: (TaskAssignment & { task: Tables<'tasks'> })[];
  completedToday: number;
  pendingTasks: number;
  householdRank: number;
  totalMembers: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { currentHousehold, members } = useHousehold();
  const [stats, setStats] = useState<DashboardStats>({
    personalStats: null,
    todaysTasks: [],
    completedToday: 0,
    pendingTasks: 0,
    householdRank: 0,
    totalMembers: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user || !currentHousehold) return;

    try {
      setLoading(true);

      // Fetch personal stats
      const { data: personalStats } = await supabase
        .from('user_points')
        .select()
        .eq('user_id', user.id)
        .eq('household_id', currentHousehold.id)
        .single();

      // Fetch today's tasks
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysTasks } = await supabase
        .from('task_assignments')
        .select(`
          *,
          task:tasks(*)
        `)
        .eq('assigned_to', user.id)
        .gte('due_date', today)
        .lt('due_date', today + 'T23:59:59');

      // Calculate completed today
      const completedToday = todaysTasks?.filter(t => t.status === 'completed').length || 0;
      const pendingTasks = todaysTasks?.filter(t => t.status === 'pending').length || 0;

      // Calculate household rank
      const { data: allPoints } = await supabase
        .from('user_points')
        .select('user_id, total_points')
        .eq('household_id', currentHousehold.id)
        .order('total_points', { ascending: false });

      const userRank = allPoints?.findIndex(p => p.user_id === user.id) + 1 || 0;

      setStats({
        personalStats: personalStats || null,
        todaysTasks: (todaysTasks as any) || [],
        completedToday,
        pendingTasks,
        householdRank: userRank,
        totalMembers: members.length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user, currentHousehold, members]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back! 👋
          </h1>
          <p className="text-gray-600 mt-1">
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
          <span className="font-semibold">Level {stats.personalStats?.level_name}</span>
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Points"
          value={stats.personalStats?.total_points || 0}
          icon={<Star className="w-6 h-6" />}
          color="from-yellow-500 to-orange-500"
          delay={0.1}
        />
        <StatsCard
          title="Current Streak"
          value={`${stats.personalStats?.current_streak || 0} days`}
          icon={<Flame className="w-6 h-6" />}
          color="from-red-500 to-pink-500"
          delay={0.2}
        />
        <StatsCard
          title="Completed Today"
          value={stats.completedToday}
          icon={<CheckCircle className="w-6 h-6" />}
          color="from-green-500 to-emerald-500"
          delay={0.3}
        />
        <StatsCard
          title="Household Rank"
          value={`#${stats.householdRank} of ${stats.totalMembers}`}
          icon={<Trophy className="w-6 h-6" />}
          color="from-purple-500 to-indigo-500"
          delay={0.4}
        />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks */}
        <div className="lg:col-span-2">
          <TodaysTasks 
            tasks={stats.todaysTasks}
            onTaskUpdate={fetchDashboardData}
          />
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