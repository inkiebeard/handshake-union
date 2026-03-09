import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/database';

interface RoleRouteProps {
  children: ReactNode;
  minRole: 'moderator' | 'admin';
}

export function RoleRoute({ children, minRole }: RoleRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <p className="comment">loading...</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.app_metadata?.role as UserRole | undefined;
  const hasAccess =
    minRole === 'admin'
      ? role === 'admin'
      : role === 'moderator' || role === 'admin';

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
