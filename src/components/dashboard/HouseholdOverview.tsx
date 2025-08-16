import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Trophy, TrendingUp, Star } from 'lucide-react';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase, Tables } from '../../lib/supabase';

type UserPoints = Tables<'user_points'>;

interface LeaderboardEntry extends UserPoints {
  display_name: string;
  rank: number;
}

const HouseholdOverview: React.FC = () => {
  const { currentHousehold, members } = useHousehold();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [householdStats, setHouseholdStats] = useState({
    totalPoints: 0,
    tasksCompletedToday: 0,
    averageStreak: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchOverviewData = async () => {
    if (!currentHousehold) return;

    try {
      setLoading(true);

      // Fetch leaderboard data
      const { data: pointsData } = await supabase
        .from('user_points')
        .select(`
          *,
          user_id
        `)
        .eq('household_id', currentHousehold.id)
        .order('total_points', { ascending: false });

      // Enrich with member data and calculate ranks
      const leaderboardData = pointsData?.map((points, index) => {
        const member = members.find(m => m.user_id === points.user_id);
        return {
          ...points,
          display_name: member?.user_profile?.display_name || 'Unknown User',
          rank: index + 1,
        };
      }) || [];

      setLeaderboard(leaderboardData);

      // Calculate household stats
      const totalPoints = pointsData?.reduce((sum, p) => sum + p.total_points, 0) || 0;
      const totalTasks = pointsData?.reduce((sum, p) => sum + p.tasks_completed, 0) || 0;
      const averageStreak = pointsData?.length 
        ? Math.round(pointsData.reduce((sum, p) => sum + p.current_streak, 0) / pointsData.length)
        : 0;

      setHouseholdStats({
        totalPoints,
        tasksCompletedToday: totalTasks, // This could be more specific to today
        averageStreak,
      });
    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [currentHousehold, members]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="bg-white rounded-2xl p-6 shadow-sm"
    >
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Users className="w-6 h-6 text-emerald-500" />
        Household Overview
      </h2>

      {/* Household Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {householdStats.totalPoints.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Total Points</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {householdStats.tasksCompletedToday}
          </div>
          <div className="text-xs text-gray-500">Tasks Done</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {householdStats.averageStreak}
          </div>
          <div className="text-xs text-gray-500">Avg Streak</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Leaderboard
        </h3>
        <div className="space-y-3">
          {leaderboard.slice(0, 5).map((entry, index) => (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                entry.rank === 2 ? 'bg-gray-100 text-gray-800' :
                entry.rank === 3 ? 'bg-orange-100 text-orange-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {entry.rank === 1 ? '🥇' : 
                 entry.rank === 2 ? '🥈' : 
                 entry.rank === 3 ? '🥉' : entry.rank}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {entry.display_name}
                </div>
                <div className="text-sm text-gray-500">
                  {entry.tasks_completed} tasks • {entry.current_streak} day streak
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                <Star className="w-4 h-4" />
                {entry.total_points.toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No household members found
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default HouseholdOverview;