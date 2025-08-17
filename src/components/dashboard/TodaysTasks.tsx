import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '../../lib/supabase';
import TaskDetailModal from '../tasks/TaskDetailModal';

type TaskAssignment = Tables<'task_assignments'> & { 
  task: Tables<'tasks'> & {
    category?: Tables<'task_categories'>;
  };
  assigned_user?: Tables<'user_profiles'>;
};

interface TodaysTasksProps {
  tasks: TaskAssignment[];
  onTaskUpdate: () => void;
}

const TodaysTasks: React.FC<TodaysTasksProps> = ({ tasks, onTaskUpdate }) => {
  const [detailModalTask, setDetailModalTask] = useState<TaskAssignment | null>(null);

  const handleTaskClick = (task: TaskAssignment) => {
    setDetailModalTask(task);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'skipped':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="bg-white rounded-2xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-500" />
          Today's Tasks
        </h2>
        <div className="text-sm text-gray-500">
          {tasks.filter(t => t.status === 'completed').length} of {tasks.length} completed
        </div>
      </div>

      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tasks for today. Great job!</p>
          </div>
        ) : (
          tasks.map((assignment, index) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => handleTaskClick(assignment)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {assignment.task.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {assignment.task.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>{assignment.task.estimated_duration} min</span>
                  <span>{assignment.task.points} points</span>
                  {assignment.due_date && (
                    <span>Due: {format(new Date(assignment.due_date), 'h:mm a')}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(assignment.status)}`}>
                  {assignment.status.replace('_', ' ')}
                </span>
                {assignment.status === 'pending' && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle start task
                      console.log('Start task:', assignment.id);
                    }}
                  >
                    Start
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={!!detailModalTask}
        task={detailModalTask}
        onClose={() => setDetailModalTask(null)}
      />
    </motion.div>
  );
};

export default TodaysTasks;