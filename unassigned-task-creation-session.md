# Unassigned Task Creation Feature - Planning Session

## Overview
This session outlines the changes needed to allow task creation without an assigned member. Currently, the system requires every task to have an assigned member, but we want to support creating tasks that can be picked up later by any household member.

## Current State Analysis

### Database Schema
- **tasks table**: Already supports unassigned tasks (no assigned_to field in tasks table)
- **task_assignments table**: Separate table that links tasks to users with `assigned_to` field
- **Current flow**: Task → Task Assignment (required)

### Frontend Validation
- **Location**: `src/components/tasks/AddTaskModal.tsx:103`
- **Current rule**: `if (!formData.assigned_to) return 'Please assign the task to someone';`
- **Impact**: Prevents form submission without assignment

### Task Creation Logic
- **Location**: `src/components/tasks/AddTaskModal.tsx:157-167`
- **Current flow**:
  1. Create task in `tasks` table
  2. Create assignment in `task_assignments` table (will fail if no assigned_to)
- **Problem**: Assignment creation is not conditional

## Required Changes

### 1. Frontend Form Updates
**File**: `src/components/tasks/AddTaskModal.tsx`

#### Form Data Interface
- Make `assigned_to` field optional in FormData interface
- Update initial state to handle empty assignment

#### Validation Logic
- Remove or modify validation that requires `assigned_to`
- Keep validation for other required fields
- Add logic to handle "Unassigned" option

#### UI Components
- Add "Leave Unassigned" or "Anyone" option to assignment dropdown
- Update form styling to indicate optional assignment
- Consider adding visual indicator for unassigned tasks

#### Task Creation Logic
- Make task assignment creation conditional
- Only create assignment record if a member is selected
- Handle success flow for both assigned and unassigned tasks

### 2. Task Display Updates
**Files to investigate and potentially update**:
- `src/components/tasks/TaskManagement.tsx`
- Any task list/grid components
- Task card components

#### Display Logic
- Show "Unassigned" or "Available" status for tasks without assignments
- Update task filtering/sorting to handle unassigned tasks
- Consider special styling for unassigned tasks

#### Assignment Actions
- Add "Assign to me" button for unassigned tasks
- Allow household members to claim unassigned tasks
- Update task status when assignment is added

### 3. Database Query Updates
**Files to investigate**:
- Any components that fetch tasks with joins to assignments
- Task listing queries that assume assignments exist

#### Query Modifications
- Update joins to use LEFT JOIN instead of INNER JOIN
- Handle null assignment data in result processing
- Update filtering logic for task status

### 4. Task Assignment Flow
**New functionality needed**:
- API endpoint for claiming unassigned tasks
- Frontend logic for task claiming
- Notifications for task claiming (optional)

### 5. Business Logic Considerations

#### Task States
- **Unassigned**: Task exists but no one is assigned
- **Assigned**: Task has an assigned member
- **In Progress**: Assigned member has started work
- **Completed**: Task is done

#### Assignment Rules
- Any household member can claim unassigned tasks
- Only admins or task creators can reassign tasks
- Claiming a task creates a new assignment record

#### Points and Gamification
- Unassigned tasks still have point values
- Points awarded when task is completed, regardless of initial assignment
- Consider bonus points for claiming unassigned tasks

### 6. Testing Considerations
- Test task creation with and without assignment
- Test task claiming flow
- Test task display in various states
- Test filtering and sorting with mixed assigned/unassigned tasks
- Test permissions (who can claim, reassign, etc.)

## Implementation Priority

### Phase 1: Core Functionality
1. Update AddTaskModal to allow unassigned task creation
2. Update task creation API logic
3. Update task display to show unassigned status

### Phase 2: Task Claiming
1. Add claim task functionality
2. Update task listing with claim buttons
3. Add assignment creation for claimed tasks

### Phase 3: Polish
1. Update filtering and sorting
2. Add notifications for task claiming
3. Improve UI/UX for unassigned task flow

## Potential Issues & Solutions

### Issue: Existing code assumes assignments exist
**Solution**: Use LEFT JOINs and null-safe operations

### Issue: Task completion flow expects assignments
**Solution**: Create assignment when unassigned task is claimed

### Issue: Permission checks based on assignment
**Solution**: Update permission logic to handle unassigned tasks

### Issue: Notifications assume assigned users
**Solution**: Skip assignment notifications for unassigned tasks

## Files to Modify

### Confirmed Files
1. `src/components/tasks/AddTaskModal.tsx` - Primary changes
2. `src/components/tasks/TaskManagement.tsx` - Display updates
3. Any task listing/grid components - Display and claiming logic

### Files to Investigate
1. Task fetching hooks/utilities
2. Task status management components
3. Permission checking utilities
4. Notification systems
5. Points/gamification logic

## Success Criteria
- [x] Can create tasks without assigning to anyone
- [x] Unassigned tasks display clearly in task lists
- [x] Household members can claim unassigned tasks
- [x] Task completion works for both assigned and unassigned tasks
- [x] No breaking changes to existing assigned task functionality
- [x] Proper error handling for edge cases

## ✅ IMPLEMENTATION COMPLETED

### What Was Actually Implemented

#### 1. AddTaskModal Changes (src/components/tasks/AddTaskModal.tsx)
- **Validation**: Removed requirement for `assigned_to` field validation
- **UI**: Changed dropdown to show "🔄 Leave Unassigned (Anyone can claim)" as default option
- **Logic**: Made task assignment creation conditional - only creates assignment if someone is selected
- **Form**: Removed asterisk (*) from "Assign To" label to indicate it's optional

#### 2. TaskManagement Data Flow (src/components/tasks/TaskManagement.tsx)
- **Data Structure**: Created new `TaskWithAssignment` type to handle both assigned and unassigned tasks
- **Fetching Logic**: Completely rewrote `fetchTasks()` to:
  1. Fetch all tasks for household
  2. Fetch all assignments separately
  3. Merge data to create unified task list
  4. Add unassigned tasks with `status: 'unassigned'`
- **Statistics**: Updated dashboard to show separate "Unassigned" count with purple styling
- **Sorting**: Unassigned tasks sorted to end (no due date handling)

#### 3. TaskTable Display & Actions (src/components/tasks/TaskTable.tsx)
- **Status Handling**: Added 'unassigned' status with purple color scheme and UserPlus icon
- **Claiming**: Implemented `handleClaimTask()` function that:
  - Creates task assignment when user claims task
  - Sets default due date to 7 days from now
  - Shows loading state during claiming
  - Refreshes task list after successful claim
- **UI Updates**:
  - Desktop: Added "Actions" column with "Claim Task" button
  - Mobile: Added claim button to card layout
  - Assignment display shows "Available" for unassigned tasks
- **Filtering**: Updated filter logic to handle "Available" option for unassigned tasks
- **Bug Fix**: Moved `getFieldValue` function before `useMemo` to fix hoisting error

#### 4. Visual Design
- **Color Scheme**: Used purple (#8B5CF6) for unassigned task elements
- **Icons**: UserPlus icon for unassigned status and claim actions
- **Labels**: Consistent "Available" labeling for unassigned tasks across all views
- **Loading States**: Spinner animation during task claiming

#### 5. Data Flow
```
Create Task → Check if assigned_to exists → 
  If YES: Create task + assignment
  If NO: Create task only (shows as unassigned)

View Tasks → Fetch tasks + assignments → Merge data → 
  Show assigned tasks with user info
  Show unassigned tasks as "Available"

Claim Task → Create assignment → Refresh list → 
  Task moves from unassigned to assigned status
```

### Technical Details Implemented

#### Task Assignment Creation (when claiming)
- `task_id`: Extracted from unassigned task ID
- `assigned_to`: Current user ID
- `due_date`: 7 days from now (default)
- `assigned_by`: Current user ID (self-assignment)
- `status`: 'pending'

#### Error Handling
- Fixed function hoisting issue that caused runtime error
- Added loading states for claiming operations
- Toast notifications for success/failure
- Graceful handling of missing user profiles

### Verification Results
- ✅ Can create tasks without assignment
- ✅ Unassigned tasks appear as "Available" with purple styling
- ✅ Claim buttons work in both desktop and mobile views
- ✅ Claiming creates proper assignment and updates display
- ✅ Filtering works with "Available" option
- ✅ Statistics dashboard shows unassigned count
- ✅ No breaking changes to existing functionality

## Future Enhancements (Not Implemented)
- Auto-assignment rules (round-robin)
- Household-level configuration
- Time-based unassignment
- Bonus points for claiming tasks
- Notifications for task claiming