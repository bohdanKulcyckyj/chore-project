import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Tag,
  Target,
  CheckCircle,
  Play,
  AlertCircle,
  Pause,
  UserPlus,
  Star,
  Award,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '../../lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type TaskWithAssignment = {
  id: string;
  task: Tables<'tasks'> & {
    category?: Tables<'task_categories'>;
  };
  assigned_to?: string;
  assigned_user?: Tables<'user_profiles'>;
  due_date?: string;
  status: string;
  assigned_at?: string;
  assigned_by?: string;
  completed_at?: string;
  completion_notes?: string;
  completion_photo_url?: string;
};

interface TaskDetailModalProps {
  isOpen: boolean;
  task: TaskWithAssignment | null;
  onClose: () => void;
  onClaimTask?: (task: TaskWithAssignment) => void;
  onMarkComplete?: (task: TaskWithAssignment) => void;
  onEditTask?: (task: TaskWithAssignment) => void;
  onReassignTask?: (task: TaskWithAssignment) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  task,
  onClose,
  onClaimTask,
  onMarkComplete,
  onEditTask,
  onReassignTask
}) => {
  if (!task) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in_progress':
        return <Play className="w-4 h-4" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4" />;
      case 'skipped':
        return <Pause className="w-4 h-4" />;
      case 'unassigned':
        return <UserPlus className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
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
      case 'unassigned':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Task Details</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="p-6 space-y-6">
                {/* Task Title and Description */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {task.task.name}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {task.task.description}
                  </p>
                </div>

                {/* Status and Priority Row */}
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusColor(task.status)}`}>
                    {getStatusIcon(task.status)}
                    <span className="font-medium text-sm">
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getDifficultyColor(task.task.difficulty)}`}>
                    <Target className="w-4 h-4" />
                    <span className="font-medium text-sm">
                      {task.task.difficulty.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Task Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assignment Info */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-500" />
                      Assignment
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Assigned to:</span>
                        <span className="font-medium text-gray-900">
                          {task.status === 'unassigned' ? 'Available' : (task.assigned_user?.display_name || 'Unknown User')}
                        </span>
                      </div>
                      
                      {task.due_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Due date:</span>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {format(new Date(task.due_date), 'MMM dd, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {task.assigned_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Assigned on:</span>
                          <span className="font-medium text-gray-900">
                            {format(new Date(task.assigned_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task Properties */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-green-500" />
                      Properties
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {formatDuration(task.task.estimated_duration)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Points:</span>
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-medium text-gray-900">
                            {task.task.points}
                          </span>
                        </div>
                      </div>
                      
                      {task.task.category && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Category:</span>
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {task.task.category.name}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Completion Details */}
                {task.status === 'completed' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-green-900 flex items-center gap-2 mb-3">
                      <Award className="w-5 h-5" />
                      Completion Details
                    </h4>
                    
                    {task.completed_at && (
                      <div className="mb-2">
                        <span className="text-green-700 font-medium">Completed on: </span>
                        <span className="text-green-800">
                          {format(new Date(task.completed_at), 'MMM dd, yyyy h:mm a')}
                        </span>
                      </div>
                    )}
                    
                    {task.completion_notes && (
                      <div className="mb-2">
                        <span className="text-green-700 font-medium">Notes: </span>
                        <p className="text-green-800 mt-1">{task.completion_notes}</p>
                      </div>
                    )}
                    
                    {task.completion_photo_url && (
                      <div>
                        <span className="text-green-700 font-medium">Photo proof:</span>
                        <img 
                          src={task.completion_photo_url} 
                          alt="Task completion proof" 
                          className="mt-2 rounded-lg max-w-full h-auto border border-green-300"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            {(onClaimTask || onMarkComplete || onEditTask || onReassignTask) && (
              <div className="border-t border-gray-200 p-6">
                <div className="flex flex-wrap gap-3 justify-end">
                  {task.status === 'unassigned' && onClaimTask && (
                    <Button onClick={() => onClaimTask(task)} className="bg-purple-500 hover:bg-purple-600">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Claim Task
                    </Button>
                  )}
                  
                  {task.status !== 'completed' && task.status !== 'unassigned' && onMarkComplete && (
                    <Button onClick={() => onMarkComplete(task)} className="bg-green-500 hover:bg-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                  
                  {onEditTask && (
                    <Button variant="outline" onClick={() => onEditTask(task)}>
                      Edit
                    </Button>
                  )}
                  
                  {task.status !== 'unassigned' && onReassignTask && (
                    <Button variant="outline" onClick={() => onReassignTask(task)}>
                      Reassign
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TaskDetailModal;