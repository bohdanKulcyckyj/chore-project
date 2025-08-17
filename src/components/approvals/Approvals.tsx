import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock } from 'lucide-react';
import { useHousehold } from '../../hooks/useHousehold';
import TaskApprovalInterface from '../admin/TaskApprovalInterface';
import AdminGuard from '../auth/AdminGuard';

const Approvals: React.FC = () => {
  const { currentHousehold } = useHousehold();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-500" />
            Task Approvals
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve task completions for {currentHousehold?.name}
          </p>
        </div>
      </motion.div>

      {/* Admin Guard for Approval Interface */}
      <AdminGuard
        fallback={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 text-center shadow-sm"
          >
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Admin Access Required
            </h3>
            <p className="text-gray-500">
              Only household administrators can access the task approval interface.
            </p>
          </motion.div>
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <TaskApprovalInterface />
        </motion.div>
      </AdminGuard>
    </div>
  );
};

export default Approvals;