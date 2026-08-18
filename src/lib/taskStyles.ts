import type { TaskWithAssignment } from './api/tasks';
import type { Tables } from './supabase';

/**
 * Canonical status palette (Tasks page). `tw` = Tailwind pill classes,
 * `bg`/`text` = the same Tailwind -100/-800 hues as hex for FullCalendar.
 * Render pills with the existing Badge: <Badge variant="outline" className={STATUS_STYLE[s].tw}>.
 */
export const STATUS_STYLE: Record<TaskWithAssignment['status'], { tw: string; bg: string; text: string }> = {
  pending: { tw: 'bg-amber-100 text-amber-800 border-amber-200', bg: '#fef3c7', text: '#92400e' },
  in_progress: { tw: 'bg-blue-100 text-blue-800 border-blue-200', bg: '#dbeafe', text: '#1e40af' },
  completed: { tw: 'bg-emerald-100 text-emerald-800 border-emerald-200', bg: '#d1fae5', text: '#065f46' },
  overdue: { tw: 'bg-red-100 text-red-800 border-red-200', bg: '#fee2e2', text: '#991b1b' },
  skipped: { tw: 'bg-gray-100 text-gray-800 border-gray-200', bg: '#f3f4f6', text: '#1f2937' },
  unassigned: { tw: 'bg-purple-100 text-purple-800 border-purple-200', bg: '#f3e8ff', text: '#6b21a8' },
};

/** Canonical difficulty palette (Tasks page). */
export const DIFFICULTY_STYLE: Record<Tables<'tasks'>['difficulty'], { tw: string }> = {
  easy: { tw: 'bg-green-100 text-green-800 border-green-200' },
  medium: { tw: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  hard: { tw: 'bg-orange-100 text-orange-800 border-orange-200' },
};
