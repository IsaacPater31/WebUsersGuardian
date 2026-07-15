import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/ui/AuthProvider';

export default function RequireAuth() {
    const { user, authLoading } = useAuth();
    const location = useLocation();

    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
}
