import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  completeTask,
  completionBlocker,
  TaskCompletionData,
  TaskCompletionResult,
  TaskWithAssignment,
} from '../../lib/api/tasks';
import CompleteTaskModal from './CompleteTaskModal';
import PurchaseEditorModal from '../budget/PurchaseEditorModal';
import TaskCompletionCelebration from '../animations/TaskCompletionCelebration';
import PendingApprovalAnimation from '../animations/PendingApprovalAnimation';

/**
 * The one completion flow shared by every task surface: guard → CompleteTaskModal →
 * completeTask → celebration / pending-approval / purchase editor (Shopping).
 * Errors surface once, in CompleteTaskModal, with the API's own message.
 */
export function useTaskCompletion(opts: { onCompleted?: () => void | Promise<void> } = {}): {
  /** Opens CompleteTaskModal for the row; if !canCompleteNow(row, user.id) → toast the reason and do nothing. */
  startCompletion: (row: TaskWithAssignment) => void;
  /** Render once near the end of the host component's JSX. */
  modals: React.ReactNode;
} {
  const { user } = useAuth();
  const [target, setTarget] = useState<TaskWithAssignment | null>(null);
  const [celebration, setCelebration] = useState<{ visible: boolean; result?: TaskCompletionResult; streakCount?: number }>({ visible: false });
  const [pendingApprovalName, setPendingApprovalName] = useState<string | null>(null);
  const [purchaseCompletionId, setPurchaseCompletionId] = useState<string | null>(null);

  const startCompletion = (row: TaskWithAssignment) => {
    const reason = completionBlocker(row, user?.id);
    if (reason) {
      toast.error(reason);
      return;
    }
    setTarget(row);
  };

  const handleComplete = async (data: TaskCompletionData & { addPurchase?: boolean }) => {
    if (!target || !user) return;
    const result = await completeTask(target.id, data);

    // Shopping task: user asked to record the purchase → open budget editor
    if (data.addPurchase && result.completionId) setPurchaseCompletionId(result.completionId);

    if (result.requiresApproval) {
      setPendingApprovalName(target.task.name);
    } else {
      const { data: points } = await supabase
        .from('user_points')
        .select('current_streak')
        .eq('user_id', user.id)
        .eq('household_id', target.task.household_id)
        .single();
      setCelebration({ visible: true, result, streakCount: points?.current_streak ?? 1 });
    }

    void opts.onCompleted?.();
    toast.success(result.message);
    // Completion succeeded but the proof photos didn't land — say so, or the celebration reads as "all saved".
    if (result.photosFailed) toast.error('Task saved, but the photos could not be uploaded');
  };

  // Stable callbacks: the animations restart their timers whenever onComplete changes identity
  const closeCelebration = useCallback(() => setCelebration({ visible: false }), []);
  const closePendingApproval = useCallback(() => setPendingApprovalName(null), []);

  const modals = (
    <>
      <CompleteTaskModal
        isOpen={!!target}
        task={target}
        onClose={() => setTarget(null)}
        onComplete={handleComplete}
      />
      <TaskCompletionCelebration
        isVisible={celebration.visible}
        result={celebration.result!}
        pointsEarned={celebration.result?.points ?? 0}
        streakCount={celebration.streakCount}
        onComplete={closeCelebration}
      />
      <PurchaseEditorModal
        isOpen={!!purchaseCompletionId}
        onClose={() => setPurchaseCompletionId(null)}
        onSaved={() => {}}
        taskCompletionId={purchaseCompletionId}
      />
      <PendingApprovalAnimation
        isVisible={!!pendingApprovalName}
        taskName={pendingApprovalName ?? ''}
        onComplete={closePendingApproval}
      />
    </>
  );

  return { startCompletion, modals };
}
