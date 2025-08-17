import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Clock, Star, UserPlus, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { supabase, Tables } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import toast from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type TaskWithCategory = Tables<'tasks'> & {
  category?: Tables<'task_categories'>;
};

interface AvailableTasksViewProps {
  onTaskClaimed: () => void;
}

const AvailableTasksView: React.FC<AvailableTasksViewProps> = ({ onTaskClaimed }) => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const [availableTasks, setAvailableTasks] = useState<TaskWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

  const fetchAvailableTasks = async () => {
    if (!currentHousehold) return;

    try {
      setLoading(true);

      // Fetch all active tasks for the household
      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          category:task_categories(*)
        `)
        .eq('household_id', currentHousehold.id)
        .eq('is_active', true);

      if (tasksError) throw tasksError;

      // Get all assigned task IDs
      const { data: assignments, error: assignmentsError } = await supabase
        .from('task_assignments')
        .select('task_id')
        .in('task_id', allTasks?.map(t => t.id) || []);

      if (assignmentsError) throw assignmentsError;

      const assignedTaskIds = new Set(assignments?.map(a => a.task_id) || []);

      // Filter to only unassigned tasks
      const unassignedTasks = allTasks?.filter(task => !assignedTaskIds.has(task.id)) || [];

      setAvailableTasks(unassignedTasks);
    } catch (error) {
      console.error('Error fetching available tasks:', error);
      toast.error('Failed to load available tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableTasks();
  }, [currentHousehold]);

  const handleClaimTask = async (task: TaskWithCategory) => {
    if (!user) return;

    setClaimingTaskId(task.id);

    try {
      // Create assignment for the task
      const { error } = await supabase
        .from('task_assignments')
        .insert({
          task_id: task.id,
          assigned_to: user.id,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          assigned_by: user.id,
          status: 'pending',
        });

      if (error) throw error;

      toast.success(`Successfully claimed "${task.name}"!`);
      await fetchAvailableTasks();
      onTaskClaimed();
    } catch (error) {
      console.error('Error claiming task:', error);
      toast.error('Failed to claim task');
    } finally {
      setClaimingTaskId(null);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredTasks = availableTasks.filter(task =>
    task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
          <UserPlus className="w-5 h-5 text-purple-500" />
          Available Tasks
        </h2>
        <p className="text-sm text-gray-600">
          Claim any of these unassigned tasks to add them to your task list
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search available tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-8">
          <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {searchTerm ? 'No matching tasks found' : 'No available tasks'}
          </h3>
          <p className="text-gray-500">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'All tasks are currently assigned. Check back later for new opportunities!'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{task.name}</h3>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleClaimTask(task)}
                  disabled={claimingTaskId === task.id}
                  className="ml-4"
                >
                  {claimingTaskId === task.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Claim
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                {task.category && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <Tag className="w-3 h-3 mr-1" />
                    {task.category.name}
                  </span>
                )}
                
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(task.difficulty)}`}>
                  {task.difficulty}
                </span>

                <span className="inline-flex items-center text-gray-500">
                  <Clock className="w-4 h-4 mr-1" />
                  {task.estimated_duration} min
                </span>

                <span className="inline-flex items-center text-gray-500">
                  <Star className="w-4 h-4 mr-1" />
                  {task.points} points
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AvailableTasksView;