drop extension if exists "pg_net";

drop policy "Admins can manage household members" on "public"."household_members";

drop policy "Users can join households" on "public"."household_members";

drop policy "Users can view household members for their households" on "public"."household_members";

drop policy "Users can view household member profiles" on "public"."user_profiles";

drop policy "Users can view their own profile" on "public"."user_profiles";

drop function if exists "public"."is_household_member"(household_uuid uuid);


  create policy "Users can create their own membership"
  on "public"."household_members"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "Users can delete their own membership"
  on "public"."household_members"
  as permissive
  for delete
  to authenticated
using ((user_id = auth.uid()));



  create policy "Users can update their own membership"
  on "public"."household_members"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()));



  create policy "Users can view all household memberships that they are part of"
  on "public"."household_members"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Allow reading household by invite code"
  on "public"."households"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can create assignments for their household tasks"
  on "public"."task_assignments"
  as permissive
  for insert
  to public
with check (((assigned_to = auth.uid()) AND (task_id IN ( SELECT tasks.id
   FROM tasks
  WHERE (tasks.household_id IN ( SELECT household_members.household_id
           FROM household_members
          WHERE (household_members.user_id = auth.uid())))))));



  create policy "Household members can view each other"
  on "public"."user_profiles"
  as permissive
  for select
  to authenticated
using ((id IN ( SELECT hm1.user_id
   FROM household_members hm1
  WHERE (hm1.household_id IN ( SELECT hm2.household_id
           FROM household_members hm2
          WHERE (hm2.user_id = auth.uid()))))));



  create policy "Users can view own profile"
  on "public"."user_profiles"
  as permissive
  for select
  to authenticated
using ((id = auth.uid()));



