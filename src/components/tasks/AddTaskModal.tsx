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
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase, Tables } from '../../lib/supabase';
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
  assigned_to: string;
  due_date: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimated_duration: number;
  points: number;
  assignment_type: 'fixed' | 'rotating' | 'flexible';
  requires_approval: boolean;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onTaskCreated }) => {
  const { user } = useAuth();
  const { currentHousehold, members: householdMembers } = useHousehold();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Tables<'task_categories'>[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    category_id: '',
    assigned_to: '',
    due_date: '',
    difficulty: 'medium',
    estimated_duration: 30,
    points: 10,
    assignment_type: 'fixed',
    requires_approval: false,
  });

  // Fetch categories on mount
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      // Reset form when modal opens
      setFormData({
        name: '',
        description: '',
        category_id: '',
        assigned_to: '',
        due_date: '',
        difficulty: 'medium',
        estimated_duration: 30,
        points: 10,
        assignment_type: 'fixed',
        requires_approval: false,
      });
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

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Task name is required';
    if (formData.name.trim().length < 3) return 'Task name must be at least 3 characters';
    if (!formData.category_id) return 'Please select a category';
    if (!formData.assigned_to) return 'Please assign the task to someone';
    if (!formData.due_date) return 'Please set a due date';
    if (formData.estimated_duration <= 0) return 'Duration must be greater than 0';
    if (formData.points <= 0) return 'Points must be greater than 0';
    
    // Check if due date is in the future
    const dueDate = new Date(formData.due_date);
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
          assignment_type: formData.assignment_type,
          requires_approval: formData.requires_approval,
          created_by: user.id,
          recurrence_type: 'none',
          recurrence_pattern: {},
          is_active: true,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create the task assignment
      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .insert({
          task_id: task.id,
          assigned_to: formData.assigned_to,
          due_date: formData.due_date,
          assigned_by: user.id,
          status: 'pending',
        });

      if (assignmentError) throw assignmentError;

      toast.success('Task created successfully!');
      onTaskCreated();
      onClose();
    } catch (error: unknown) {
      console.error('Error creating task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

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
                        Assign To *
                      </label>
                      <select
                        value={formData.assigned_to}
                        onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                        required
                      >
                        <option value="">Select a member</option>
                        {householdMembers.map((member: HouseholdMember) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.user_profile?.display_name || 'Unknown User'}
                          </option>
                        ))}
                      </select>
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
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => handleInputChange('due_date', e.target.value)}
                        min={today}
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
                                ? getDifficultyColor(difficulty) + ' ring-2 ring-blue-500 ring-opacity-50'
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
                          onClick={() => handleInputChange('points', Math.max(1, formData.points - 5))}
                          className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center text-lg font-medium"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={formData.points}
                          onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 10)}
                          min="1"
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
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Assignment Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Assignment Type
                        </label>
                        <select
                          value={formData.assignment_type}
                          onChange={(e) => handleInputChange('assignment_type', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                        >
                          <option value="fixed">Fixed Assignment</option>
                          <option value="rotating">Rotating Assignment</option>
                          <option value="flexible">Flexible Assignment</option>
                        </select>
                      </div>

                      {/* Requires Approval */}
                      <div className="flex items-center space-x-3 pt-8">
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