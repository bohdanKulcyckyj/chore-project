import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, User, MoreVertical, UserCheck, UserX } from 'lucide-react';
import { supabase, Tables } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import toast from 'react-hot-toast';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type HouseholdMemberWithProfile = Tables<'household_members'> & {
  user_profile?: Tables<'user_profiles'>;
  user_points?: Tables<'user_points'>;
};

interface HouseholdMemberManagementProps {
  onMemberUpdate?: () => void;
}

const HouseholdMemberManagement: React.FC<HouseholdMemberManagementProps> = ({ 
  onMemberUpdate 
}) => {
  const { user } = useAuth();
  const { currentHousehold, isAdmin } = useHousehold();
  const [members, setMembers] = useState<HouseholdMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!currentHousehold || !isAdmin) return;

    try {
      setLoading(true);

      // Fetch household members
      const { data: membersData, error: membersError } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', currentHousehold.id);

      if (membersError) throw membersError;

      if (!membersData || membersData.length === 0) {
        setMembers([]);
        return;
      }

      // Fetch user profiles for these members
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch user points for each member
      const { data: pointsData, error: pointsError } = await supabase
        .from('user_points')
        .select('*')
        .in('user_id', userIds)
        .eq('household_id', currentHousehold.id);

      if (pointsError) throw pointsError;

      // Combine the data
      const membersWithPoints = membersData.map(member => ({
        ...member,
        user_profile: profilesData?.find(p => p.id === member.user_id),
        user_points: pointsData?.find(p => p.user_id === member.user_id)
      }));

      setMembers(membersWithPoints);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load household members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [currentHousehold, isAdmin]);

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
      await fetchMembers();
      onMemberUpdate?.();
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
      await fetchMembers();
      onMemberUpdate?.();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setUpdatingMemberId(null);
    }
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
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          Household Members
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage member roles and permissions
        </p>
      </div>

      <div className="space-y-3">
        {members.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">
                    {member.user_profile?.display_name || 'Unknown User'}
                  </h3>
                  {member.user_id === user?.id && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      You
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    {member.role === 'admin' ? (
                      <Shield className="w-4 h-4 text-orange-500" />
                    ) : (
                      <User className="w-4 h-4 text-gray-400" />
                    )}
                    {member.role === 'admin' ? 'Administrator' : 'Member'}
                  </span>
                  
                  {member.user_points && (
                    <span>
                      {member.user_points.total_points} points • {member.user_points.tasks_completed} tasks
                    </span>
                  )}
                </div>
              </div>
            </div>

            {member.user_id !== user?.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={updatingMemberId === member.id}
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
                      <User className="mr-2 h-4 w-4" />
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
            )}
          </motion.div>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No members found
          </h3>
          <p className="text-gray-500">
            Invite people to join your household to get started.
          </p>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="text-sm font-medium text-blue-800 mb-1">
          Household Invite Code
        </h3>
        <div className="flex items-center justify-between">
          <code className="text-lg font-mono text-blue-700 bg-white px-3 py-1 rounded border">
            {currentHousehold?.invite_code}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(currentHousehold?.invite_code || '');
              toast.success('Invite code copied to clipboard!');
            }}
          >
            Copy Code
          </Button>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Share this code with family members to let them join your household
        </p>
      </div>
    </motion.div>
  );
};

export default HouseholdMemberManagement;