import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Plus, Download, Upload, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase } from '../../lib/supabase';
import {
  attachAssignees,
  deriveStatus,
  fetchAssignmentsForTasks,
  pickCurrentOccurrence,
  TaskWithAssignment,
} from '../../lib/api/tasks';
import TaskTable from './TaskTable';
import AddTaskModal from './AddTaskModal';
import AdminGuard from '../auth/AdminGuard';
import RoleBasedComponent from '../auth/RoleBasedComponent';
import AvailableTasksView from './AvailableTasksView';
import PersonalTaskStats from './PersonalTaskStats';

const TaskManagement: React.FC = () => {
  const { user } = useAuth();
  const { currentHousehold, members } = useHousehold();
  const [rows, setRows] = useState<TaskWithAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Resolve assignees from the household context (members may arrive after the rows)
  const tasks: TaskWithAssignment[] = useMemo(() => attachAssignees(rows, members), [rows, members]);

  const fetchTasks = async () => {
    if (!user || !currentHousehold) return;

    try {
      setLoading(true);
      setError(null);

      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          category:task_categories(*)
        `)
        .eq('household_id', currentHousehold.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (tasksError) {
        throw tasksError;
      }

      const assignments = await fetchAssignmentsForTasks(allTasks ?? []);
      const byTask = new Map<string, typeof assignments>();
      assignments.forEach(a => byTask.set(a.task_id, [...(byTask.get(a.task_id) ?? []), a]));

      // One row per recurring task (its current occurrence); every row of a one-off task;
      // a claimable 'unassigned' placeholder for a one-off task that was never assigned.
      // A recurring task with no row in the window (not started yet / ended) is omitted.
      const combined: TaskWithAssignment[] = [];
      (allTasks ?? []).forEach(task => {
        const own = byTask.get(task.id) ?? [];
        if (task.recurrence_type !== 'none') {
          const current = pickCurrentOccurrence(own);
          if (current) combined.push({ ...current, task });
        } else if (own.length > 0) {
          own.forEach(a => combined.push({ ...a, task }));
        } else {
          combined.push({
            id: `unassigned-${task.id}`,
            task_id: task.id,
            task,
            status: 'unassigned',
            assigned_to: null,
            assigned_by: null,
            assigned_at: '', // UI-only placeholder row: never assigned
            due_datetime: null,
          });
        }
      });

      // Sort by due date (unassigned tasks go to the end)
      combined.sort((a, b) => {
        if (!a.due_datetime && !b.due_datetime) return 0;
        if (!a.due_datetime) return 1;
        if (!b.due_datetime) return -1;
        return new Date(a.due_datetime).getTime() - new Date(b.due_datetime).getTime();
      });

      setRows(combined);
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

  const statusCounts = { unassigned: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, skipped: 0 };
  tasks.forEach(t => { statusCounts[deriveStatus(t)]++; });

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

        {/* Action Buttons */}
        <div className="flex gap-3">
          <AdminGuard>
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
          </AdminGuard>
        </div>
      </motion.div>

      {/* Role-based Information */}
      <RoleBasedComponent
        memberContent={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Household Member View
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  You can view all tasks, assign unassigned tasks to yourself, and complete your assigned tasks. 
                  Contact your household admin to create new tasks.
                </p>
              </div>
            </div>
          </motion.div>
        }
      />

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
          <div className="text-2xl font-bold text-purple-600">
            {statusCounts.unassigned}
          </div>
          <div className="text-sm text-gray-500">Unassigned</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-amber-600">
            {statusCounts.pending}
          </div>
          <div className="text-sm text-gray-500">Pending (upcoming)</div>
          {statusCounts.overdue > 0 && (
            <div className="text-xs font-medium text-red-600">{statusCounts.overdue} overdue</div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {statusCounts.in_progress}
          </div>
          <div className="text-sm text-gray-500">In Progress</div>
        </div>
      </motion.div>

      {/* Member-specific Components */}
      <RoleBasedComponent
        memberContent={
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <PersonalTaskStats />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <AvailableTasksView
                tasks={tasks.filter(t => t.status === 'unassigned').map(t => t.task)}
                loading={loading}
                onTaskClaimed={handleTaskUpdate}
              />
            </motion.div>
          </div>
        }
      />

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
      <AdminGuard>
        <AddTaskModal 
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onTaskCreated={handleTaskUpdate}
        />
      </AdminGuard>
    </div>
  );
};

export default TaskManagement;