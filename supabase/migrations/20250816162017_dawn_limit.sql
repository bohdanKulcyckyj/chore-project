/*
# Complete Household Task Management Schema

1. New Tables
   - `households` - Store household information with name, description, and invite codes
   - `household_members` - Junction table for user-household relationships with roles
   - `task_categories` - Predefined categories for organizing tasks
   - `tasks` - Core task definitions with recurrence patterns and properties
   - `task_assignments` - Track which tasks are assigned to which users
   - `task_completions` - Record task completion with proof and approval status
   - `user_points` - Track points and achievements for gamification
   - `achievements` - Define available achievements and badges
   - `user_achievements` - Track which achievements users have earned
   - `notifications` - System notifications for users

2. Security
   - Enable RLS on all tables
   - Add comprehensive policies for data access control
   - Ensure users can only access their household data

3. Features
   - Complete gamification system with points and achievements
   - Task recurrence patterns and auto-assignment
   - Approval workflow for task completions
   - Invitation system for household management
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  invite_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Household members with roles
CREATE TABLE IF NOT EXISTS household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(household_id, user_id)
);

-- Task categories
CREATE TABLE IF NOT EXISTS task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#3B82F6',
  icon text NOT NULL DEFAULT 'home'
);

-- Insert default categories
INSERT INTO task_categories (name, color, icon) VALUES
  ('Cleaning', '#EF4444', 'broom'),
  ('Cooking', '#F59E0B', 'chef-hat'),
  ('Laundry', '#8B5CF6', 'shirt'),
  ('Shopping', '#10B981', 'shopping-cart'),
  ('Maintenance', '#6B7280', 'wrench'),
  ('Garden', '#22C55E', 'flower-2'),
  ('Pets', '#F97316', 'dog'),
  ('Other', '#64748B', 'more-horizontal')
ON CONFLICT (name) DO NOTHING;

-- Tasks table with recurrence and properties
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  category_id uuid REFERENCES task_categories(id),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_duration integer DEFAULT 30, -- minutes
  points integer NOT NULL DEFAULT 50,
  requires_approval boolean DEFAULT false,
  recurrence_type text NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_pattern jsonb DEFAULT '{}', -- Store complex recurrence rules
  assignment_type text NOT NULL DEFAULT 'flexible' CHECK (assignment_type IN ('fixed', 'rotating', 'flexible')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Task assignments
CREATE TABLE IF NOT EXISTS task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date timestamptz,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'skipped')),
  UNIQUE(task_id, assigned_to, due_date)
);

-- Task completions with proof and approval
CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES task_assignments(id) ON DELETE CASCADE,
  completed_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  time_spent integer, -- minutes
  notes text DEFAULT '',
  proof_urls text[] DEFAULT '{}',
  approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approval_notes text DEFAULT '',
  points_awarded integer DEFAULT 0
);

-- User points and stats
CREATE TABLE IF NOT EXISTS user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  total_points integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  level_name text DEFAULT 'Novice',
  last_activity timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, household_id)
);

-- Achievements system
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'award',
  color text NOT NULL DEFAULT '#F59E0B',
  points_required integer DEFAULT 0,
  condition_type text NOT NULL DEFAULT 'points' CHECK (condition_type IN ('points', 'streak', 'tasks', 'category', 'custom')),
  condition_value jsonb DEFAULT '{}',
  is_repeatable boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Insert default achievements
INSERT INTO achievements (name, description, icon, color, condition_type, condition_value) VALUES
  ('First Steps', 'Complete your first task', 'star', '#10B981', 'tasks', '{"count": 1}'),
  ('Getting Started', 'Earn your first 100 points', 'trophy', '#F59E0B', 'points', '{"amount": 100}'),
  ('Streak Master', 'Maintain a 7-day streak', 'flame', '#EF4444', 'streak', '{"days": 7}'),
  ('Early Bird', 'Complete 10 morning tasks', 'sunrise', '#F97316', 'custom', '{"type": "morning_tasks", "count": 10}'),
  ('Night Owl', 'Complete 10 evening tasks', 'moon', '#8B5CF6', 'custom', '{"type": "evening_tasks", "count": 10}'),
  ('Jack of All Trades', 'Complete tasks in 5 different categories', 'layers', '#06B6D4', 'custom', '{"type": "categories", "count": 5}'),
  ('Perfectionist', 'Complete 50 tasks without rejection', 'check-circle', '#22C55E', 'custom', '{"type": "perfect_tasks", "count": 50}'),
  ('Team Player', 'Help complete 25 flexible tasks', 'users', '#3B82F6', 'custom', '{"type": "flexible_tasks", "count": 25}')
ON CONFLICT (name) DO NOTHING;

-- User achievements tracking
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES achievements(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  progress jsonb DEFAULT '{}',
  UNIQUE(user_id, achievement_id, household_id)
);

-- Notifications system
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task_due', 'task_overdue', 'task_assigned', 'task_approved', 'task_rejected', 'achievement_earned', 'household_update')),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for households
CREATE POLICY "Users can view households they are members of"
  ON households FOR SELECT TO authenticated
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create households"
  ON households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Household admins can update households"
  ON households FOR UPDATE TO authenticated
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'));

-- Security function to check household membership
CREATE OR REPLACE FUNCTION is_household_member(household_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members 
    WHERE user_id = auth.uid() 
    AND household_id = household_uuid
  );
$$;

-- RLS Policies for household_members
CREATE POLICY "Users can view household members for their households"
  ON household_members FOR SELECT TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Users can join households"
  ON household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage household members"
  ON household_members FOR ALL TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for task_categories (public read)
CREATE POLICY "Anyone can view task categories"
  ON task_categories FOR SELECT TO authenticated
  USING (true);

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks for their households"
  ON tasks FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Household admins can manage tasks"
  ON tasks FOR ALL TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for task_assignments
CREATE POLICY "Users can view assignments for their households"
  ON task_assignments FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM tasks WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())));

CREATE POLICY "Users can update their own assignments"
  ON task_assignments FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Admins can manage all assignments"
  ON task_assignments FOR ALL TO authenticated
  USING (task_id IN (SELECT id FROM tasks WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin')));

-- RLS Policies for task_completions
CREATE POLICY "Users can view completions for their households"
  ON task_completions FOR SELECT TO authenticated
  USING (assignment_id IN (SELECT id FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()))));

CREATE POLICY "Users can create completions for their assignments"
  ON task_completions FOR INSERT TO authenticated
  WITH CHECK (completed_by = auth.uid());

CREATE POLICY "Users can update their own completions"
  ON task_completions FOR UPDATE TO authenticated
  USING (completed_by = auth.uid());

CREATE POLICY "Admins can approve/reject completions"
  ON task_completions FOR UPDATE TO authenticated
  USING (assignment_id IN (SELECT id FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'))));

-- RLS Policies for user_points
CREATE POLICY "Users can view points for their households"
  ON user_points FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own points"
  ON user_points FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for achievements (public read)
CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT TO authenticated
  USING (true);

-- RLS Policies for user_achievements
CREATE POLICY "Users can view achievements for their households"
  ON user_achievements FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can earn achievements"
  ON user_achievements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_tasks_household_id ON tasks(household_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_due_date ON task_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_task_completions_completed_by ON task_completions(completed_by);
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_household_id ON user_points(household_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);