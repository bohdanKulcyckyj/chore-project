import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { HouseholdProvider, useHousehold } from './hooks/useHousehold';
import AuthForm from './components/auth/AuthForm';
import HouseholdManager from './components/household/HouseholdManager';
import Dashboard from './components/dashboard/Dashboard';
import TaskManagement from './components/tasks/TaskManagement';
import Household from './components/household/Household';
import Approvals from './components/approvals/Approvals';
import Sidebar from './components/layout/Sidebar';

const AppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentHousehold, loading: householdLoading } = useHousehold();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true); // Auto-open on desktop
      } else {
        setSidebarOpen(false); // Auto-close on mobile
      }
    };
    
    handleResize(); // Check initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

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
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}
      
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          closeSidebar();
        }}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isMobile={isMobile}
      />
      
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${
        !isMobile && sidebarOpen ? 'ml-70' : 'ml-0'
      }`}>
        {/* Mobile Header with Hamburger */}
        {isMobile && (
          <div className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm p-4 flex items-center justify-between md:hidden">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
            <h1 className="font-bold text-gray-900">ChoreQuest</h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        )}
        
        <main className={`min-h-screen ${isMobile ? 'pt-20' : ''}`}>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'tasks' && <TaskManagement />}
          {activeTab === 'approvals' && <Approvals />}
          {activeTab === 'household' && <Household />}
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