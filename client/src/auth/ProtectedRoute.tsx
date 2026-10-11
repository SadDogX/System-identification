import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import type { Role } from '@app/shared';
import { homePath, useAuth } from './AuthContext';

/** Только UX: реальная проверка прав выполняется на сервере. */
export function ProtectedRoute({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (role && user.role !== role) return <Navigate to={homePath(user)} replace />;
  return <>{children}</>;
}
