import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './components/auth/RequireAuth';
import AppLayout from './components/Layout/AppLayout';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import Dashboard from './pages/Dashboard';
import AlertsPage from './pages/AlertsPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import ReportsPage from './pages/ReportsPage';
import EntityReportsPage from './pages/EntityReportsPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

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
                            <Route path="/reports/:id" element={<EntityReportsPage />} />
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
