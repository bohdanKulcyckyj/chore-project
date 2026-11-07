import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import {
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/api/session';
import { useHousehold } from '../../hooks/useHousehold';
import TaskApprovalInterface, {
  type TaskCompletionWithDetails,
} from '../admin/TaskApprovalInterface';

/**
 * Loaders and actions run outside React, so neither can read `isAdmin` off the
 * household context — they establish it themselves. RLS stays the enforcement
 * boundary; this is what makes the page refuse instead of rendering an empty
 * admin screen (or accepting a privileged write) for a non-admin.
 */
async function requireAdmin(userId: string, householdId: string) {
  const { data, error } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data?.role !== 'admin') throw new Response('Household admins only', { status: 403 });
}

export async function loader({ params }: LoaderFunctionArgs) {
  const user = await requireUser();
  const householdId = params.householdId!;
  await requireAdmin(user.id, householdId);

  // ponytail: three round trips instead of one nested filter — the generated
  // Database type carries no Relationships, so `tasks.household_id` is not
  // filterable in a typed embed. A view or RPC is the upgrade path if the
  // pending list ever gets big enough to care.
  const { data: completions, error } = await supabase
    .from('task_completions')
    .select('*')
    .eq('approval_status', 'pending')
    .order('completed_at', { ascending: false });

  if (error) throw error;
  if (!completions?.length) return { pendingCompletions: [] as TaskCompletionWithDetails[] };

  const { data: assignments, error: assignmentsError } = await supabase
    .from('task_assignments')
    .select(`
      *,
      task:tasks(*, category:task_categories(name))
    `)
    .in('id', completions.map(c => c.assignment_id));

  if (assignmentsError) throw assignmentsError;

  // RLS exposes pending completions from every household the caller belongs
  // to; this narrows them to the one in the URL.
  const householdAssignments = assignments?.filter(a => a.task?.household_id === householdId) ?? [];
  if (!householdAssignments.length) return { pendingCompletions: [] as TaskCompletionWithDetails[] };

  const userIds = [...new Set([
    ...completions.map(c => c.completed_by),
    ...householdAssignments.map(a => a.assigned_to),
  ])];

  const { data: userProfiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const pendingCompletions = completions
    .map(completion => {
      const assignment = householdAssignments.find(a => a.id === completion.assignment_id);
      if (!assignment) return null;

      return {
        ...completion,
        assignment: {
          ...assignment,
          assigned_user: userProfiles?.find(p => p.id === assignment.assigned_to) || null,
        },
        completed_user: userProfiles?.find(p => p.id === completion.completed_by) || null,
      };
    })
    .filter(Boolean) as TaskCompletionWithDetails[];

  return { pendingCompletions };
}

/** Approve / reject one completion. Awards points, so it is admin-only. */
export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser();
  const householdId = params.householdId!;
  await requireAdmin(user.id, householdId);

  const form = await request.formData();
  const completionId = String(form.get('completionId') ?? '');
  const status = String(form.get('status') ?? '');
  const notes = String(form.get('notes') ?? '');

  if (status !== 'approved' && status !== 'rejected') {
    throw new Response('Unknown approval status', { status: 400 });
  }

  // Nothing from FormData is trusted: the completion is re-read and its
  // household checked against the URL before any write. Points come from the
  // task row, never from the client.
  const { data: completion, error: completionError } = await supabase
    .from('task_completions')
    .select('assignment_id, completed_by')
    .eq('id', completionId)
    .maybeSingle();

  if (completionError) throw completionError;
  if (!completion) throw new Response('Completion not found', { status: 404 });

  const { data: assignment, error: assignmentError } = await supabase
    .from('task_assignments')
    .select('task_id')
    .eq('id', completion.assignment_id)
    .maybeSingle();

  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Response('Completion not found', { status: 404 });

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('household_id, points')
    .eq('id', assignment.task_id)
    .maybeSingle();

  if (taskError) throw taskError;
  if (task?.household_id !== householdId) {
    throw new Response('Completion is not in this household', { status: 403 });
  }

  const points = status === 'approved' ? (task.points || 0) : 0;

  try {
    // Compare-and-set on 'pending' so a double submit cannot award twice.
    const { data: claimed, error: updateError } = await supabase
      .from('task_completions')
      .update({
        approval_status: status,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approval_notes: notes,
        points_awarded: points,
      })
      .eq('id', completionId)
      .eq('approval_status', 'pending')
      .select('id');

    if (updateError) throw updateError;
    if (!claimed?.length) {
      return { ok: false as const, error: 'That completion was already reviewed' };
    }

    if (status === 'approved') {
      const { error: statusError } = await supabase
        .from('task_assignments')
        .update({ status: 'completed' })
        .eq('id', completion.assignment_id);

      if (statusError) throw statusError;

      const { data: currentPoints, error: pointsError } = await supabase
        .from('user_points')
        .select('id, total_points, tasks_completed')
        .eq('user_id', completion.completed_by)
        .eq('household_id', householdId)
        .maybeSingle();

      if (pointsError) throw pointsError;

      // `.select('id')` is load-bearing: the only write policy on user_points is
      // `USING (user_id = auth.uid())` (20250816162017_dawn_limit.sql), so an admin
      // approving ANOTHER member's completion matches 0 rows and returns NO error.
      // Pre-existing, but the compare-and-set above has already consumed
      // 'pending', so a silent miss can never be retried — fail loudly instead.
      // ponytail: real fix is an admin RLS policy or a SECURITY DEFINER rpc doing
      // the CAS and the award in one transaction. That is a migration, not this refactor.
      const { data: awarded, error: updatePointsError } = currentPoints
        ? await supabase
            .from('user_points')
            .update({
              total_points: currentPoints.total_points + points,
              tasks_completed: currentPoints.tasks_completed + 1,
              last_activity: new Date().toISOString(),
            })
            .eq('id', currentPoints.id)
            .select('id')
        : { data: null, error: null };

      if (updatePointsError) throw updatePointsError;
      if (!currentPoints || awarded?.length === 0) {
        return {
          ok: false as const,
          error: `Marked ${status}, but the points could not be awarded. An admin needs database permission to update another member's points.`,
        };
      }
    }

    return { ok: true as const, status };
  } catch (error) {
    console.error('Error processing approval:', error);
    return {
      ok: false as const,
      error: `Failed to ${status === 'approved' ? 'approve' : 'reject'} completion`,
    };
  }
}

const Approvals: React.FC = () => {
  const { currentHousehold } = useHousehold();
  const { pendingCompletions } = useLoaderData() as { pendingCompletions: TaskCompletionWithDetails[] };

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
            <Clock className="w-8 h-8 text-orange-500" />
            Task Approvals
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve task completions for {currentHousehold?.name}
          </p>
        </div>
      </motion.div>

      {/* No AdminGuard: the loader refuses for non-admins, so this never renders
          for one. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <TaskApprovalInterface pendingCompletions={pendingCompletions} />
      </motion.div>
    </div>
  );
};

export default Approvals;
