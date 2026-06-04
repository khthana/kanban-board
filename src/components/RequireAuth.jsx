import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useSession from '../store/useSession';

export default function RequireAuth({ children }) {
  const { isAuthenticated, displayName, fetchProfile } = useSession();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && !displayName) fetchProfile();
  }, [isAuthenticated, displayName, fetchProfile]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
