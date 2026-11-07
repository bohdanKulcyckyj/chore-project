import { redirect } from 'react-router-dom';
import { supabase } from '../supabase';

/**
 * Loaders run outside React, so they cannot read AuthProvider. They ask the
 * Supabase client singleton instead — it holds the same session the provider
 * subscribes to. Throws a redirect, so a loader can just `await requireUser()`.
 */
export async function requireUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect('/auth');
  return session.user;
}
