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
}

function daysBetween(dueDate: Date, completedDate: Date): number {
  // Set both dates to start of day for fair comparison
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const completed = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
  
  const diffTime = completed.getTime() - due.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
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

    const { data, error } = await supabase.storage
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
  
  // Verify user can complete this task
  if (assignment.assigned_to !== user.id) {
    throw new Error('You are not assigned to this task');
  }

  if (assignment.status === 'completed') {
    throw new Error('Task is already completed');
  }

  const completedAt = new Date();
  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
  
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

  // Create completion record
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

  if (completionError) throw completionError;
  const completionId = completion.id;

  // Update assignment status
  const { error: updateError } = await supabase
    .from('task_assignments')
    .update({ status: 'completed' })
    .eq('id', assignmentId);

  if (updateError) throw updateError;

  // Update user points only if approved (or doesn't require approval)
  if (!task.requires_approval) {
    // Get household_id
    const { data: householdData } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (householdData) {
      // Get current user points
      const { data: currentPoints } = await supabase
        .from('user_points')
        .select('total_points, current_streak, longest_streak, tasks_completed')
        .eq('user_id', user.id)
        .eq('household_id', householdData.household_id)
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
          .eq('household_id', householdData.household_id);
      }
    }
  }

  // Upload photos if provided
  let photoUrls: string[] = [];
  if (completionData.proofPhotos?.length) {
    try {
      // Get household_id from user profile or assignment
      const { data: householdData } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (householdData) {
        photoUrls = await uploadPhotos(
          completionData.proofPhotos,
          householdData.household_id,
          task.id,
          completionId
        );

        // Update completion record with photo URLs
        await supabase
          .from('task_completions')
          .update({ proof_urls: photoUrls })
          .eq('id', completionId);
      }
    } catch (photoError) {
      console.error('Photo upload failed:', photoError);
      // Don't fail the entire completion for photo upload issues
    }
  }

  return completionResult;
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