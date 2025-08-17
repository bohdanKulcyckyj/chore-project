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
  UserPlus,
  MoreVertical,
  Edit3,
  Archive
} from 'lucide-react';
import { format } from 'date-fns';
import { Tables, supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import CompleteTaskModal from './CompleteTaskModal';
import TaskDetailModal from './TaskDetailModal';
import TaskCompletionCelebration from '../animations/TaskCompletionCelebration';
import PendingApprovalAnimation from '../animations/PendingApprovalAnimation';
import { completeTask, TaskCompletionData, TaskCompletionResult } from '../../lib/api/tasks';

// Shadcn UI Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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

const TaskTableShadcn: React.FC<TaskTableProps> = ({ 
  tasks, 
  loading = false,
  onTaskUpdate 
}) => {
  const { user } = useAuth();
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    status: '__all__',
    category: '__all__',
    assignedTo: '__all__',
    dateRange: '__all__'
  });
  const [sort, setSort] = useState<SortState>({
    field: 'due_date',
    direction: 'asc'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [completeModalTask, setCompleteModalTask] = useState<TaskWithAssignment | null>(null);
  const [detailModalTask, setDetailModalTask] = useState<TaskWithAssignment | null>(null);
  const [celebrationData, setCelebrationData] = useState<{
    visible: boolean;
    result?: TaskCompletionResult;
    pointsEarned?: number;
    streakCount?: number;
  }>({ visible: false });
  const [pendingApprovalData, setPendingApprovalData] = useState<{
    visible: boolean;
    taskName?: string;
  }>({ visible: false });

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

  // Placeholder handlers for new actions
  const handleEditTask = async (_task: TaskWithAssignment) => {
    toast('Edit task functionality coming soon!', { icon: '🚧' });
  };

  const handleArchiveTask = async (_task: TaskWithAssignment) => {
    toast('Archive task functionality coming soon!', { icon: '🚧' });
  };

  const handleReassignTask = async (_task: TaskWithAssignment) => {
    toast('Reassign task functionality coming soon!', { icon: '🚧' });
  };

  const handleMarkComplete = async (task: TaskWithAssignment) => {
    if (!user || task.assigned_to !== user.id || task.status === 'completed') {
      toast.error('You cannot complete this task');
      return;
    }
    setCompleteModalTask(task);
  };

  const handleTaskRowClick = (task: TaskWithAssignment) => {
    setDetailModalTask(task);
  };

  const handleCompleteTask = async (completionData: TaskCompletionData) => {
    if (!completeModalTask) return;

    try {
      const result = await completeTask(completeModalTask.id, completionData);
      
      if (result.requiresApproval) {
        // Show pending approval animation
        setPendingApprovalData({
          visible: true,
          taskName: completeModalTask.task.name
        });
      } else {
        // Get updated streak count for celebration
        let streakCount = 1;
        if (user) {
          const { data: householdData } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', user.id)
            .single();

          if (householdData) {
            const { data: pointsData } = await supabase
              .from('user_points')
              .select('current_streak')
              .eq('user_id', user.id)
              .eq('household_id', householdData.household_id)
              .single();

            if (pointsData) {
              streakCount = pointsData.current_streak;
            }
          }
        }
        
        // Show celebration animation
        setCelebrationData({
          visible: true,
          result,
          pointsEarned: result.points,
          streakCount
        });
      }

      // Refresh task list
      onTaskUpdate?.();
      
      toast.success(result.message);
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
      throw error;
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
    const filtered = tasks.filter(task => {
      const matchesSearch = 
        task.task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !filters.status || filters.status === '__all__' || task.status === filters.status;
      const matchesCategory = !filters.category || filters.category === '__all__' || task.task.category?.name === filters.category;
      const matchesAssignee = !filters.assignedTo || filters.assignedTo === '__all__' || 
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

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'default';
      case 'overdue':
        return 'destructive';
      case 'skipped':
        return 'secondary';
      case 'unassigned':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getDifficultyVariant = (difficulty: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (difficulty) {
      case 'easy':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'hard':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const SortButton: React.FC<{ field: string; children: React.ReactNode }> = ({ field, children }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
    >
      <span className="flex items-center gap-1">
        {children}
        {sort.field === field && (
          sort.direction === 'asc' ? 
            <SortAsc className="w-4 h-4" /> : 
            <SortDesc className="w-4 h-4" />
        )}
      </span>
    </Button>
  );

  const TaskActionsDropdown: React.FC<{ task: TaskWithAssignment }> = ({ task }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="h-8 w-8 p-0"
          disabled={claimingTaskId === task.id}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {task.status === 'unassigned' ? (
          <>
            <DropdownMenuItem onClick={() => handleClaimTask(task)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Claim Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEditTask(task)}>
              <Edit3 className="mr-2 h-4 w-4" />
              Edit Task
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleArchiveTask(task)}
              className="text-destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive Task
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {task.status !== 'completed' && (
              <DropdownMenuItem onClick={() => handleMarkComplete(task)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Complete
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleEditTask(task)}>
              <Edit3 className="mr-2 h-4 w-4" />
              Edit Assignment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleReassignTask(task)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Reassign Task
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleArchiveTask(task)}
              className="text-destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive Task
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
              <Input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full md:w-64"
              />
            </div>
            
            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
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
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {filterOptions.statuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {filterOptions.categories.map(category => (
                    <SelectItem key={category} value={category || '__unknown__'}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <Select value={filters.assignedTo} onValueChange={(value) => setFilters(prev => ({ ...prev, assignedTo: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Members</SelectItem>
                  {filterOptions.assignees.map(assignee => (
                    <SelectItem key={assignee} value={assignee || '__unknown__'}>
                      {assignee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 lg:col-span-1 flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({ status: '__all__', category: '__all__', assignedTo: '__all__', dateRange: '__all__' });
                  setSearchTerm('');
                }}
                className="w-full sm:w-auto"
              >
                Clear All
              </Button>
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
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton field="name">Task</SortButton>
              </TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>
                <SortButton field="due_date">Due Date</SortButton>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead>
                <SortButton field="priority">Priority</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="status">Status</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="points">Points</SortButton>
              </TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <Clock className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-gray-500">
                      {searchTerm || Object.values(filters).some(f => f && f !== '__all__') ? 
                        'No tasks match your search criteria' : 
                        'No tasks found'
                      }
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedTasks.map((assignment, index) => (
                <motion.tr
                  key={assignment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleTaskRowClick(assignment)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">{assignment.task.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {assignment.task.description}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {assignment.task.estimated_duration} min
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
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
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {assignment.due_date ? 
                          format(new Date(assignment.due_date), 'MMM dd, yyyy') : 
                          'No due date'
                        }
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {assignment.task.category ? (
                      <Badge variant="secondary">
                        <Tag className="w-3 h-3 mr-1" />
                        {assignment.task.category.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">No category</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant={getDifficultyVariant(assignment.task.difficulty)}>
                      {assignment.task.difficulty}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center">
                      {getStatusIcon(assignment.status)}
                      <Badge variant={getStatusVariant(assignment.status)} className="ml-2">
                        {assignment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <span className="text-sm font-medium text-gray-900">
                      {assignment.task.points}
                    </span>
                  </TableCell>
                  
                  <TableCell>
                    <div onClick={(e) => e.stopPropagation()}>
                      <TaskActionsDropdown task={assignment} />
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View - keeping the existing implementation for now */}
      <div className="md:hidden space-y-4 p-4">
        {filteredAndSortedTasks.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">
              {searchTerm || Object.values(filters).some(f => f && f !== '__all__') ? 
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
              className="bg-gray-50 rounded-xl p-4 border border-gray-200 cursor-pointer hover:bg-gray-100"
              onClick={() => handleTaskRowClick(assignment)}
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
                  <Badge variant={getStatusVariant(assignment.status)}>
                    {assignment.status.replace('_', ' ')}
                  </Badge>
                  
                  {/* Priority */}
                  <Badge variant={getDifficultyVariant(assignment.task.difficulty)}>
                    {assignment.task.difficulty}
                  </Badge>

                  {/* Category */}
                  {assignment.task.category && (
                    <Badge variant="secondary">
                      <Tag className="w-3 h-3 mr-1" />
                      {assignment.task.category.name}
                    </Badge>
                  )}
                </div>

                {/* Task Actions */}
                <div onClick={(e) => e.stopPropagation()}>
                  <TaskActionsDropdown task={assignment} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Complete Task Modal */}
      <CompleteTaskModal
        isOpen={!!completeModalTask}
        task={completeModalTask}
        onClose={() => setCompleteModalTask(null)}
        onComplete={handleCompleteTask}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={!!detailModalTask}
        task={detailModalTask}
        onClose={() => setDetailModalTask(null)}
        onClaimTask={handleClaimTask}
        onMarkComplete={handleMarkComplete}
        onEditTask={handleEditTask}
        onReassignTask={handleReassignTask}
      />

      {/* Celebration Animation */}
      <TaskCompletionCelebration
        isVisible={celebrationData.visible}
        result={celebrationData.result!}
        pointsEarned={celebrationData.pointsEarned || 0}
        streakCount={celebrationData.streakCount}
        onComplete={() => setCelebrationData({ visible: false })}
      />

      {/* Pending Approval Animation */}
      <PendingApprovalAnimation
        isVisible={pendingApprovalData.visible}
        taskName={pendingApprovalData.taskName || ''}
        onComplete={() => setPendingApprovalData({ visible: false })}
      />
    </motion.div>
  );
};

export default TaskTableShadcn;