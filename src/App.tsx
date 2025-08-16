import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { HouseholdProvider, useHousehold } from './hooks/useHousehold';
import AuthForm from './components/auth/AuthForm';
import HouseholdManager from './components/household/HouseholdManager';
import Dashboard from './components/dashboard/Dashboard';
import Sidebar from './components/layout/Sidebar';

const AppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentHousehold, loading: householdLoading } = useHousehold();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [activeTab, setActiveTab] = useState('dashboard');

  if (authLoading || householdLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg font-medium text-gray-700">Loading...</span>
        </div>
      </div>
    );
  }

  // Show auth form if not logged in
  if (!user) {
    return <AuthForm mode={authMode} onModeChange={setAuthMode} />;
  }

  // Show household manager if no household selected
  if (!currentHousehold) {
    return <HouseholdManager />;
  }

  // Show main app with sidebar
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 ml-70">
        <main className="min-h-screen">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'tasks' && (
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
              <p className="text-gray-600 mt-2">Task management coming soon...</p>
            </div>
          )}
          {activeTab === 'calendar' && (
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
              <p className="text-gray-600 mt-2">Calendar view coming soon...</p>
            </div>
          )}
          {activeTab === 'leaderboard' && (
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
              <p className="text-gray-600 mt-2">Leaderboard view coming soon...</p>
            </div>
          )}
          {activeTab === 'household' && (
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Household Settings</h1>
              <p className="text-gray-600 mt-2">Household management coming soon...</p>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600 mt-2">Settings coming soon...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <Router>
          <AppContent />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
                borderRadius: '12px',
              },
            }}
          />
        </Router>
      </HouseholdProvider>
    </AuthProvider>
  );
};

export default App;