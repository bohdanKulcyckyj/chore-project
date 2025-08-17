import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  Calendar,
  User,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  SortAsc,
  SortDesc,
  UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { Tables, supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

// Types
type TaskWithAssignment = {
  id: string;
  task: Tables<'tasks'> & {
    category?: Tables<'task_categories'>;
  };
  assigned_to?: string;
  assigned_user?: Tables<'user_profiles'>;
  due_date?: string;
  status: string;
  assigned_at?: string;
  assigned_by?: string;
};

interface TaskTableProps {
  tasks: TaskWithAssignment[];
  loading?: boolean;
  onTaskUpdate?: () => void;
}

interface FilterState {
  status: string;
  category: string;
  assignedTo: string;
  dateRange: string;
}

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

const TaskTable: React.FC<TaskTableProps> = ({ 
  tasks, 
  loading = false,
  onTaskUpdate 
}) => {
  const { user } = useAuth();
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    category: '',
    assignedTo: '',
    dateRange: ''
  });
  const [sort, setSort] = useState<SortState>({
    field: 'due_date',
    direction: 'asc'
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleClaimTask = async (task: TaskWithAssignment) => {
    if (!user || task.status !== 'unassigned') return;

    setClaimingTaskId(task.id);
    
    try {
      // Extract task ID from the unassigned task ID format
      const taskId = task.id.startsWith('unassigned-') ? task.id.replace('unassigned-', '') : task.task.id;
      
      const { error } = await supabase
        .from('task_assignments')
        .insert({
          task_id: taskId,
          assigned_to: user.id,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days from now
          assigned_by: user.id,
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Task claimed successfully!');
      onTaskUpdate?.();
    } catch (error) {
      console.error('Error claiming task:', error);
      toast.error('Failed to claim task');
    } finally {
      setClaimingTaskId(null);
    }
  };

  const getFieldValue = (task: TaskWithAssignment, field: string) => {
    switch (field) {
      case 'name':
        return task.task.name.toLowerCase();
      case 'due_date':
        return task.due_date ? new Date(task.due_date).getTime() : 0;
      case 'priority':
        return task.task.difficulty;
      case 'status':
        return task.status;
      case 'points':
        return task.task.points;
      default:
        return '';
    }
  };

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const statuses = Array.from(new Set(tasks.map(t => t.status)));
    const categories = Array.from(new Set(tasks.map(t => t.task.category?.name).filter(Boolean)));
    const assignees = Array.from(new Set(tasks.map(t => 
      t.status === 'unassigned' ? 'Available' : t.assigned_user?.display_name
    ).filter(Boolean)));
    
    return { statuses, categories, assignees };
  }, [tasks]);

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const matchesSearch = 
        task.task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !filters.status || task.status === filters.status;
      const matchesCategory = !filters.category || task.task.category?.name === filters.category;
      const matchesAssignee = !filters.assignedTo || 
        (filters.assignedTo === 'Available' && task.status === 'unassigned') ||
        (filters.assignedTo !== 'Available' && task.assigned_user?.display_name === filters.assignedTo);
      
      return matchesSearch && matchesStatus && matchesCategory && matchesAssignee;
    });

    // Sort tasks
    filtered.sort((a, b) => {
      const aValue = getFieldValue(a, sort.field);
      const bValue = getFieldValue(b, sort.field);
      
      if (aValue === bValue) return 0;
      
      const comparison = aValue > bValue ? 1 : -1;
      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [tasks, searchTerm, filters, sort]);

  const handleSort = (field: string) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <Pause className="w-4 h-4 text-gray-500" />;
      case 'unassigned':
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'skipped':
        return 'bg-gray-100 text-gray-800';
      case 'unassigned':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const SortButton: React.FC<{ field: string; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
    >
      {children}
      {sort.field === field && (
        sort.direction === 'asc' ? 
          <SortAsc className="w-4 h-4" /> : 
          <SortDesc className="w-4 h-4" />
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900">Task Management</h2>
          
          {/* Search and Filter Controls */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64"
              />
            </div>
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                {filterOptions.statuses.map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <select
                value={filters.assignedTo}
                onChange={(e) => setFilters(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Members</option>
                {filterOptions.assignees.map(assignee => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-1 flex items-end">
              <button
                onClick={() => {
                  setFilters({ status: '', category: '', assignedTo: '', dateRange: '' });
                  setSearchTerm('');
                }}
                className="w-full sm:w-auto px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear All
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Results Summary */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <p className="text-sm text-gray-600">
          Showing {filteredAndSortedTasks.length} of {tasks.length} tasks
        </p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="name">Task</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="due_date">Due Date</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="priority">Priority</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="status">Status</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="points">Points</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Clock className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-gray-500">
                      {searchTerm || Object.values(filters).some(f => f) ? 
                        'No tasks match your search criteria' : 
                        'No tasks found'
                      }
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedTasks.map((assignment, index) => (
                <motion.tr
                  key={assignment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{assignment.task.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {assignment.task.description}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {assignment.task.estimated_duration} min
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        assignment.status === 'unassigned' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        <User className={`w-4 h-4 ${
                          assignment.status === 'unassigned' ? 'text-purple-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <span className="text-sm text-gray-900">
                        {assignment.status === 'unassigned' ? 'Available' : (assignment.assigned_user?.display_name || 'Unknown')}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {assignment.due_date ? 
                          format(new Date(assignment.due_date), 'MMM dd, yyyy') : 
                          'No due date'
                        }
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {assignment.task.category ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Tag className="w-3 h-3 mr-1" />
                        {assignment.task.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">No category</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(assignment.task.difficulty)}`}>
                      {assignment.task.difficulty}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {getStatusIcon(assignment.status)}
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                        {assignment.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {assignment.task.points}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    {assignment.status === 'unassigned' && (
                      <button
                        onClick={() => handleClaimTask(assignment)}
                        disabled={claimingTaskId === assignment.id}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {claimingTaskId === assignment.id ? (
                          <>
                            <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin mr-1" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3 mr-1" />
                            Claim Task
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4 p-4">
        {filteredAndSortedTasks.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">
              {searchTerm || Object.values(filters).some(f => f) ? 
                'No tasks match your search criteria' : 
                'No tasks found'
              }
            </p>
          </div>
        ) : (
          filteredAndSortedTasks.map((assignment, index) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-50 rounded-xl p-4 border border-gray-200"
            >
              {/* Task Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {assignment.task.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {assignment.task.description}
                  </p>
                </div>
                <div className="ml-3 flex items-center">
                  {getStatusIcon(assignment.status)}
                </div>
              </div>

              {/* Task Details Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Assigned User */}
                <div className="flex items-center">
                  <User className={`w-4 h-4 mr-2 ${
                    assignment.status === 'unassigned' ? 'text-purple-400' : 'text-gray-400'
                  }`} />
                  <span className="text-sm text-gray-900 truncate">
                    {assignment.status === 'unassigned' ? 'Available' : (assignment.assigned_user?.display_name || 'Unknown')}
                  </span>
                </div>

                {/* Due Date */}
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">
                    {assignment.due_date ? 
                      format(new Date(assignment.due_date), 'MMM dd') : 
                      'No due date'
                    }
                  </span>
                </div>

                {/* Duration */}
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">
                    {assignment.task.estimated_duration} min
                  </span>
                </div>

                {/* Points */}
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900">
                    {assignment.task.points} points
                  </span>
                </div>
              </div>

              {/* Bottom Row - Status, Category, Priority, Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                    {assignment.status.replace('_', ' ')}
                  </span>
                  
                  {/* Priority */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(assignment.task.difficulty)}`}>
                    {assignment.task.difficulty}
                  </span>

                  {/* Category */}
                  {assignment.task.category && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Tag className="w-3 h-3 mr-1" />
                      {assignment.task.category.name}
                    </span>
                  )}
                </div>

                {/* Claim Action */}
                {assignment.status === 'unassigned' && (
                  <button
                    onClick={() => handleClaimTask(assignment)}
                    disabled={claimingTaskId === assignment.id}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {claimingTaskId === assignment.id ? (
                      <>
                        <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin mr-1" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3 mr-1" />
                        Claim
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default TaskTable;