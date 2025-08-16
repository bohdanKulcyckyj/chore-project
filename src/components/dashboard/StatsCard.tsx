import React from 'react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className={`inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r ${color} rounded-xl text-white`}>
          <div className="w-4 h-4 md:w-6 md:h-6">
            {icon}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg md:text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        </div>
      </div>
      <h3 className="text-xs md:text-sm text-gray-600 font-medium">{title}</h3>
    </motion.div>
  );
};

export default StatsCard;