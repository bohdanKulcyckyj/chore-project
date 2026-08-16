import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import toast from 'react-hot-toast';
import { completeTask as completeTaskApi } from '../../../lib/api/tasks';
import { TaskWithAssignment } from './useCalendarData';

export interface TaskActionsState {
  // Modal management
  selectedTask: TaskWithAssignment | null;
  isModalOpen: boolean;
  openTaskModal: (task: TaskWithAssignment) => void;
  closeTaskModal: () => void;

  // Task actions (return true on success)
  claimTask: (task: TaskWithAssignment) => Promise<boolean>;
  completeTask: (task: TaskWithAssignment) => Promise<boolean>;

  actionLoading: boolean;
}

export const useTaskActions = (): TaskActionsState => {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const openTaskModal = useCallback((task: TaskWithAssignment) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  }, []);

  const closeTaskModal = useCallback(() => {
    setSelectedTask(null);
    setIsModalOpen(false);
  }, []);

  // Claim a task (set status to in_progress and assign to current user)
  const claimTask = useCallback(async (task: TaskWithAssignment): Promise<boolean> => {
    if (!user) {
      toast.error('You must be logged in to claim tasks');
      return false;
    }

    try {
      setActionLoading(true);

      const { error } = await supabase
        .from('task_assignments')
        .update({ status: 'in_progress', assigned_to: user.id })
        .eq('id', task.id);

      if (error) throw error;

      toast.success('Task claimed successfully');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to claim task');
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  // Complete a task via the shared API (points/streak/late-penalty logic lives there)
  const completeTask = useCallback(async (task: TaskWithAssignment): Promise<boolean> => {
    try {
      setActionLoading(true);
      const result = await completeTaskApi(task.id, {});
      toast.success(result.message);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete task');
      return false;
    } finally {
      setActionLoading(false);
    }
  }, []);

  return {
    selectedTask,
    isModalOpen,
    openTaskModal,
    closeTaskModal,
    claimTask,
    completeTask,
    actionLoading,
  };
};
