import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '../../lib/supabase';

type TaskAssignment = Tables<'task_assignments'> & { task: Tables<'tasks'> };

interface TodaysTasksProps {
  tasks: TaskAssignment[];
  onTaskUpdate: () => void;
}

const TodaysTasks: React.FC<TodaysTasksProps> = ({ tasks, onTaskUpdate }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Play className="w-5 h-5 text-blue-500" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {getStatusIcon(assignment.status)}
              </div>
              
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
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                  {assignment.status.replace('_', ' ')}
                </span>
                {assignment.status === 'pending' && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors"
                    onClick={() => {
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
    </motion.div>
  );
};

export default TodaysTasks;