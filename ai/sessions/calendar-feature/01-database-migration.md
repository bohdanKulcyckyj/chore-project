# Calendar Database Migration Implementation

**Date:** 2025-08-23  
**Session:** 01  
**Parent:** `calendar-plan.md`  
**Focus:** Database schema changes for datetime support

## Objective

Migrate the task assignment system from date-only (`due_date`) to datetime (`due_datetime`) to support time-specific task scheduling for the calendar view.

## Current Schema Analysis

**Current Field:**
```sql
task_assignments.due_date: DATE (nullable)
```

**Required Field:**
```sql  
task_assignments.due_datetime: TIMESTAMPTZ (nullable)
```

## Migration Strategy

### Step 1: Add New Column
```sql
ALTER TABLE task_assignments 
ADD COLUMN due_datetime TIMESTAMPTZ;
```

### Step 2: Data Migration
```sql
-- Convert existing dates to datetime (midnight)
UPDATE task_assignments 
SET due_datetime = due_date::date + TIME '00:00:00'
WHERE due_date IS NOT NULL;
```

### Step 3: Update TypeScript Types
Update `src/types/database.ts`:
```typescript
task_assignments: {
  Row: {
    id: string;
    task_id: string;
    assigned_to: string;
    due_date?: string | null;      // Legacy - will be removed
    due_datetime: string | null;   // New datetime field
    assigned_at: string;
    assigned_by: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped';
  };
  Insert: {
    // ... similar updates
    due_datetime?: string | null;
  };
  Update: {
    // ... similar updates  
    due_datetime?: string | null;
  };
}
```

### Step 4: Update Application Code
- Update all queries to use `due_datetime` instead of `due_date`
- Update forms and components to handle datetime input
- Maintain backwards compatibility during transition

### Step 5: Remove Old Column (Future)
```sql
-- After confirming all code uses due_datetime
ALTER TABLE task_assignments DROP COLUMN due_date;
```

## Implementation Tasks

- [ ] Create Supabase migration file
- [ ] Test migration on development database
- [ ] Update TypeScript types
- [ ] Update existing queries in codebase
- [ ] Test backwards compatibility
- [ ] Deploy migration to production

## Files to Modify

1. `supabase/migrations/` - New migration file
2. `src/types/database.ts` - Type definitions
3. `src/hooks/useHousehold.tsx` - Task queries
4. `src/components/tasks/` - Task-related components
5. Any other files querying task_assignments

## Testing Strategy

1. **Unit Tests**: Verify datetime formatting utilities
2. **Integration Tests**: Test task assignment queries
3. **Manual Testing**: Create tasks with specific times
4. **Data Integrity**: Ensure no data loss during migration

## Rollback Plan

If issues occur:
1. Revert to using `due_date` column
2. Drop `due_datetime` column if needed
3. Restore from database backup if data corruption

---

**Status:** Ready for implementation  
**Next:** `02-hooks-implementation.md`