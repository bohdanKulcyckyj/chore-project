import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Plus, Download, Upload, Users } from 'lucide-react';
import {
  useLoaderData,
  useRevalidator,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase } from '../../lib/supabase';
import { materializeTask } from '../../lib/recurrence';
import { requireUser } from '../../lib/api/session';
import {
  attachAssignees,
  deriveStatus,
  fetchHouseholdTaskRows,
  TaskWithAssignment,
} from '../../lib/api/tasks';
import TaskTable from './TaskTable';
import AddTaskModal, { buildRecurrencePattern, type TaskActionResult, type TaskFormData } from './AddTaskModal';
import AdminGuard from '../auth/AdminGuard';
import RoleBasedComponent from '../auth/RoleBasedComponent';
import AvailableTasksView from './AvailableTasksView';
import PersonalTaskStats from './PersonalTaskStats';

export async function loader({ params }: LoaderFunctionArgs) {
  await requireUser();
  // A throw here lands on the route errorElement — no second error UI in the component.
  return { rows: await fetchHouseholdTaskRows(params.householdId!) };
}

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

/**
 * Trust boundary: the submitted FormData is strings from the network, so every field is coerced
 * and checked here (the modal's HTML constraints are UX only). Returns the message the modal
 * shows, or the validated form.
 */
// Exported so the trust boundary can be unit-tested (src/__tests__/tasksApi.test.ts).
// Not a component, so Fast Refresh's "use a new file" advice does not apply.
// eslint-disable-next-line react-refresh/only-export-components
export function parseTaskForm(body: FormData, isEdit: boolean): { error: string } | { form: TaskFormData } {
  const str = (k: string) => String(body.get(k) ?? '').trim();
  const num = (k: string) => Number(body.get(k));
  const form: TaskFormData = {
    name: str('name'),
    description: str('description'),
    category_id: str('category_id'),
    assigned_to: str('assigned_to'),
    due_datetime: str('due_datetime'),
    difficulty: DIFFICULTIES.find(d => d === str('difficulty')) ?? 'medium',
    estimated_duration: num('estimated_duration'),
    points: num('points'),
    requires_approval: str('requires_approval') === 'true',
    repeat: FREQUENCIES.find(f => f === str('repeat')) ?? '',
    repeat_interval: num('repeat_interval'),
    repeat_weekdays: body.getAll('repeat_weekdays').map(Number).filter(n => n >= 0 && n <= 6),
    repeat_until: str('repeat_until'),
    rotation_members: body.getAll('rotation_members').map(String).filter(Boolean),
  };

  if (!form.name) return { error: 'Task name is required' };
  if (form.name.length < 3) return { error: 'Task name must be at least 3 characters' };
  if (!form.category_id) return { error: 'Please select a category' };
  // Assignment is optional: an unassigned task is claimable
  if (!Number.isFinite(form.estimated_duration) || form.estimated_duration <= 0) {
    return { error: 'Duration must be greater than 0' };
  }
  if (!Number.isFinite(form.points) || form.points <= 0) return { error: 'Points must be greater than 0' };
  // An off-list `repeat` used to fall back to '' and skip the whole recurrence
  // block, so a stale client asking for a recurring task silently got a one-off
  // plus a success toast. Refuse instead of storing something else.
  if (str('repeat') && !form.repeat) return { error: 'Invalid repeat frequency' };
  // Edit mode never touches scheduling, so skip every due-date/recurrence rule
  if (isEdit) return { form };
  if (!form.due_datetime || Number.isNaN(new Date(form.due_datetime).getTime())) {
    return { error: 'Please set a due date' };
  }
  if (form.repeat) {
    if (!Number.isFinite(form.repeat_interval) || form.repeat_interval < 1) {
      return { error: 'Repeat interval must be at least 1' };
    }
    if (form.rotation_members.length === 0) return { error: 'Select at least one member for the rotation' };
    if (form.repeat_until && form.repeat_until < form.due_datetime.slice(0, 10)) {
      return { error: 'End date must be on or after the due date' };
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(form.due_datetime) < today) return { error: 'Due date must be today or in the future' };

  return { form };
}

/** Create a task (+ its occurrences / first assignment), or update an existing one's metadata. */
export async function action({ request, params }: ActionFunctionArgs): Promise<TaskActionResult> {
  const user = await requireUser();
  const body = await request.formData();
  const taskId = String(body.get('taskId') ?? '');
  const parsed = parseTaskForm(body, !!taskId);
  if ('error' in parsed) return parsed;
  const form = parsed.form;
  const metadata = {
    name: form.name,
    description: form.description,
    category_id: form.category_id || null,
    difficulty: form.difficulty,
    estimated_duration: form.estimated_duration,
    points: form.points,
    requires_approval: form.requires_approval,
  };

  try {
    if (taskId) {
      const { error } = await supabase.from('tasks').update(metadata).eq('id', taskId);
      if (error) throw error;
      return { ok: 'Task updated successfully!' };
    }

    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        ...metadata,
        household_id: params.householdId!,
        assignment_type: form.repeat
          ? (form.rotation_members.length > 1 ? 'rotating' : 'fixed')
          : (form.assigned_to ? 'fixed' : 'flexible'),
        created_by: user.id,
        recurrence_type: form.repeat
          ? (form.repeat.toLowerCase() as 'daily' | 'weekly' | 'monthly')
          : 'none',
        recurrence_pattern: form.repeat ? buildRecurrencePattern(form) : {},
        is_active: true,
      })
      .select()
      .single();

    if (taskError) throw taskError;

    if (form.repeat) {
      try {
        const count = await materializeTask(newTask, supabase);
        return count === 0
          ? { ok: 'Task created — no occurrences fall in the next 4 weeks', tone: 'plain' }
          : { ok: `Task created — ${count} occurrence${count === 1 ? '' : 's'} scheduled` };
      } catch (err) {
        // Task row exists; only scheduling failed — still close/refresh, but say so
        return {
          ok: `Task created but scheduling failed: ${err instanceof Error ? err.message : String(err)}`,
          tone: 'error',
        };
      }
    }

    // Create the task assignment only if someone is assigned
    if (form.assigned_to) {
      const { error: assignmentError } = await supabase.from('task_assignments').insert({
        task_id: newTask.id,
        assigned_to: form.assigned_to,
        // datetime-local is a local wall-clock string; convert to a real
        // instant so timestamptz doesn't misread it as UTC
        due_datetime: new Date(form.due_datetime).toISOString(),
        assigned_by: user.id,
        status: 'pending',
      });
      if (assignmentError) throw assignmentError;
    }
    return { ok: 'Task created successfully!' };
  } catch (error: unknown) {
    console.error('Error saving task:', error);
    return { error: error instanceof Error ? error.message : 'Failed to save task' };
  }
}

const TaskManagement: React.FC = () => {
  const { rows } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const { currentHousehold, members } = useHousehold();
  const revalidator = useRevalidator();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Resolve assignees from the household context (members may arrive after the rows)
  const tasks: TaskWithAssignment[] = useMemo(() => attachAssignees(rows, members), [rows, members]);

  // Imperative mutations (claim, complete, archive) still ask for a reload; the add/edit
  // action revalidates on its own.
  const loading = revalidator.state === 'loading';
  const handleTaskUpdate = () => revalidator.revalidate();

  const statusCounts = { unassigned: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, skipped: 0 };
  tasks.forEach(t => { statusCounts[deriveStatus(t)]++; });

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
            <CheckSquare className="w-8 h-8 text-blue-500" />
            Task Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage and track all household tasks for {currentHousehold?.name}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <AdminGuard>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              disabled
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              disabled
            >
              <Upload className="w-4 h-4" />
              Import
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </motion.button>
          </AdminGuard>
        </div>
      </motion.div>

      {/* Role-based Information */}
      <RoleBasedComponent
        memberContent={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Household Member View
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  You can view all tasks, assign unassigned tasks to yourself, and complete your assigned tasks. 
                  Contact your household admin to create new tasks.
                </p>
              </div>
            </div>
          </motion.div>
        }
      />

      {/* Stats Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">
            {tasks.length}
          </div>
          <div className="text-sm text-gray-500">Total Tasks</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-purple-600">
            {statusCounts.unassigned}
          </div>
          <div className="text-sm text-gray-500">Unassigned</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-amber-600">
            {statusCounts.pending}
          </div>
          <div className="text-sm text-gray-500">Pending (upcoming)</div>
          {statusCounts.overdue > 0 && (
            <div className="text-xs font-medium text-red-600">{statusCounts.overdue} overdue</div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {statusCounts.in_progress}
          </div>
          <div className="text-sm text-gray-500">In Progress</div>
        </div>
      </motion.div>

      {/* Member-specific Components */}
      <RoleBasedComponent
        memberContent={
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <PersonalTaskStats />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <AvailableTasksView
                tasks={tasks.filter(t => t.status === 'unassigned').map(t => t.task)}
                loading={loading}
                onTaskClaimed={handleTaskUpdate}
              />
            </motion.div>
          </div>
        }
      />

      {/* Task Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <TaskTable 
          tasks={tasks}
          loading={loading}
          onTaskUpdate={handleTaskUpdate}
        />
      </motion.div>

      {/* Add Task Modal */}
      <AdminGuard>
        <AddTaskModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      </AdminGuard>
    </div>
  );
};

export default TaskManagement;