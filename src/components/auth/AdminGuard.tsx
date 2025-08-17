import React from 'react';
import { useHousehold } from '../../hooks/useHousehold';

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AdminGuard: React.FC<AdminGuardProps> = ({ children, fallback = null }) => {
  const { isAdmin } = useHousehold();

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default AdminGuard;