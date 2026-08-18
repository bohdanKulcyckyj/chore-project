import { supabase } from '../supabase';
import { Tables } from '../supabase';

export interface TaskCompletionData {
  timeSpent?: number;
  notes?: string;
  proofPhotos?: File[];
}

export interface TaskCompletionResult {
  points: number;
  maintainsStreak: boolean;
  message: string;
  hasPhotos: boolean;
  requiresApproval: boolean;
  approvalStatus: 'approved' | 'pending';
  completionId?: string; // set by completeTask; used to link a budget purchase
}

/** Canonical joined assignment row shared by every task surface (Tasks page, dashboard, calendar). */
export type TaskWithAssignment = Omit<Tables<'task_assignments'>, 'status' | 'assigned_to'> & {
  /** 'unassigned' is UI-only: TaskManagement synthesizes never-assigned tasks as `id: 'unassigned-<taskId>'`. */
  status: Tables<'task_assignments'>['status'] | 'unassigned';
  assigned_to: string | null;
  task: Tables<'tasks'> & { category?: Tables<'task_categories'> | null };
  assigned_user?: Pick<Tables<'user_profiles'>, 'id' | 'display_name' | 'avatar_url'> | null;
  task_completions?: Tables<'task_completions'>[];
};

/** Embed used by fetchAssignments; `!inner` so `.eq('task.household_id', …)` drops parent rows. */
export const ASSIGNMENT_SELECT = '*, task:tasks!inner(*, category:task_categories(*))';

const toIso = (d: Date | string): string => (typeof d === 'string' ? d : d.toISOString());

/** Household-scoped assignment rows with task+category embedded, ordered by due_datetime. Throws on error. */
export async function fetchAssignments(opts: {
  householdId: string;
  assignedTo?: string;
  /** inclusive */
  from?: Date | string;
  /** exclusive */
  to?: Date | string;
  withCompletions?: boolean;
  order?: 'asc' | 'desc';
}): Promise<TaskWithAssignment[]> {
  const select: string = opts.withCompletions ? `${ASSIGNMENT_SELECT}, task_completions(*)` : ASSIGNMENT_SELECT;
  let q = supabase.from('task_assignments').select(select).eq('task.household_id', opts.householdId);
  if (opts.assignedTo) q = q.eq('assigned_to', opts.assignedTo);
  if (opts.from) q = q.gte('due_datetime', toIso(opts.from));
  if (opts.to) q = q.lt('due_datetime', toIso(opts.to));
  const { data, error } = await q.order('due_datetime', { ascending: opts.order !== 'desc' });
  if (error) throw error;
  return (data ?? []) as unknown as TaskWithAssignment[];
}

/**
 * Assignment rows for the given tasks. Recurring tasks gain a row per occurrence forever, so only
 * their rows from the last `recentDays` are fetched (PostgREST max_rows=1000 would silently truncate);
 * one-off tasks keep every row so an old completed one-off doesn't reappear as claimable. Ordered asc.
 */
export async function fetchAssignmentsForTasks(
  tasks: Pick<Tables<'tasks'>, 'id' | 'recurrence_type'>[],
  recentDays = 30
): Promise<Tables<'task_assignments'>[]> {
  if (tasks.length === 0) return [];
  const cutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();
  const oneOffIds = tasks.filter(t => t.recurrence_type === 'none').map(t => t.id);
  let q = supabase.from('task_assignments').select('*').in('task_id', tasks.map(t => t.id));
  // PostgREST rejects `in.()` with an empty list
  q = oneOffIds.length
    ? q.or(`task_id.in.(${oneOffIds.join(',')}),due_datetime.gte.${cutoff}`)
    : q.gte('due_datetime', cutoff);
  const { data, error } = await q.order('due_datetime', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

const isOpen = (status: string): boolean => status === 'pending' || status === 'in_progress';

/**
 * The "current" occurrence of a recurring task: the latest open row due by the end of today
 * (today's, or the most recent overdue one — still completable), else the earliest open future
 * row, else the latest closed (completed/skipped) row. Rows may be in any order.
 */
export function pickCurrentOccurrence<T extends { status: string; due_datetime: string | null }>(
  rows: T[],
  now = new Date()
): T | undefined {
  const t = (r: T) => (r.due_datetime ? new Date(r.due_datetime).getTime() : 0);
  const latest = (rs: T[]) => rs.reduce((a, b) => (t(b) > t(a) ? b : a));
  const earliest = (rs: T[]) => rs.reduce((a, b) => (t(b) < t(a) ? b : a));
  const open = rows.filter(r => isOpen(r.status));
  const dueNow = open.filter(r => !isDueAfterToday(r.due_datetime, now));
  if (dueNow.length) return latest(dueNow);
  if (open.length) return earliest(open);
  return rows.length ? latest(rows) : undefined;
}

/** Resolve `assigned_user` from `useHousehold().members` (no FK task_assignments→user_profiles, so no embed). */
export function attachAssignees<T extends { assigned_to: string | null }>(
  rows: T[],
  members: { user_id: string; user_profile?: TaskWithAssignment['assigned_user'] }[]
): (T & { assigned_user: TaskWithAssignment['assigned_user'] })[] {
  const profileById = new Map(members.map(m => [m.user_id, m.user_profile ?? null]));
  return rows.map(r => ({ ...r, assigned_user: (r.assigned_to && profileById.get(r.assigned_to)) || null }));
}

/** True when the due instant falls after the LOCAL end of today. */
export function isDueAfterToday(dueDatetime: string | null | undefined, now = new Date()): boolean {
  if (!dueDatetime) return false;
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return new Date(dueDatetime) > endOfToday;
}

/** Whole local calendar days from due to completed (0 = same day or early). Drives points scoring. */
export function daysBetween(dueDate: Date, completedDate: Date): number {
  // Set both dates to start of day for fair comparison
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const completed = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());

  const diffTime = completed.getTime() - due.getTime();
  // round, not ceil: a DST fall-back day is 25h and must still count as 1 day
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

/** Overdue = still open (pending/in_progress) and due DATE before today's local date — same day rule as scoring. */
export function isOverdue(a: { status: string; due_datetime: string | null }, now = new Date()): boolean {
  if (!a.due_datetime || (a.status !== 'pending' && a.status !== 'in_progress')) return false;
  return daysBetween(new Date(a.due_datetime), now) > 0;
}

/** Display status: the stored status, or 'overdue' (never written to the DB). */
export function deriveStatus<S extends string>(a: { status: S; due_datetime: string | null }, now = new Date()): S | 'overdue' {
  return isOverdue(a, now) ? 'overdue' : a.status;
}

/**
 * Why `a` cannot be completed by `userId` right now (null = allowed): assignee only, not completed,
 * recurring instances not before their due day. The single source of the messages completeTask throws.
 */
export function completionBlocker(
  a: { status: string; assigned_to: string | null; due_datetime: string | null; task: { recurrence_type: string } },
  userId: string | undefined,
  now = new Date()
): string | null {
  if (!userId || a.assigned_to !== userId) return 'You are not assigned to this task';
  if (a.status === 'completed') return 'Task is already completed';
  if (a.task.recurrence_type !== 'none' && isDueAfterToday(a.due_datetime, now)) {
    const due = new Date(a.due_datetime!);
    return `This chore isn't due until ${due.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
  }
  return null;
}

/** Mirrors completeTask's guards (see completionBlocker); use for "Mark Complete" affordances. */
export function canCompleteNow(
  a: Parameters<typeof completionBlocker>[0],
  userId: string | undefined,
  now = new Date()
): boolean {
  return completionBlocker(a, userId, now) === null;
}

/** Self-claim an unassigned task: pending, due in 7 days, assigned_by = claimer (matches the member INSERT policy). */
export async function claimTask(taskId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('task_assignments').insert({
    task_id: taskId,
    assigned_to: userId,
    due_datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    assigned_by: userId,
    status: 'pending',
  });
  if (error) throw error;
}

function calculateTaskCompletion(
  task: Tables<'tasks'>, 
  completedAt: Date, 
  dueDate: Date | null, 
  completionData: TaskCompletionData
): TaskCompletionResult {
  const hasPhotos = (completionData.proofPhotos?.length || 0) > 0;
  
  if (!dueDate) {
    // No due date - always award full points
    return {
      points: task.points,
      maintainsStreak: true,
      message: hasPhotos ? "Task completed! 🎯 📸" : "Task completed! 🎯",
      hasPhotos,
      requiresApproval: false,
      approvalStatus: 'approved' as const
    };
  }

  const daysOverdue = daysBetween(dueDate, completedAt);
  
  let basePoints = 0;
  let maintainsStreak = false;
  let message = "";
  
  if (daysOverdue === 0) {
    // On time (includes early completion)
    basePoints = task.points;
    maintainsStreak = true;
    message = "Perfect timing! 🎯";
  } else if (daysOverdue === 1) {
    // 1 day grace period
    basePoints = 0;
    maintainsStreak = true;
    message = "Task completed! Try to stay on schedule 📅";
  } else {
    // More than 1 day late
    basePoints = -task.points;
    maintainsStreak = false;
    message = "Completed late - let's get back on track! ⏰";
  }
  
  return {
    points: basePoints,
    maintainsStreak,
    message: hasPhotos ? `${message} 📸` : message,
    hasPhotos,
    requiresApproval: false,
    approvalStatus: 'approved' as const
  };
}

async function uploadPhotos(
  photos: File[], 
  householdId: string, 
  taskId: string, 
  completionId: string
): Promise<string[]> {
  const uploadPromises = photos.map(async (photo, index) => {
    const fileExt = photo.name.split('.').pop();
    const fileName = `${completionId}-${index}.${fileExt}`;
    const filePath = `${householdId}/${taskId}/${completionId}/${fileName}`;

    const { error } = await supabase.storage
      .from('task-completion-photos')
      .upload(filePath, photo, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Photo upload error:', error);
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('task-completion-photos')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  });

  return Promise.all(uploadPromises);
}

export async function completeTask(
  assignmentId: string, 
  completionData: TaskCompletionData
): Promise<TaskCompletionResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get assignment with task details
  const { data: assignment, error: assignmentError } = await supabase
    .from('task_assignments')
    .select(`
      *,
      task:tasks(*)
    `)
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignment) {
    throw new Error('Assignment not found');
  }

  const task = assignment.task as Tables<'tasks'>;

  // Assignee only, not already completed, no early completion of future recurring
  // instances (one-off tasks may be done any time). All UI paths route through here.
  const blocked = completionBlocker({ ...assignment, task }, user.id);
  if (blocked) throw new Error(blocked);

  const completedAt = new Date();
  const dueDate = assignment.due_datetime ? new Date(assignment.due_datetime) : null;
  
  // Calculate points and completion result
  let completionResult = calculateTaskCompletion(task, completedAt, dueDate, completionData);
  
  // Override result if approval is required
  if (task.requires_approval) {
    completionResult = {
      ...completionResult,
      points: 0, // No points until approved
      maintainsStreak: false, // No streak impact until approved
      message: completionResult.hasPhotos ? 
        "Submitted for approval! 📸 ⏰" : 
        "Submitted for approval! ⏰",
      requiresApproval: true,
      approvalStatus: 'pending' as const
    };
  }

  // Compare-and-set the status FIRST so two tabs/devices can't both complete:
  // only the request that flips it away from 'completed' proceeds.
  // ponytail: no transaction (client-side); a DB function is the upgrade path.
  const { data: claimed, error: claimError } = await supabase
    .from('task_assignments')
    .update({ status: 'completed' })
    .eq('id', assignmentId)
    .neq('status', 'completed')
    .select('id');

  if (claimError) throw claimError;
  if (!claimed?.length) throw new Error('Task is already completed');

  // Create completion record; on failure, best-effort revert the status
  const { data: completion, error: completionError } = await supabase
    .from('task_completions')
    .insert({
      assignment_id: assignmentId,
      completed_by: user.id,
      completed_at: completedAt.toISOString(),
      time_spent: completionData.timeSpent || null,
      notes: completionData.notes || '',
      approval_status: task.requires_approval ? 'pending' : 'approved',
      points_awarded: completionResult.points
    })
    .select('id')
    .single();

  if (completionError) {
    await supabase.from('task_assignments').update({ status: assignment.status }).eq('id', assignmentId);
    throw completionError;
  }
  const completionId = completion.id;

  // Update user points only if approved (or doesn't require approval)
  if (!task.requires_approval) {
    // Get current user points
    const { data: currentPoints } = await supabase
      .from('user_points')
      .select('total_points, current_streak, longest_streak, tasks_completed')
      .eq('user_id', user.id)
      .eq('household_id', task.household_id)
      .single();

    if (currentPoints) {
      const newStreak = completionResult.maintainsStreak ? currentPoints.current_streak + 1 : 0;

      await supabase
        .from('user_points')
        .update({
          total_points: currentPoints.total_points + completionResult.points,
          current_streak: newStreak,
          longest_streak: Math.max(currentPoints.longest_streak, newStreak),
          tasks_completed: currentPoints.tasks_completed + 1,
          last_activity: completedAt.toISOString(),
          updated_at: completedAt.toISOString()
        })
        .eq('user_id', user.id)
        .eq('household_id', task.household_id);
    }
  }

  // Upload photos if provided
  let photoUrls: string[] = [];
  if (completionData.proofPhotos?.length) {
    try {
      photoUrls = await uploadPhotos(
        completionData.proofPhotos,
        task.household_id,
        task.id,
        completionId
      );

      // Update completion record with photo URLs
      await supabase
        .from('task_completions')
        .update({ proof_urls: photoUrls })
        .eq('id', completionId);
    } catch (photoError) {
      console.error('Photo upload failed:', photoError);
      // Don't fail the entire completion for photo upload issues
    }
  }

  return { ...completionResult, completionId };
}

// Supabase function for atomic transaction
export const completeTaskTransactionSQL = `
CREATE OR REPLACE FUNCTION complete_task_transaction(
  p_assignment_id UUID,
  p_user_id UUID,
  p_completed_at TIMESTAMPTZ,
  p_time_spent INTEGER,
  p_notes TEXT,
  p_points_awarded INTEGER,
  p_maintains_streak BOOLEAN,
  p_requires_approval BOOLEAN
) RETURNS JSON AS $$
DECLARE
  v_completion_id UUID;
  v_household_id UUID;
  v_current_points INTEGER := 0;
  v_current_streak INTEGER := 0;
  v_tasks_completed INTEGER := 0;
  v_approval_status TEXT;
BEGIN
  -- Generate completion ID
  v_completion_id := gen_random_uuid();
  
  -- Get household_id
  SELECT household_id INTO v_household_id 
  FROM household_members 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  -- Determine approval status
  v_approval_status := CASE 
    WHEN p_requires_approval THEN 'pending'
    ELSE 'approved'
  END;
  
  -- Create completion record
  INSERT INTO task_completions (
    id,
    assignment_id,
    completed_by,
    completed_at,
    time_spent,
    notes,
    approval_status,
    points_awarded
  ) VALUES (
    v_completion_id,
    p_assignment_id,
    p_user_id,
    p_completed_at,
    p_time_spent,
    COALESCE(p_notes, ''),
    v_approval_status,
    p_points_awarded
  );
  
  -- Update assignment status
  UPDATE task_assignments 
  SET status = 'completed'
  WHERE id = p_assignment_id;
  
  -- Update user points only if approved (or doesn't require approval)
  IF v_approval_status = 'approved' THEN
    -- Get current user points
    SELECT total_points, current_streak, tasks_completed
    INTO v_current_points, v_current_streak, v_tasks_completed
    FROM user_points 
    WHERE user_id = p_user_id AND household_id = v_household_id;
    
    -- Update points and streak
    UPDATE user_points 
    SET 
      total_points = v_current_points + p_points_awarded,
      current_streak = CASE 
        WHEN p_maintains_streak THEN v_current_streak + 1
        ELSE 0
      END,
      longest_streak = CASE 
        WHEN p_maintains_streak AND (v_current_streak + 1) > longest_streak 
        THEN v_current_streak + 1
        ELSE longest_streak
      END,
      tasks_completed = v_tasks_completed + 1,
      last_activity = p_completed_at,
      updated_at = p_completed_at
    WHERE user_id = p_user_id AND household_id = v_household_id;
  END IF;
  
  -- Create notification for household members
  INSERT INTO notifications (
    user_id,
    household_id,
    type,
    title,
    message,
    data,
    created_at
  )
  SELECT 
    hm.user_id,
    v_household_id,
    'task_completed',
    'Task Completed',
    (SELECT display_name FROM user_profiles WHERE id = p_user_id) || ' completed a task',
    json_build_object(
      'assignment_id', p_assignment_id,
      'completion_id', v_completion_id,
      'points_awarded', p_points_awarded
    ),
    p_completed_at
  FROM household_members hm
  WHERE hm.household_id = v_household_id 
    AND hm.user_id != p_user_id;
  
  RETURN json_build_object(
    'completion_id', v_completion_id,
    'success', true
  );
END;
$$ LANGUAGE plpgsql;
`;