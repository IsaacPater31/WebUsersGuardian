import AlertCard from '@/features/alerts/ui/AlertCard';

/**
 * Alerts / reports list tab for a community or entity.
 */
export default function CommunityAlertsPanel({ alerts, isEntity, onSelectAlert }) {
    return (
        <section className="section section--dash">
            <div className="section-body">
                {alerts.length === 0 ? (
                    <p className="admin-muted admin-empty-inset">
                        {isEntity
                            ? 'No hay reportes en esta entidad.'
                            : 'Sin alertas en esta comunidad.'}
                    </p>
                ) : (
                    alerts.map((a) => (
                        <AlertCard key={a.id} alert={a} onClick={onSelectAlert} />
                    ))
                )}
            </div>
        </section>
    );
}
