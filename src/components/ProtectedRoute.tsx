import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'agent')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { agent } = useAuth();

  if (!agent) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(agent.role)) {
    // Redirect to their respective dashboard if they try to access an unauthorized route
    return <Navigate to={agent.role === 'admin' ? '/admin/dashboard' : '/agent/inbox'} replace />;
  }

  return <Outlet />;
};
