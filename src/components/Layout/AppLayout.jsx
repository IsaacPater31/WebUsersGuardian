import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles = {
    '/': { title: 'Inicio', subtitle: 'Mapa de alertas de tus comunidades' },
    '/dashboard': { title: 'Estadísticas', subtitle: 'Resumen de actividad en tus comunidades' },
    '/alerts': { title: 'Alertas', subtitle: 'Histórico de alertas de tus comunidades' },
    '/communities': { title: 'Comunidades', subtitle: 'Comunidades donde participas' },
    '/reports': { title: 'Reportes', subtitle: 'Entidades y reportes enviados' },
    '/messages': { title: 'Mensajes', subtitle: 'Comunicados a tus comunidades' },
    '/profile': { title: 'Perfil', subtitle: 'Tu cuenta y contraseña' },
};

function getPageInfo(pathname) {
    if (pageTitles[pathname]) return pageTitles[pathname];
    if (pathname.startsWith('/communities/')) {
        return { title: 'Comunidad', subtitle: 'Miembros y alertas' };
    }
    if (pathname.startsWith('/reports/')) {
        return { title: 'Reportes', subtitle: 'Detalle de la entidad' };
    }
    return pageTitles['/'];
}

export default function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const location = useLocation();
    const pageInfo = getPageInfo(location.pathname);

    const handleMenuClick = () => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            setSidebarOpen(true);
            return;
        }
        setCollapsed((c) => !c);
    };

    useEffect(() => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- sync UI to route
            setSidebarOpen(false);
        }
    }, [location.pathname]);

    return (
        <>
            <SpeedInsights />
            <Analytics />
            <div className="app-layout">
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    collapsed={collapsed}
                />
                <main className={`app-main${collapsed ? ' sidebar-collapsed' : ''}`} role="main">
                    <Header
                        title={pageInfo.title}
                        subtitle={pageInfo.subtitle}
                        onMenuClick={handleMenuClick}
                    />
                    <div className="app-content">
                        <Outlet />
                    </div>
                </main>
            </div>
        </>
    );
}
