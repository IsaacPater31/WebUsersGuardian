import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/ui/AuthProvider';
import RequireAuth from '@/features/auth/ui/RequireAuth';
import AppLayout from '@/app/layout/AppLayout';
import LoginPage from '@/features/auth/controller/LoginPage';
import MapPage from '@/features/map/controller/MapPage';
import Dashboard from '@/features/dashboard/controller/DashboardPage';
import AlertsPage from '@/features/alerts/controller/AlertsPage';
import CommunitiesPage from '@/features/communities/controller/CommunitiesPage';
import CommunityDetailPage from '@/features/communities/controller/CommunityDetailPage';
import ReportsPage from '@/features/reports/controller/ReportsPage';
import EntityDetailPage from '@/features/reports/controller/EntityDetailPage';
import MessagesPage from '@/features/messages/controller/MessagesPage';
import ProfilePage from '@/features/profile/controller/ProfilePage';

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<RequireAuth />}>
                        <Route element={<AppLayout />}>
                            <Route path="/" element={<MapPage />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/map" element={<Navigate to="/" replace />} />
                            <Route path="/alerts" element={<AlertsPage />} />
                            <Route path="/communities" element={<CommunitiesPage />} />
                            <Route path="/communities/:id" element={<CommunityDetailPage />} />
                            <Route path="/reports" element={<ReportsPage />} />
                            <Route path="/reports/:id" element={<EntityDetailPage />} />
                            <Route path="/messages" element={<MessagesPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                        </Route>
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
