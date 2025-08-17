import React from 'react';
import { useHousehold } from '../../hooks/useHousehold';

interface MemberGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const MemberGuard: React.FC<MemberGuardProps> = ({ children, fallback = null }) => {
  const { isAdmin } = useHousehold();

  if (isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default MemberGuard;