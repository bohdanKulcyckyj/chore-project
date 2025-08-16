import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Trophy, Users, CheckSquare, Clock } from 'lucide-react';

const QuickActions: React.FC = () => {
  const actions = [
    {
      title: 'Complete Task',
      description: 'Mark a task as done',
      icon: <CheckSquare className="w-5 h-5" />,
      color: 'from-green-500 to-emerald-500',
      onClick: () => console.log('Complete task'),
    },
    {
      title: 'View Calendar',
      description: 'See upcoming tasks',
      icon: <Calendar className="w-5 h-5" />,
      color: 'from-blue-500 to-indigo-500',
      onClick: () => console.log('View calendar'),
    },
    {
      title: 'Check Leaderboard',
      description: 'See household rankings',
      icon: <Trophy className="w-5 h-5" />,
      color: 'from-yellow-500 to-orange-500',
      onClick: () => console.log('Check leaderboard'),
    },
    {
      title: 'Task History',
      description: 'Review past tasks',
      icon: <Clock className="w-5 h-5" />,
      color: 'from-purple-500 to-pink-500',
      onClick: () => console.log('Task history'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="bg-white rounded-2xl p-4 md:p-6 shadow-sm"
    >
      <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {actions.map((action, index) => (
          <motion.button
            key={action.title}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={action.onClick}
            className="p-3 md:p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-left group min-h-[100px] md:min-h-[120px]"
          >
            <div className={`inline-flex items-center justify-center w-10 h-10 bg-gradient-to-r ${action.color} rounded-lg text-white mb-3 group-hover:scale-110 transition-transform`}>
              {action.icon}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">
              {action.title}
            </h3>
            <p className="text-gray-500 text-xs">
              {action.description}
            </p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default QuickActions;