import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, Tables } from '../lib/supabase';
import { useAuth } from './useAuth';

type Household = Tables<'households'>;
type HouseholdMember = Tables<'household_members'> & {
  user_profile?: Tables<'user_profiles'>;
};

interface HouseholdContextType {
  currentHousehold: Household | null;
  households: Household[];
  members: HouseholdMember[];
  isAdmin: boolean;
  loading: boolean;
  createHousehold: (name: string, description?: string) => Promise<any>;
  joinHousehold: (inviteCode: string) => Promise<any>;
  switchHousehold: (householdId: string) => void;
  leaveHousehold: () => Promise<any>;
  refreshData: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};

interface HouseholdProviderProps {
  children: ReactNode;
}

export const HouseholdProvider = ({ children }: HouseholdProviderProps) => {
  const { user } = useAuth();
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = members.some(member => 
    member.user_id === user?.id && member.role === 'admin'
  );

  const fetchHouseholds = async () => {
    if (!user) return;
    
    try {
      const { data: householdMembers, error } = await supabase
        .from('household_members')
        .select(`
          household_id,
          households (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const householdList = householdMembers
        ?.map(hm => hm.households)
        .filter(Boolean) as Household[];

      setHouseholds(householdList || []);
      
      // Set first household as current if none selected
      if (householdList.length > 0 && !currentHousehold) {
        setCurrentHousehold(householdList[0]);
      }
    } catch (error) {
      console.error('Error fetching households:', error);
    }
  };

  const fetchMembers = async () => {
    if (!currentHousehold) return;

    try {
      // Fetch household members
      const { data: membersData, error: membersError } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', currentHousehold.id);

      if (membersError) throw membersError;

      // Fetch user profiles for these members
      const userIds = membersData?.map(m => m.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const membersWithProfiles = membersData?.map(member => ({
        ...member,
        user_profile: profilesData?.find(profile => profile.id === member.user_id)
      })) || [];

      setMembers(membersWithProfiles as HouseholdMember[]);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await Promise.all([fetchHouseholds(), fetchMembers()]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      refreshData();
    } else {
      setCurrentHousehold(null);
      setHouseholds([]);
      setMembers([]);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMembers();
  }, [currentHousehold]);

  const createHousehold = async (name: string, description = '') => {
    console.log('User object:', user);
    console.log('User ID:', user?.id);
    
    // Check current session
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Current session:', session);
    console.log('Session user ID:', session?.user?.id);
    
    if (!user) return { error: { message: 'Not authenticated' } };

    try {
      // Create household
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name,
          description,
        })
        .select()
        .single();
        
      console.log('Household creation result:', { household, error: householdError });

      if (householdError) throw householdError;

      // Add creator as admin
      const { error: memberError } = await supabase
        .from('household_members')
        .insert({
          household_id: household.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      // Initialize user points
      const { error: pointsError } = await supabase
        .from('user_points')
        .insert({
          user_id: user.id,
          household_id: household.id,
        });

      if (pointsError) throw pointsError;

      await refreshData();
      setCurrentHousehold(household);

      return { data: household, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const joinHousehold = async (inviteCode: string) => {
    if (!user) return { error: { message: 'Not authenticated' } };

    try {
      // Find household by invite code
      const { data: household, error: findError } = await supabase
        .from('households')
        .select()
        .eq('invite_code', inviteCode.trim())
        .single();

      if (findError) throw findError;

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('household_members')
        .select()
        .eq('household_id', household.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        return { error: { message: 'Already a member of this household' } };
      }

      // Add as member
      const { error: memberError } = await supabase
        .from('household_members')
        .insert({
          household_id: household.id,
          user_id: user.id,
          role: 'member',
        });

      if (memberError) throw memberError;

      // Initialize user points
      const { error: pointsError } = await supabase
        .from('user_points')
        .insert({
          user_id: user.id,
          household_id: household.id,
        });

      if (pointsError) throw pointsError;

      await refreshData();
      setCurrentHousehold(household);

      return { data: household, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const switchHousehold = (householdId: string) => {
    const household = households.find(h => h.id === householdId);
    if (household) {
      setCurrentHousehold(household);
    }
  };

  const leaveHousehold = async () => {
    if (!user || !currentHousehold) return { error: { message: 'Invalid state' } };

    try {
      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', currentHousehold.id)
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshData();
      const remainingHouseholds = households.filter(h => h.id !== currentHousehold.id);
      setCurrentHousehold(remainingHouseholds.length > 0 ? remainingHouseholds[0] : null);

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const value = {
    currentHousehold,
    households,
    members,
    isAdmin,
    loading,
    createHousehold,
    joinHousehold,
    switchHousehold,
    leaveHousehold,
    refreshData,
  };

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
};