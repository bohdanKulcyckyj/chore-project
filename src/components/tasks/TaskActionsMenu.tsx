import React from 'react';
import { MoreVertical, UserPlus, Edit3, Archive, CheckCircle } from 'lucide-react';
import DropdownMenu, { DropdownMenuItem } from '../common/DropdownMenu';
import { Tables } from '../../lib/supabase';

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
};

interface TaskActionsMenuProps {
  task: TaskWithAssignment;
  onClaimTask?: (task: TaskWithAssignment) => void;
  onEditTask?: (task: TaskWithAssignment) => void;
  onArchiveTask?: (task: TaskWithAssignment) => void;
  onReassignTask?: (task: TaskWithAssignment) => void;
  onMarkComplete?: (task: TaskWithAssignment) => void;
  isLoading?: boolean;
  className?: string;
}

const TaskActionsMenu: React.FC<TaskActionsMenuProps> = ({
  task,
  onClaimTask,
  onEditTask,
  onArchiveTask,
  onReassignTask,
  onMarkComplete,
  isLoading = false,
  className = ''
}) => {
  const getMenuItems = (): DropdownMenuItem[] => {
    const items: DropdownMenuItem[] = [];

    // Actions for unassigned tasks
    if (task.status === 'unassigned') {
      if (onClaimTask) {
        items.push({
          id: 'claim',
          label: 'Claim Task',
          icon: <UserPlus className="w-4 h-4" />,
          onClick: () => onClaimTask(task),
          disabled: isLoading
        });
      }

      if (onEditTask) {
        items.push({
          id: 'edit',
          label: 'Edit Task',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => onEditTask(task),
          disabled: isLoading
        });
      }

      if (onArchiveTask) {
        items.push({
          id: 'archive',
          label: 'Archive Task',
          icon: <Archive className="w-4 h-4" />,
          onClick: () => onArchiveTask(task),
          disabled: isLoading,
          variant: 'danger'
        });
      }
    } 
    // Actions for assigned tasks
    else {
      if (onMarkComplete && task.status !== 'completed') {
        items.push({
          id: 'complete',
          label: 'Mark Complete',
          icon: <CheckCircle className="w-4 h-4" />,
          onClick: () => onMarkComplete(task),
          disabled: isLoading
        });
      }

      if (onEditTask) {
        items.push({
          id: 'edit',
          label: 'Edit Assignment',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => onEditTask(task),
          disabled: isLoading
        });
      }

      if (onReassignTask) {
        items.push({
          id: 'reassign',
          label: 'Reassign Task',
          icon: <UserPlus className="w-4 h-4" />,
          onClick: () => onReassignTask(task),
          disabled: isLoading
        });
      }

      if (onArchiveTask) {
        items.push({
          id: 'archive',
          label: 'Archive Task',
          icon: <Archive className="w-4 h-4" />,
          onClick: () => onArchiveTask(task),
          disabled: isLoading,
          variant: 'danger'
        });
      }
    }

    return items;
  };

  const menuItems = getMenuItems();

  // Don't render if no actions are available
  if (menuItems.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      trigger={
        <MoreVertical 
          className={`w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors ${
            isLoading ? 'opacity-50' : ''
          }`} 
        />
      }
      items={menuItems}
      align="right"
      className={className}
    />
  );
};

export default TaskActionsMenu;