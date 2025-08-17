import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, User, Calendar, MessageSquare, Eye, MoreVertical, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { supabase, Tables } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import toast from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

type TaskCompletionWithDetails = Tables<'task_completions'> & {
  assignment: Tables<'task_assignments'> & {
    task: Tables<'tasks'> | null;
    assigned_user: Tables<'user_profiles'> | null;
  };
  completed_user: Tables<'user_profiles'> | null;
};

interface TaskApprovalInterfaceProps {
  onApprovalUpdate?: () => void;
}

const TaskApprovalInterface: React.FC<TaskApprovalInterfaceProps> = ({ 
  onApprovalUpdate 
}) => {
  const { user } = useAuth();
  const { currentHousehold, isAdmin } = useHousehold();
  const [pendingCompletions, setPendingCompletions] = useState<TaskCompletionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [detailModalCompletion, setDetailModalCompletion] = useState<TaskCompletionWithDetails | null>(null);

  const fetchPendingCompletions = async () => {
    if (!currentHousehold || !isAdmin) return;

    try {
      setLoading(true);

      // First, get all pending task completions
      const { data: completions, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('approval_status', 'pending')
        .order('completed_at', { ascending: false });

      if (error) throw error;

      if (!completions || completions.length === 0) {
        setPendingCompletions([]);
        return;
      }

      // Get assignment IDs and user IDs
      const assignmentIds = completions.map(c => c.assignment_id);
      const userIds = [...new Set(completions.map(c => c.completed_by))];

      // Fetch assignments with tasks
      const { data: assignments, error: assignmentsError } = await supabase
        .from('task_assignments')
        .select(`
          *,
          task:tasks(*)
        `)
        .in('id', assignmentIds);

      if (assignmentsError) throw assignmentsError;

      // Filter assignments to only include those from current household
      const householdAssignments = assignments?.filter(a => 
        a.task?.household_id === currentHousehold.id
      ) || [];

      if (householdAssignments.length === 0) {
        setPendingCompletions([]);
        return;
      }

      // Get user profiles for completed_by and assigned_to users
      const allUserIds = [
        ...userIds,
        ...householdAssignments.map(a => a.assigned_to)
      ];
      const uniqueUserIds = [...new Set(allUserIds)];

      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', uniqueUserIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const completionsWithDetails: TaskCompletionWithDetails[] = completions
        .map(completion => {
          const assignment = householdAssignments.find(a => a.id === completion.assignment_id);
          if (!assignment) return null;

          return {
            ...completion,
            assignment: {
              ...assignment,
              assigned_user: userProfiles?.find(p => p.id === assignment.assigned_to) || null
            },
            completed_user: userProfiles?.find(p => p.id === completion.completed_by) || null
          };
        })
        .filter(Boolean) as TaskCompletionWithDetails[];

      setPendingCompletions(completionsWithDetails);
    } catch (error) {
      console.error('Error fetching pending completions:', error);
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCompletions();
  }, [currentHousehold, isAdmin]);

  const handleApproval = async (
    completionId: string, 
    status: 'approved' | 'rejected',
    notes: string = ''
  ) => {
    if (!isAdmin || !user) return;

    setProcessingId(completionId);

    try {
      const completion = pendingCompletions.find(c => c.id === completionId);
      if (!completion) throw new Error('Completion not found');

      // Update the completion status
      const { error: updateError } = await supabase
        .from('task_completions')
        .update({
          approval_status: status,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_notes: notes,
          points_awarded: status === 'approved' ? (completion.assignment.task?.points || 0) : 0
        })
        .eq('id', completionId);

      if (updateError) throw updateError;

      // Update assignment status if approved
      if (status === 'approved') {
        const { error: assignmentError } = await supabase
          .from('task_assignments')
          .update({ status: 'completed' })
          .eq('id', completion.assignment_id);

        if (assignmentError) throw assignmentError;

        // Update user points if approved
        const { data: currentPoints, error: pointsError } = await supabase
          .from('user_points')
          .select('*')
          .eq('user_id', completion.completed_by)
          .eq('household_id', currentHousehold.id)
          .single();

        if (pointsError && pointsError.code !== 'PGRST116') throw pointsError;

        if (currentPoints) {
          const { error: updatePointsError } = await supabase
            .from('user_points')
            .update({
              total_points: currentPoints.total_points + (completion.assignment.task?.points || 0),
              tasks_completed: currentPoints.tasks_completed + 1,
              last_activity: new Date().toISOString()
            })
            .eq('id', currentPoints.id);

          if (updatePointsError) throw updatePointsError;
        }
      }

      toast.success(`Task completion ${status}!`);
      await fetchPendingCompletions();
      onApprovalUpdate?.();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error(`Failed to ${status === 'approved' ? 'approve' : 'reject'} completion`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleNotesChange = (completionId: string, notes: string) => {
    setApprovalNotes(prev => ({ ...prev, [completionId]: notes }));
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const ApprovalDetailModal: React.FC<{ 
    completion: TaskCompletionWithDetails | null; 
    onClose: () => void;
  }> = ({ completion, onClose }) => {
    if (!completion) return null;

    return (
      <Dialog open={!!completion} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Task Completion Details
            </DialogTitle>
            <DialogDescription>
              Review the complete submission for this task
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Task Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Task Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Task Name:</span>
                  <p className="font-medium">{completion.assignment.task?.name || 'Unknown Task'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Points:</span>
                  <p className="font-medium text-yellow-600">{completion.assignment.task?.points || 0}</p>
                </div>
                <div>
                  <span className="text-gray-500">Difficulty:</span>
                  <p className="font-medium capitalize">{completion.assignment.task?.difficulty || 'unknown'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Category:</span>
                  <p className="font-medium">{completion.assignment.task?.category || 'Uncategorized'}</p>
                </div>
              </div>
              {completion.assignment.task?.description && (
                <div className="mt-3">
                  <span className="text-gray-500">Description:</span>
                  <p className="text-gray-900 mt-1">{completion.assignment.task.description}</p>
                </div>
              )}
            </div>

            {/* Completion Information */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Completion Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Completed By:</span>
                  <p className="font-medium">{completion.completed_user?.display_name || 'Unknown User'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Completed At:</span>
                  <p className="font-medium">
                    {format(new Date(completion.completed_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
                {completion.time_spent && (
                  <div>
                    <span className="text-gray-500">Time Spent:</span>
                    <p className="font-medium">{completion.time_spent} minutes</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {completion.notes && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Completion Notes</h3>
                <div className="bg-white border rounded-lg p-3">
                  <p className="text-gray-700 whitespace-pre-wrap">{completion.notes}</p>
                </div>
              </div>
            )}

            {/* Attachments */}
            {completion.proof_urls && completion.proof_urls.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Attachments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {completion.proof_urls.map((url, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">Attachment {index + 1}</span>
                      </div>
                      {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block hover:opacity-90 transition-opacity"
                        >
                          <img 
                            src={url} 
                            alt={`Proof ${index + 1}`}
                            className="w-full h-32 object-cover rounded border cursor-pointer hover:border-blue-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </a>
                      ) : (
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm underline block"
                        >
                          View attachment
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Notes */}
            <div>
              <Label htmlFor="approval-notes" className="text-sm font-medium text-gray-700">
                Approval Notes (Optional)
              </Label>
              <Input
                id="approval-notes"
                placeholder="Add notes for your decision..."
                value={approvalNotes[completion.id] || ''}
                onChange={(e) => handleNotesChange(completion.id, e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Actions Footer */}
          <div className="border-t border-gray-200 p-6">
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  handleApproval(completion.id, 'approved', approvalNotes[completion.id] || '');
                  onClose();
                }}
                disabled={processingId === completion.id}
                className="bg-green-600 hover:bg-green-700"
              >
                {processingId === completion.id ? (
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  handleApproval(completion.id, 'rejected', approvalNotes[completion.id] || '');
                  onClose();
                }}
                disabled={processingId === completion.id}
                variant="destructive"
              >
                {processingId === completion.id ? (
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const ApprovalActionsDropdown: React.FC<{ completion: TaskCompletionWithDetails }> = ({ completion }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="h-8 w-8 p-0"
          disabled={processingId === completion.id}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Approval options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => setDetailModalCompletion(completion)}
        >
          <FileText className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleApproval(
            completion.id, 
            'approved', 
            approvalNotes[completion.id] || ''
          )}
          className="text-green-600"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Approve
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleApproval(
            completion.id, 
            'rejected', 
            approvalNotes[completion.id] || ''
          )}
          className="text-red-600"
        >
          <XCircle className="mr-2 h-4 w-4" />
          Reject
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border overflow-hidden"
    >
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Pending Approvals
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Review and approve task completions
        </p>
      </div>

      {pendingCompletions.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            All caught up!
          </h3>
          <p className="text-gray-500">
            No task completions are waiting for approval.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Task</TableHead>
                  <TableHead>Completed By</TableHead>
                  <TableHead>Completed At</TableHead>
                  <TableHead>Time Spent</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCompletions.map((completion) => (
                  <TableRow 
                    key={completion.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDetailModalCompletion(completion)}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">
                          {completion.assignment.task?.name || 'Unknown Task'}
                        </div>
                        {completion.assignment.task?.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {completion.assignment.task.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {completion.assignment.task?.difficulty || 'unknown'} difficulty
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-600" />
                        </div>
                        <span className="font-medium text-gray-900">
                          {completion.completed_user?.display_name || 'Unknown User'}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="text-gray-900">
                          {format(new Date(completion.completed_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-gray-500">
                          {format(new Date(completion.completed_at), 'HH:mm')}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {completion.time_spent ? (
                        <span className="text-gray-600">
                          {completion.time_spent} min
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <span className="font-medium text-yellow-600">
                        {completion.assignment.task?.points || 0}
                      </span>
                    </TableCell>
                    
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ApprovalActionsDropdown completion={completion} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 p-4">
            {pendingCompletions.map((completion, index) => (
              <motion.div
                key={completion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-50 rounded-xl p-4 border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => setDetailModalCompletion(completion)}
              >
                {/* Task Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {completion.assignment.task?.name || 'Unknown Task'}
                    </h3>
                    {completion.assignment.task?.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {completion.assignment.task.description}
                      </p>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {completion.assignment.task?.difficulty || 'unknown'} difficulty
                    </div>
                  </div>
                  
                  {/* Actions in top right */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ApprovalActionsDropdown completion={completion} />
                  </div>
                </div>

                {/* Completion Details Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Completed By */}
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900 truncate">
                      {completion.completed_user?.display_name || 'Unknown User'}
                    </span>
                  </div>

                  {/* Completed At */}
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">
                      {format(new Date(completion.completed_at), 'MMM dd, HH:mm')}
                    </span>
                  </div>

                  {/* Time Spent */}
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">
                      {completion.time_spent ? `${completion.time_spent} min` : 'Not recorded'}
                    </span>
                  </div>

                  {/* Points */}
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-yellow-600">
                      {completion.assignment.task?.points || 0} points
                    </span>
                  </div>
                </div>

                {/* Bottom Row - Notes indicator */}
                <div className="flex items-center gap-2">
                  {/* Notes/Attachments indicator */}
                  {completion.notes && (
                    <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                      Has notes
                    </span>
                  )}
                  {completion.proof_urls && completion.proof_urls.length > 0 && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {completion.proof_urls.length} attachment(s)
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      <ApprovalDetailModal 
        completion={detailModalCompletion}
        onClose={() => setDetailModalCompletion(null)}
      />
    </motion.div>
  );
};

export default TaskApprovalInterface;