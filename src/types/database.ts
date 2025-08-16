export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          description: string;
          invite_code: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          invite_code?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          invite_code?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: 'admin' | 'member';
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: 'admin' | 'member';
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: 'admin' | 'member';
          joined_at?: string;
        };
      };
      task_categories: {
        Row: {
          id: string;
          name: string;
          color: string;
          icon: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          icon?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          icon?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          description: string;
          category_id: string | null;
          difficulty: 'easy' | 'medium' | 'hard';
          estimated_duration: number;
          points: number;
          requires_approval: boolean;
          recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
          recurrence_pattern: Record<string, any>;
          assignment_type: 'fixed' | 'rotating' | 'flexible';
          created_by: string | null;
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          description?: string;
          category_id?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          estimated_duration?: number;
          points?: number;
          requires_approval?: boolean;
          recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
          recurrence_pattern?: Record<string, any>;
          assignment_type?: 'fixed' | 'rotating' | 'flexible';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          description?: string;
          category_id?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          estimated_duration?: number;
          points?: number;
          requires_approval?: boolean;
          recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
          recurrence_pattern?: Record<string, any>;
          assignment_type?: 'fixed' | 'rotating' | 'flexible';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
      };
      task_assignments: {
        Row: {
          id: string;
          task_id: string;
          assigned_to: string;
          due_date: string | null;
          assigned_at: string;
          assigned_by: string | null;
          status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped';
        };
        Insert: {
          id?: string;
          task_id: string;
          assigned_to: string;
          due_date?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped';
        };
        Update: {
          id?: string;
          task_id?: string;
          assigned_to?: string;
          due_date?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped';
        };
      };
      task_completions: {
        Row: {
          id: string;
          assignment_id: string;
          completed_by: string;
          completed_at: string;
          time_spent: number | null;
          notes: string;
          proof_urls: string[];
          approval_status: 'pending' | 'approved' | 'rejected';
          approved_by: string | null;
          approved_at: string | null;
          approval_notes: string;
          points_awarded: number;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          completed_by: string;
          completed_at?: string;
          time_spent?: number | null;
          notes?: string;
          proof_urls?: string[];
          approval_status?: 'pending' | 'approved' | 'rejected';
          approved_by?: string | null;
          approved_at?: string | null;
          approval_notes?: string;
          points_awarded?: number;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          completed_by?: string;
          completed_at?: string;
          time_spent?: number | null;
          notes?: string;
          proof_urls?: string[];
          approval_status?: 'pending' | 'approved' | 'rejected';
          approved_by?: string | null;
          approved_at?: string | null;
          approval_notes?: string;
          points_awarded?: number;
        };
      };
      user_points: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          total_points: number;
          current_streak: number;
          longest_streak: number;
          tasks_completed: number;
          level_name: string;
          last_activity: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          total_points?: number;
          current_streak?: number;
          longest_streak?: number;
          tasks_completed?: number;
          level_name?: string;
          last_activity?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          household_id?: string;
          total_points?: number;
          current_streak?: number;
          longest_streak?: number;
          tasks_completed?: number;
          level_name?: string;
          last_activity?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      achievements: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          color: string;
          points_required: number;
          condition_type: 'points' | 'streak' | 'tasks' | 'category' | 'custom';
          condition_value: Record<string, any>;
          is_repeatable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          icon?: string;
          color?: string;
          points_required?: number;
          condition_type?: 'points' | 'streak' | 'tasks' | 'category' | 'custom';
          condition_value?: Record<string, any>;
          is_repeatable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          icon?: string;
          color?: string;
          points_required?: number;
          condition_type?: 'points' | 'streak' | 'tasks' | 'category' | 'custom';
          condition_value?: Record<string, any>;
          is_repeatable?: boolean;
          created_at?: string;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          household_id: string;
          earned_at: string;
          progress: Record<string, any>;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          household_id: string;
          earned_at?: string;
          progress?: Record<string, any>;
        };
        Update: {
          id?: string;
          user_id?: string;
          achievement_id?: string;
          household_id?: string;
          earned_at?: string;
          progress?: Record<string, any>;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          type: 'task_due' | 'task_overdue' | 'task_assigned' | 'task_approved' | 'task_rejected' | 'achievement_earned' | 'household_update';
          title: string;
          message: string;
          data: Record<string, any>;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          type: 'task_due' | 'task_overdue' | 'task_assigned' | 'task_approved' | 'task_rejected' | 'achievement_earned' | 'household_update';
          title: string;
          message: string;
          data?: Record<string, any>;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          household_id?: string;
          type?: 'task_due' | 'task_overdue' | 'task_assigned' | 'task_approved' | 'task_rejected' | 'achievement_earned' | 'household_update';
          title?: string;
          message?: string;
          data?: Record<string, any>;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}