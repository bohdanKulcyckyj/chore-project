import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Home, UserPlus, Copy, Shield, MoreVertical, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase, Tables } from '../../lib/supabase';
import AdminGuard from '../auth/AdminGuard';
import { Button } from '../ui/button';
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
import toast from 'react-hot-toast';

type HouseholdMemberWithProfile = Tables<'household_members'> & {
  user_profile?: Tables<'user_profiles'>;
  user_points?: Tables<'user_points'>;
};

const Household: React.FC = () => {
  const { user } = useAuth();
  const { currentHousehold, members, isAdmin, refreshData } = useHousehold();
  const [loading, setLoading] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const handleCopyInviteCode = () => {
    if (currentHousehold?.invite_code) {
      navigator.clipboard.writeText(currentHousehold.invite_code);
      toast.success('Invite code copied to clipboard!');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    if (!isAdmin || memberId === user?.id) return;

    setUpdatingMemberId(memberId);

    try {
      const { error } = await supabase
        .from('household_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`Member role updated to ${newRole}`);
      await refreshData();
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error('Failed to update member role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isAdmin || memberId === user?.id) return;

    if (!confirm(`Are you sure you want to remove ${memberName} from the household?`)) {
      return;
    }

    setUpdatingMemberId(memberId);

    try {
      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`${memberName} has been removed from the household`);
      await refreshData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const MemberActionsDropdown: React.FC<{ member: HouseholdMemberWithProfile }> = ({ member }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="h-8 w-8 p-0"
          disabled={updatingMemberId === member.id || member.user_id === user?.id}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Member options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {member.role === 'member' ? (
          <DropdownMenuItem 
            onClick={() => handleRoleChange(member.id, 'admin')}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Make Admin
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem 
            onClick={() => handleRoleChange(member.id, 'member')}
          >
            <Users className="mr-2 h-4 w-4" />
            Make Member
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={() => handleRemoveMember(
            member.id, 
            member.user_profile?.display_name || 'this member'
          )}
          className="text-destructive"
        >
          <UserX className="mr-2 h-4 w-4" />
          Remove Member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!currentHousehold) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-8 text-center shadow-sm"
        >
          <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Household Selected
          </h3>
          <p className="text-gray-500">
            Please select or create a household to view household information.
          </p>
        </motion.div>
      </div>
    );
  }

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
            <Home className="w-8 h-8 text-blue-500" />
            Household Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage members and settings for {currentHousehold.name}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyInviteCode}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Invite Code
          </motion.button>
          
          <AdminGuard>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
              disabled
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </motion.button>
          </AdminGuard>
        </div>
      </motion.div>

      {/* Stats Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">
            {members.length}
          </div>
          <div className="text-sm text-gray-500">Total Members</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-orange-600">
            {members.filter(m => m.role === 'admin').length}
          </div>
          <div className="text-sm text-gray-500">Administrators</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {members.filter(m => m.role === 'member').length}
          </div>
          <div className="text-sm text-gray-500">Members</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-lg font-bold text-gray-900 font-mono">
            {currentHousehold.invite_code}
          </div>
          <div className="text-sm text-gray-500">Invite Code</div>
        </div>
      </motion.div>

      {/* Members Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Household Members
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No members found
            </h3>
            <p className="text-gray-500">
              Invite people to join your household to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Tasks Completed</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {member.user_profile?.display_name || 'Unknown User'}
                              {member.user_id === user?.id && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {member.role === 'admin' ? (
                            <Shield className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Users className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`font-medium ${
                            member.role === 'admin' ? 'text-orange-700' : 'text-gray-700'
                          }`}>
                            {member.role === 'admin' ? 'Administrator' : 'Member'}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <span className="font-medium text-gray-900">
                          {member.user_points?.total_points || 0}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <span className="text-gray-600">
                          {member.user_points?.tasks_completed || 0}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <span className="text-gray-600">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        {isAdmin && member.user_id !== user?.id && (
                          <MemberActionsDropdown member={member} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

          </>
        )}

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4 p-4">
          {members.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-50 rounded-xl p-4 border border-gray-200"
            >
              {/* Member Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {member.user_profile?.display_name || 'Unknown User'}
                    </h3>
                    {member.user_id === user?.id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions in top right */}
                {isAdmin && member.user_id !== user?.id && (
                  <MemberActionsDropdown member={member} />
                )}
              </div>

              {/* Role Badge */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  {member.role === 'admin' ? (
                    <>
                      <Shield className="w-4 h-4 text-orange-500" />
                      <span className="font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full text-sm">
                        Administrator
                      </span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-full text-sm">
                        Member
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Member Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {member.user_points?.total_points || 0}
                  </div>
                  <div className="text-xs text-gray-500">Points</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {member.user_points?.tasks_completed || 0}
                  </div>
                  <div className="text-xs text-gray-500">Tasks</div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(member.joined_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="text-xs text-gray-500">Joined</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Household;