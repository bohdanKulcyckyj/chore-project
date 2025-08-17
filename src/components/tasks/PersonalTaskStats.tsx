import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, CheckCircle, Clock, Star, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';

interface PersonalStats {
  totalCompletedTasks: number;
  totalPoints: number;
  currentStreak: number;
  averageCompletionTime: number;
  tasksThisWeek: number;
  tasksThisMonth: number;
  pendingTasks: number;
  inProgressTasks: number;
}

const PersonalTaskStats: React.FC = () => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const [stats, setStats] = useState<PersonalStats>({
    totalCompletedTasks: 0,
    totalPoints: 0,
    currentStreak: 0,
    averageCompletionTime: 0,
    tasksThisWeek: 0,
    tasksThisMonth: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchPersonalStats = async () => {
    if (!user || !currentHousehold) return;

    try {
      setLoading(true);

      // Get user points data
      const { data: userPoints } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .eq('household_id', currentHousehold.id)
        .single();

      // Get user's task assignments
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select(`
          *,
          task:tasks(*),
          task_completions(*)
        `)
        .eq('assigned_to', user.id)
        .eq('task.household_id', currentHousehold.id);

      // Calculate current assignments status
      const pendingTasks = assignments?.filter(a => a.status === 'pending').length || 0;
      const inProgressTasks = assignments?.filter(a => a.status === 'in_progress').length || 0;

      // Calculate time-based stats
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const completedAssignments = assignments?.filter(a => a.status === 'completed') || [];
      const tasksThisWeek = completedAssignments.filter(a => 
        new Date(a.assigned_at) >= oneWeekAgo
      ).length;
      const tasksThisMonth = completedAssignments.filter(a => 
        new Date(a.assigned_at) >= oneMonthAgo
      ).length;

      // Calculate average completion time from task_completions
      const completions = assignments?.flatMap(a => a.task_completions || []) || [];
      const totalTime = completions.reduce((sum, c) => sum + (c.time_spent || 0), 0);
      const averageCompletionTime = completions.length > 0 ? Math.round(totalTime / completions.length) : 0;

      setStats({
        totalCompletedTasks: userPoints?.tasks_completed || 0,
        totalPoints: userPoints?.total_points || 0,
        currentStreak: userPoints?.current_streak || 0,
        averageCompletionTime,
        tasksThisWeek,
        tasksThisMonth,
        pendingTasks,
        inProgressTasks,
      });
    } catch (error) {
      console.error('Error fetching personal stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonalStats();
  }, [user, currentHousehold]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: CheckCircle,
      label: 'Tasks Completed',
      value: stats.totalCompletedTasks,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      icon: Star,
      label: 'Total Points',
      value: stats.totalPoints,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      icon: TrendingUp,
      label: 'Current Streak',
      value: `${stats.currentStreak} days`,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      icon: Clock,
      label: 'Avg. Time',
      value: stats.averageCompletionTime > 0 ? `${stats.averageCompletionTime}m` : 'N/A',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      icon: Calendar,
      label: 'This Week',
      value: stats.tasksThisWeek,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      icon: Calendar,
      label: 'This Month',
      value: stats.tasksThisMonth,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      icon: Clock,
      label: 'Pending',
      value: stats.pendingTasks,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      icon: TrendingUp,
      label: 'In Progress',
      value: stats.inProgressTasks,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          Your Task Statistics
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Track your personal progress and achievements
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-50 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stat.value}
            </div>
            <div className="text-sm text-gray-600">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {stats.currentStreak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-orange-800">
                🔥 You're on fire!
              </h3>
              <p className="text-sm text-orange-700">
                Keep up your {stats.currentStreak}-day streak by completing tasks today!
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default PersonalTaskStats;