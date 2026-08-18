import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  Star,
  Zap,
  CheckCircle,
  AlertCircle,
  Repeat
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase, Tables } from '../../lib/supabase';
import { buildPattern, getRecurrenceText, materializeTask } from '../../lib/recurrence';
import { DIFFICULTY_STYLE } from '../../lib/taskStyles';
import toast from 'react-hot-toast';

type HouseholdMember = Tables<'household_members'> & {
  user_profile?: Tables<'user_profiles'>;
};

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

interface FormData {
  name: string;
  description: string;
  category_id: string;
  assigned_to: string; // Empty string means unassigned
  due_datetime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimated_duration: number;
  points: number;
  requires_approval: boolean;
  repeat: '' | 'DAILY' | 'WEEKLY' | 'MONTHLY'; // '' = does not repeat
  repeat_interval: number;
  repeat_weekdays: number[]; // RRule convention: 0=Mon ... 6=Sun
  repeat_until: string; // YYYY-MM-DD or ''
  rotation_members: string[]; // user_ids in the rotation pool
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const emptyForm: FormData = {
  name: '',
  description: '',
  category_id: '',
  assigned_to: '',
  due_datetime: '',
  difficulty: 'medium',
  estimated_duration: 30,
  points: 10,
  requires_approval: false,
  repeat: '',
  repeat_interval: 1,
  repeat_weekdays: [],
  repeat_until: '',
  rotation_members: [],
};

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onTaskCreated }) => {
  const { user } = useAuth();
  const { currentHousehold, members: householdMembers } = useHousehold();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Tables<'task_categories'>[]>([]);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  // Fetch categories on mount
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      // Reset form when modal opens
      setFormData(emptyForm);
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('task_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number | boolean | number[] | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleInList = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];

  const isRecurring = formData.repeat !== '';

  const buildRecurrencePattern = () => ({
    ...buildPattern({
      freq: formData.repeat as 'DAILY' | 'WEEKLY' | 'MONTHLY',
      interval: formData.repeat_interval,
      byweekday: formData.repeat === 'WEEKLY' ? formData.repeat_weekdays : undefined,
      // End-of-day local so the end date itself is included
      until: formData.repeat_until ? new Date(`${formData.repeat_until}T23:59:59`) : undefined,
      dtstart: new Date(formData.due_datetime),
    }),
    rotation: { members: formData.rotation_members },
  });

  const recurrencePreview = (() => {
    if (!isRecurring || !formData.due_datetime) return '';
    try {
      return getRecurrenceText(buildRecurrencePattern());
    } catch {
      return '';
    }
  })();

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Task name is required';
    if (formData.name.trim().length < 3) return 'Task name must be at least 3 characters';
    if (!formData.category_id) return 'Please select a category';
    // Assignment is now optional - removed assigned_to validation
    if (!formData.due_datetime) return 'Please set a due date';
    if (formData.estimated_duration <= 0) return 'Duration must be greater than 0';
    if (formData.points <= 0) return 'Points must be greater than 0';
    if (isRecurring) {
      if (formData.repeat_interval < 1) return 'Repeat interval must be at least 1';
      if (formData.rotation_members.length === 0) return 'Select at least one member for the rotation';
      if (formData.repeat_until && formData.repeat_until < formData.due_datetime.slice(0, 10)) {
        return 'End date must be on or after the due date';
      }
    }

    // Check if due date is in the future
    const dueDate = new Date(formData.due_datetime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) return 'Due date must be today or in the future';

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!user || !currentHousehold) {
      toast.error('Authentication error');
      return;
    }

    setLoading(true);

    try {
      // Create the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          household_id: currentHousehold.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
          category_id: formData.category_id || null,
          difficulty: formData.difficulty,
          estimated_duration: formData.estimated_duration,
          points: formData.points,
          assignment_type: isRecurring
            ? (formData.rotation_members.length > 1 ? 'rotating' : 'fixed')
            : (formData.assigned_to ? 'fixed' : 'flexible'),
          requires_approval: formData.requires_approval,
          created_by: user.id,
          recurrence_type: isRecurring
            ? (formData.repeat.toLowerCase() as 'daily' | 'weekly' | 'monthly')
            : 'none',
          recurrence_pattern: isRecurring ? buildRecurrencePattern() : {},
          is_active: true,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      if (isRecurring) {
        try {
          const count = await materializeTask(task, supabase);
          if (count === 0) {
            toast('Task created — no occurrences fall in the next 4 weeks');
          } else {
            toast.success(`Task created — ${count} occurrence${count === 1 ? '' : 's'} scheduled`);
          }
        } catch (err) {
          // Task row exists; only scheduling failed — still close/refresh
          toast.error(`Task created but scheduling failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        // Create the task assignment only if someone is assigned
        if (formData.assigned_to) {
          const { error: assignmentError } = await supabase
            .from('task_assignments')
            .insert({
              task_id: task.id,
              assigned_to: formData.assigned_to,
              // datetime-local is a local wall-clock string; convert to a real
              // instant so timestamptz doesn't misread it as UTC
              due_datetime: new Date(formData.due_datetime).toISOString(),
              assigned_by: user.id,
              status: 'pending',
            });

          if (assignmentError) throw assignmentError;
        }
        toast.success('Task created successfully!');
      }
      onTaskCreated();
      onClose();
    } catch (error: unknown) {
      console.error('Error creating task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return <CheckCircle className="w-4 h-4" />;
      case 'medium': return <Star className="w-4 h-4" />;
      case 'hard': return <Zap className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md lg:max-w-2xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-emerald-50">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add New Task</h2>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">Create a new task for your household</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {/* Task Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Task Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                      placeholder="e.g., Clean the kitchen"
                      required
                      minLength={3}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base resize-none"
                      placeholder="Optional: Add more details about the task..."
                    />
                  </div>

                  {/* Two-column layout on larger screens */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Tag className="w-4 h-4 inline mr-1" />
                        Category *
                      </label>
                      <select
                        value={formData.category_id}
                        onChange={(e) => handleInputChange('category_id', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                        required
                      >
                        <option value="">Select a category</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Assigned To */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <User className="w-4 h-4 inline mr-1" />
                        {isRecurring ? 'Assign To (rotation) *' : 'Assign To'}
                      </label>
                      {isRecurring ? (
                        <div>
                          <div className="border border-gray-300 rounded-xl p-3 space-y-2">
                            {householdMembers.map((member: HouseholdMember) => (
                              <label key={member.user_id} className="flex items-center gap-3 cursor-pointer min-h-11">
                                <input
                                  type="checkbox"
                                  checked={formData.rotation_members.includes(member.user_id)}
                                  onChange={() => handleInputChange('rotation_members', toggleInList(formData.rotation_members, member.user_id))}
                                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-base text-gray-700">
                                  {member.user_profile?.display_name || 'Unknown User'}
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            One member = fixed assignee, several = round-robin rotation
                          </p>
                        </div>
                      ) : (
                        <select
                          value={formData.assigned_to}
                          onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                        >
                          <option value="">🔄 Leave Unassigned (Anyone can claim)</option>
                          {householdMembers.map((member: HouseholdMember) => (
                            <option key={member.user_id} value={member.user_id}>
                              {member.user_profile?.display_name || 'Unknown User'}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Due Date and Duration */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Due Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Due Date *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.due_datetime}
                        onChange={(e) => handleInputChange('due_datetime', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                        required
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Duration (minutes) *
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleInputChange('estimated_duration', Math.max(5, formData.estimated_duration - 15))}
                          className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center text-lg font-medium"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={formData.estimated_duration}
                          onChange={(e) => handleInputChange('estimated_duration', parseInt(e.target.value) || 30)}
                          min="5"
                          step="5"
                          className="flex-1 px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base text-center min-w-0"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleInputChange('estimated_duration', formData.estimated_duration + 15)}
                          className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center text-lg font-medium"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recurrence */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Repeat className="w-4 h-4 inline mr-1" />
                      Repeat
                    </label>
                    <select
                      value={formData.repeat}
                      onChange={(e) => {
                        const repeat = e.target.value as FormData['repeat'];
                        // Assign-To sits above Repeat: carry the chosen assignee into the rotation
                        setFormData(prev => ({
                          ...prev,
                          repeat,
                          rotation_members: repeat && prev.rotation_members.length === 0 && prev.assigned_to
                            ? [prev.assigned_to]
                            : prev.rotation_members,
                        }));
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                    >
                      <option value="">Does not repeat</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>

                    {isRecurring && (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">Every</span>
                          <input
                            type="number"
                            value={formData.repeat_interval}
                            onChange={(e) => handleInputChange('repeat_interval', parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-20 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base text-center"
                          />
                          <span className="text-sm text-gray-700">
                            {{ DAILY: 'day(s)', WEEKLY: 'week(s)', MONTHLY: 'month(s)' }[formData.repeat as 'DAILY' | 'WEEKLY' | 'MONTHLY']}
                          </span>
                        </div>

                        {formData.repeat === 'WEEKLY' && (
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAY_LABELS.map((label, i) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => handleInputChange('repeat_weekdays', toggleInList(formData.repeat_weekdays, i))}
                                className={`min-h-11 min-w-11 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                                  formData.repeat_weekdays.includes(i)
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ends on (optional)
                          </label>
                          <input
                            type="date"
                            value={formData.repeat_until}
                            onChange={(e) => handleInputChange('repeat_until', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                          />
                        </div>

                        {recurrencePreview && (
                          <p className="text-sm text-blue-600">Repeats {recurrencePreview}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Difficulty and Points */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Difficulty */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Difficulty Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['easy', 'medium', 'hard'] as const).map(difficulty => (
                          <button
                            key={difficulty}
                            type="button"
                            onClick={() => handleInputChange('difficulty', difficulty)}
                            className={`p-3 border-2 rounded-xl transition-all capitalize font-medium flex items-center justify-center gap-2 ${
                              formData.difficulty === difficulty 
                                ? DIFFICULTY_STYLE[difficulty].tw + ' ring-2 ring-blue-500 ring-opacity-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                            }`}
                          >
                            {getDifficultyIcon(difficulty)}
                            <span className="text-sm">{difficulty}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Points */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Star className="w-4 h-4 inline mr-1" />
                        Points *
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleInputChange('points', Math.max(5, formData.points - 5))}
                          className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center text-lg font-medium"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={formData.points}
                          onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 10)}
                          min="5"
                          step="5"
                          className="flex-1 px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base text-center min-w-0"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleInputChange('points', formData.points + 5)}
                          className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center text-lg font-medium"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Advanced Options</h3>
                    
                    {/* Requires Approval */}
                    <div className="flex items-center space-x-3 min-h-11">
                      <input
                        type="checkbox"
                        id="requires_approval"
                        checked={formData.requires_approval}
                        onChange={(e) => handleInputChange('requires_approval', e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="requires_approval" className="text-sm font-medium text-gray-700">
                        Requires approval when completed
                      </label>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-emerald-500 text-white rounded-xl hover:from-blue-600 hover:to-emerald-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Create Task
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddTaskModal;