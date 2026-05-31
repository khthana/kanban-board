import { Navigate, useLocation } from 'react-router-dom';
import useSession from '../store/useSession';

export default function RequireAuth({ children }) {
  const { isAuthenticated } = useSession();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
