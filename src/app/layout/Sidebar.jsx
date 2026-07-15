import { NavLink } from 'react-router-dom';
import { Bell, Users, House, BarChart3, FileText, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/features/auth/ui/AuthProvider';

const baseNavItems = [
    { path: '/', icon: House, label: 'Inicio' },
    { path: '/dashboard', icon: BarChart3, label: 'Estadísticas' },
    { path: '/alerts', icon: Bell, label: 'Alertas' },
    { path: '/communities', icon: Users, label: 'Comunidades' },
];

export default function Sidebar({ isOpen, onClose, collapsed }) {
    const { user, canSendMessages, entityMemberships, logout } = useAuth();

    const navItems = [...baseNavItems];
    if (entityMemberships.length > 0) {
        navItems.push({ path: '/reports', icon: FileText, label: 'Reportes' });
    }
    if (canSendMessages) {
        navItems.push({ path: '/messages', icon: MessageSquare, label: 'Mensajes' });
    }
    navItems.push({ path: '/profile', icon: User, label: 'Perfil' });

    return (
        <>
            {isOpen && <div className="mobile-overlay" onClick={onClose} />}
            <aside className={`sidebar${isOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
                <div className="sidebar-brand">
                    <img src="/guardian_logo.png" alt="Guardian" className="sidebar-brand-logo" />
                    {!collapsed && (
                        <div className="sidebar-brand-text-block">
                            <span className="sidebar-brand-name">Guardian</span>
                            <span className="sidebar-brand-sub">Panel de comunidad</span>
                        </div>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {!collapsed && <div className="sidebar-section-label">Navegación</div>}
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `sidebar-link${isActive ? ' active' : ''}${collapsed ? ' collapsed' : ''}`
                            }
                            onClick={onClose}
                            end={item.path === '/'}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className="sidebar-link-icon" />
                            {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className={`sidebar-footer${collapsed ? ' collapsed' : ''}`}>
                    {!collapsed && user && (
                        <div className="sidebar-user-block">
                            <div className="sidebar-user-email">{user.email}</div>
                            <button type="button" className="sidebar-logout-btn" onClick={logout}>
                                Cerrar sesión
                            </button>
                        </div>
                    )}
                    {!collapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <div className="sidebar-status-dot" />
                            <span className="sidebar-status-text">En línea</span>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
