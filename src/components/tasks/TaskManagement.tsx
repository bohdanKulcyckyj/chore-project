import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Plus, Download, Upload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase, Tables } from '../../lib/supabase';
import TaskTable from './TaskTable';
import AddTaskModal from './AddTaskModal';

type TaskAssignment = Tables<'task_assignments'> & {
  task: Tables<'tasks'>;
  assigned_user?: Tables<'user_profiles'>;
  category?: Tables<'task_categories'>;
};

const TaskManagement: React.FC = () => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchTasks = async () => {
    if (!user || !currentHousehold) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('task_assignments')
        .select(`
          *,
          task:tasks!inner(*,
            category:task_categories(*)
          )
        `)
        .eq('task.household_id', currentHousehold.id)
        .order('due_date', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Fetch user profiles separately
      const userIds = [...new Set(data?.map(t => t.assigned_to).filter(Boolean))];
      let userProfiles: Tables<'user_profiles'>[] = [];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('*')
          .in('id', userIds);
        
        userProfiles = profiles || [];
      }

      // Merge user profiles with task assignments
      const tasksWithUsers = (data || []).map(assignment => ({
        ...assignment,
        assigned_user: userProfiles.find(user => user.id === assignment.assigned_to)
      }));

      setTasks(tasksWithUsers as TaskAssignment[]);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user, currentHousehold]);

  const handleTaskUpdate = () => {
    fetchTasks();
  };

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckSquare className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading tasks
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={fetchTasks}
                  className="bg-red-100 px-4 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-blue-500" />
            Task Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage and track all household tasks for {currentHousehold?.name}
          </p>
        </div>

        {/* Action Buttons (Placeholder for future functionality) */}
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            disabled
          >
            <Download className="w-4 h-4" />
            Export
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            disabled
          >
            <Upload className="w-4 h-4" />
            Import
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">
            {tasks.length}
          </div>
          <div className="text-sm text-gray-500">Total Tasks</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {tasks.filter(t => t.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-500">Pending</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-yellow-600">
            {tasks.filter(t => t.status === 'in_progress').length}
          </div>
          <div className="text-sm text-gray-500">In Progress</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-green-600">
            {tasks.filter(t => t.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
      </motion.div>

      {/* Task Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <TaskTable 
          tasks={tasks}
          loading={loading}
          onTaskUpdate={handleTaskUpdate}
        />
      </motion.div>

      {/* Add Task Modal */}
      <AddTaskModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTaskCreated={handleTaskUpdate}
      />
    </div>
  );
};

export default TaskManagement;