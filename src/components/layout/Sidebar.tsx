import React from 'react';
import { motion } from 'framer-motion';
import { 
  Home, 
  CheckSquare, 
  Calendar, 
  Trophy, 
  Users, 
  Settings,
  LogOut,
  Star
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { signOut } = useAuth();
  const { currentHousehold } = useHousehold();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, color: 'text-blue-500' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'text-emerald-500' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, color: 'text-purple-500' },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, color: 'text-yellow-500' },
    { id: 'household', label: 'Household', icon: Users, color: 'text-pink-500' },
  ];

  const bottomMenuItems = [
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-gray-500' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      className="fixed left-0 top-0 h-full w-70 bg-white shadow-lg z-40 flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <Home className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">ChoreQuest</h2>
            <p className="text-sm text-gray-500 truncate">
              {currentHousehold?.name || 'No household'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-6">
        <nav className="px-4 space-y-2">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ x: 4 }}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                activeTab === item.id
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon 
                className={`w-5 h-5 ${activeTab === item.id ? 'text-blue-500' : item.color}`} 
              />
              <span className="font-medium">{item.label}</span>
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTab"
                  className="ml-auto w-2 h-2 bg-blue-500 rounded-full"
                />
              )}
            </motion.button>
          ))}
        </nav>

        {/* Quick Stats */}
        <div className="mx-4 mt-8 p-4 bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700">Your Level</span>
          </div>
          <p className="text-lg font-bold text-gray-900">Novice</p>
          <p className="text-sm text-gray-500">Keep going! 🚀</p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        {bottomMenuItems.map((item) => (
          <motion.button
            key={item.id}
            whileHover={{ x: 4 }}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
              activeTab === item.id
                ? 'bg-blue-50 text-blue-600 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <item.icon className={`w-5 h-5 ${item.color}`} />
            <span className="font-medium">{item.label}</span>
          </motion.button>
        ))}

        <motion.button
          whileHover={{ x: 4 }}
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Sidebar;