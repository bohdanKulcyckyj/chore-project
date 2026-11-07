import React from 'react';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  redirect,
  Outlet,
  useRouteError,
  type ActionFunction,
  type LoaderFunction,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router-dom';
import { supabase } from './lib/supabase';
import { requireUser } from './lib/api/session';
import AuthForm from './components/auth/AuthForm';
import HouseholdManager from './components/household/HouseholdManager';
import HouseholdLayout, { Loading } from './components/layout/HouseholdLayout';

/**
 * A page route. `lazy` pulls the component plus an optional `loader`/`action`
 * out of the page module, so adding either means editing that page only —
 * never this file.
 */
const page = (
  path: string,
  importer: () => Promise<{
    default: React.ComponentType;
    loader?: LoaderFunction;
    action?: ActionFunction;
  }>,
): RouteObject => ({
  path,
  lazy: async () => {
    const { default: Component, loader, action } = await importer();
    return { Component, ...(loader ? { loader } : {}), ...(action ? { action } : {}) };
  },
});

const firstHouseholdId = async (userId: string) => {
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1);
  return data?.[0]?.household_id;
};

/** `/` — the only place that decides where a bare visit lands. */
const rootLoader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return redirect('/auth');
  const householdId = await firstHouseholdId(session.user.id);
  return redirect(householdId ? `/h/${householdId}/dashboard` : '/households');
};

const authLoader = async ({ request }: LoaderFunctionArgs) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  // Already signed in. Keep an invite in hand instead of dropping it on the floor.
  const invite = new URL(request.url).searchParams.get('invite');
  return redirect(invite ? `/households?invite=${encodeURIComponent(invite)}` : '/');
};

/** Every other screen is behind a loader; this one was the only way in unauthenticated. */
const householdsLoader = async () => {
  await requireUser();
  return null;
};

/** Share link. */
const inviteLoader = async ({ params }: LoaderFunctionArgs) => {
  const invite = encodeURIComponent(params.inviteCode!);
  const { data: { session } } = await supabase.auth.getSession();
  return redirect(session ? `/households?invite=${invite}` : `/auth?invite=${invite}`);
};

// ponytail: placeholders stay inline elements — no module, no component, no
// loader, nothing to lazy-load. Give them a page module when they get content.
const comingSoon = (title: string, note: string) => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    <p className="text-gray-600 mt-2">{note}</p>
  </div>
);

/**
 * Loaders and actions refuse by throwing a Response (the approvals route throws
 * 403 for a non-admin), so show that message instead of a blank "went wrong" —
 * otherwise a non-admin deep-linking to /approvals cannot tell a permission
 * problem from a crash.
 */
// This module exports a router, not components; Fast Refresh has nothing to preserve.
// eslint-disable-next-line react-refresh/only-export-components
const RouteError: React.FC = () => {
  const error = useRouteError();
  const refused = isRouteErrorResponse(error);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {refused ? (error.data || error.statusText) : 'Something went wrong'}
        </h1>
        <p className="text-gray-600 mt-2">
          <a href="/" className="text-blue-500 hover:text-blue-600 font-semibold">Back to the dashboard</a>
        </p>
      </div>
    </div>
  );
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Outlet />,
    // Rendered while the matched loaders / lazy modules resolve on a cold load.
    hydrateFallbackElement: <Loading />,
    errorElement: <RouteError />,
    children: [
      // Both of these only ever redirect; the element is what React Router
      // wants so it does not warn about an element-less leaf route.
      { index: true, loader: rootLoader, element: <Loading /> },
      { path: 'auth', element: <AuthForm />, loader: authLoader },
      { path: 'households', element: <HouseholdManager />, loader: householdsLoader },
      { path: 'invite/:inviteCode', loader: inviteLoader, element: <Loading /> },
      {
        path: 'h/:householdId',
        element: <HouseholdLayout />,
        children: [
          { index: true, element: <Loading />, loader: ({ params }: LoaderFunctionArgs) => redirect(`/h/${params.householdId}/dashboard`) },
          page('dashboard', () => import('./components/dashboard/Dashboard')),
          page('tasks', () => import('./components/tasks/TaskManagement')),
          page('calendar', () => import('./components/calendar/Calendar')),
          page('budget', () => import('./components/budget/Budget')),
          page('household', () => import('./components/household/Household')),
          page('approvals', () => import('./components/approvals/Approvals')),
          { path: 'leaderboard', element: comingSoon('Leaderboard', 'Leaderboard view coming soon...') },
          { path: 'settings', element: comingSoon('Settings', 'Settings coming soon...') },
        ],
      },
    ],
  },
]);
