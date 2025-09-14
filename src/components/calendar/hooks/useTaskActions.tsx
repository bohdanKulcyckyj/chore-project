import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import toast from 'react-hot-toast';
import { TaskWithAssignment } from './useCalendarData';

export interface TaskActionsState {
  // Modal management
  selectedTask: TaskWithAssignment | null;
  isModalOpen: boolean;
  openTaskModal: (task: TaskWithAssignment) => void;
  closeTaskModal: () => void;

  // Task actions
  claimTask: (task: TaskWithAssignment) => Promise<void>;
  completeTask: (task: TaskWithAssignment) => Promise<void>;
  updateTaskStatus: (taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped') => Promise<void>;

  // UI state
  actionLoading: boolean;
  actionError: string | null;
}

export const useTaskActions = (): TaskActionsState => {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal management
  const openTaskModal = useCallback((task: TaskWithAssignment) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  }, []);

  const closeTaskModal = useCallback(() => {
    setSelectedTask(null);
    setIsModalOpen(false);
    setActionError(null);
  }, []);

  // Generic task status update function
  const updateTaskStatus = useCallback(async (
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped'
  ) => {
    if (!user) {
      setActionError('You must be logged in to update tasks');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const { error } = await supabase
        .from('task_assignments')
        .update({ status })
        .eq('id', taskId);

      if (error) throw error;

      // Show success message based on status
      const statusMessages = {
        pending: 'Task marked as pending',
        in_progress: 'Task claimed successfully',
        completed: 'Task completed successfully',
        overdue: 'Task marked as overdue',
        skipped: 'Task skipped'
      };

      toast.success(statusMessages[status]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
      setActionError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  // Claim a task (set status to in_progress and assign to current user)
  const claimTask = useCallback(async (task: TaskWithAssignment) => {
    if (!user) {
      setActionError('You must be logged in to claim tasks');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      // Update both status and assigned user
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'in_progress',
          assigned_to: user.id
        })
        .eq('id', task.id);

      if (error) throw error;

      toast.success('Task claimed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim task';
      setActionError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  // Complete a task
  const completeTask = useCallback(async (task: TaskWithAssignment) => {
    if (!user) {
      setActionError('You must be logged in to complete tasks');
      return;
    }

    if (task.assigned_to !== user.id) {
      setActionError('You can only complete tasks assigned to you');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      // Update task status to completed
      const { error: updateError } = await supabase
        .from('task_assignments')
        .update({ status: 'completed' })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Create task completion record
      const { error: completionError } = await supabase
        .from('task_completions')
        .insert({
          assignment_id: task.id,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
          notes: '',
          proof_urls: [],
          approval_status: task.tasks.requires_approval ? 'pending' : 'approved',
          points_awarded: task.tasks.requires_approval ? 0 : task.tasks.points
        });

      if (completionError) throw completionError;

      // If task doesn't require approval, update user points
      if (!task.tasks.requires_approval) {
        // This would typically be handled by a database trigger or function
        // For now, we'll just show the success message
      }

      const message = task.tasks.requires_approval
        ? 'Task completed! Awaiting approval.'
        : 'Task completed successfully!';

      toast.success(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete task';
      setActionError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  return {
    selectedTask,
    isModalOpen,
    openTaskModal,
    closeTaskModal,
    claimTask,
    completeTask,
    updateTaskStatus,
    actionLoading,
    actionError
  };
};