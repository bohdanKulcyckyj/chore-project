import React from 'react';
import { useHousehold } from '../../hooks/useHousehold';

interface RoleBasedComponentProps {
  adminContent?: React.ReactNode;
  memberContent?: React.ReactNode;
  fallback?: React.ReactNode;
}

const RoleBasedComponent: React.FC<RoleBasedComponentProps> = ({ 
  adminContent, 
  memberContent, 
  fallback = null 
}) => {
  const { isAdmin } = useHousehold();

  if (isAdmin && adminContent) {
    return <>{adminContent}</>;
  }

  if (!isAdmin && memberContent) {
    return <>{memberContent}</>;
  }

  return <>{fallback}</>;
};

export default RoleBasedComponent;