import { useState, useCallback, useRef } from 'react';
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
  completeTask: (task: TaskWithAssignment) => Promise<boolean>;

  actionLoading: boolean;
}

export const useTaskActions = (): TaskActionsState => {
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // Sync guard: completeTaskApi is a non-atomic read-then-write, so a double
  // tap before the state re-render would award points twice.
  const inFlight = useRef(false);

  const openTaskModal = useCallback((task: TaskWithAssignment) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  }, []);

  const closeTaskModal = useCallback(() => {
    setSelectedTask(null);
    setIsModalOpen(false);
  }, []);

  // Complete a task via the shared API (points/streak/late-penalty logic lives there)
  const completeTask = useCallback(async (task: TaskWithAssignment): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    try {
      setActionLoading(true);
      const result = await completeTaskApi(task.id, {});
      toast.success(result.message);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete task');
      return false;
    } finally {
      inFlight.current = false;
      setActionLoading(false);
    }
  }, []);

  return {
    selectedTask,
    isModalOpen,
    openTaskModal,
    closeTaskModal,
    completeTask,
    actionLoading,
  };
};
