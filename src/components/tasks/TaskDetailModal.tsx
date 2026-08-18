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
  Activity,
  Repeat
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { getRecurrenceText, RecurrencePattern } from '../../lib/recurrence';
import { completionBlocker, deriveStatus, TaskWithAssignment } from '../../lib/api/tasks';
import { DIFFICULTY_STYLE, STATUS_STYLE } from '../../lib/taskStyles';
import { DATE_FMT, DATE_TIME_FMT } from '../../lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Re-export for existing importers; the canonical type lives in lib/api/tasks
export type { TaskWithAssignment } from '../../lib/api/tasks';

interface TaskDetailModalProps {
  isOpen: boolean;
  task: TaskWithAssignment | null;
  onClose: () => void;
  onClaimTask?: (task: TaskWithAssignment) => void;
  onMarkComplete?: (task: TaskWithAssignment) => void;
  onEditTask?: (task: TaskWithAssignment) => void;
  onReassignTask?: (task: TaskWithAssignment) => void;
  /** Disables action buttons while a claim/complete request is in flight */
  isActionPending?: boolean;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  task,
  onClose,
  onClaimTask,
  onMarkComplete,
  onEditTask,
  onReassignTask,
  isActionPending = false
}) => {
  const { user } = useAuth();
  if (!task) return null;

  const status = deriveStatus(task);
  const completion = task.task_completions?.[0];
  // null = completable; otherwise the reason, shown in place of the button.
  const blocker = completionBlocker(task, user?.id);

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
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${STATUS_STYLE[status].tw}`}>
                    {getStatusIcon(status)}
                    <span className="font-medium text-sm">
                      {status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${DIFFICULTY_STYLE[task.task.difficulty].tw}`}>
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
                      
                      {task.due_datetime && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Due date:</span>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {format(new Date(task.due_datetime), DATE_TIME_FMT)}
                            </span>
                          </div>
                        </div>
                      )}

                      {task.assigned_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Assigned on:</span>
                          <span className="font-medium text-gray-900">
                            {format(new Date(task.assigned_at), DATE_FMT)}
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

                      {task.task.recurrence_type !== 'none' && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Repeats:</span>
                          <div className="flex items-center gap-2">
                            <Repeat className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {getRecurrenceText(task.task.recurrence_pattern as RecurrencePattern)}
                            </span>
                          </div>
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

                    {completion && (
                      <div className="mb-2">
                        <span className="text-green-700 font-medium">Completed on: </span>
                        <span className="text-green-800">
                          {format(new Date(completion.completed_at), DATE_TIME_FMT)}
                        </span>
                      </div>
                    )}

                    {completion?.notes && (
                      <div className="mb-2">
                        <span className="text-green-700 font-medium">Notes: </span>
                        <p className="text-green-800 mt-1">{completion.notes}</p>
                      </div>
                    )}

                    {completion?.proof_urls?.[0] && (
                      <div>
                        <span className="text-green-700 font-medium">Photo proof:</span>
                        <img
                          src={completion.proof_urls[0]}
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
                    <Button
                      onClick={() => onClaimTask(task)}
                      disabled={isActionPending}
                      className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Claim Task
                    </Button>
                  )}
                  
                  {/* Same guards as the API (assignee only, not completed, lead window on recurring).
                      When blocked, show the reason instead of nothing — a missing button reads as a bug. */}
                  {onMarkComplete && task.status !== 'unassigned' && (
                    blocker ? (
                      <p className="text-sm text-gray-500 self-center text-right">{blocker}</p>
                    ) : (
                      <Button
                        onClick={() => onMarkComplete(task)}
                        disabled={isActionPending}
                        className="bg-green-500 hover:bg-green-600 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Complete
                      </Button>
                    )
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