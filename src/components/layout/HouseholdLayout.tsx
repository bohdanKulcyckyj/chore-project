import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import Sidebar from './Sidebar';

export const Loading: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-lg font-medium text-gray-700">Loading...</span>
    </div>
  </div>
);

const HouseholdLayout: React.FC = () => {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    currentHousehold,
    households,
    loading: householdLoading,
    switchHousehold,
  } = useHousehold();
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

  // Keep the household context in step with the URL. The URL is the source of
  // truth; an id that is not one of the user's memberships goes back to the
  // root loader, which picks a valid one.
  // ponytail: this lives in an effect, not a loader — switchHousehold is React
  // state and loaders run outside React. Move it into the layout loader only if
  // the contexts ever get collapsed into the router.
  useEffect(() => {
    if (authLoading || householdLoading || !householdId) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (currentHousehold?.id === householdId) return;
    if (households.some(h => h.id === householdId)) {
      switchHousehold(householdId);
    } else {
      navigate('/', { replace: true });
    }
  }, [
    authLoading,
    householdLoading,
    user,
    householdId,
    currentHousehold,
    households,
    switchHousehold,
    navigate,
  ]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Pages read the household off the context, so don't mount them until the
  // context agrees with the URL.
  if (authLoading || householdLoading || currentHousehold?.id !== householdId) {
    return <Loading />;
  }

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
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isMobile={isMobile}
      />

      {/* Main Content */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${
        !isMobile && sidebarOpen ? 'ml-70' : 'ml-0'
      }`}>
        {/* Mobile Header with Hamburger */}
        {isMobile && (
          <div className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm p-4 flex items-center justify-between md:hidden">
            <div className="w-10" /> {/* Spacer for centering */}
            <h1 className="font-bold text-gray-900">ChoreQuest</h1>
            {/* ponytail: toggle sits right — thumb reach; drawer still slides from the left */}
            <button
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>
        )}

        <main className={`min-h-screen ${isMobile ? 'pt-20' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default HouseholdLayout;
