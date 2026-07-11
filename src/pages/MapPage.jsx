import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { subscribeToMapAlertsFiltered } from '../services/alertService';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../utils/mapUtils';
import DynamicMarkers from '../components/Map/DynamicMarkers';
import { UserLocationMarker, LocateMeButton, AutoCenterOnUser } from '../components/Map/UserLocation';
import AlertDetailModal from '../components/AlertDetailModal';
import useUserGeolocation from '../hooks/useUserGeolocation';
import SelectedAlertPanel from '../components/Map/SelectedAlertPanel';
import MapAlertCountBadge from '../components/Map/MapAlertCountBadge';
import RequestLocationOnFirstInteraction from '../components/Map/RequestLocationOnFirstInteraction';
import MapFilterPanel from '../components/Map/MapFilterPanel';
import MapCommunityFilterBar from '../components/Map/MapCommunityFilterBar';
import { DEFAULT_FILTERS } from '../config/filterOptions';
import { useAuth } from '../contexts/AuthContext';
import { filterAlertsByCommunities } from '../utils/alertScope';
import { isOfficialEntityCommunity } from '../utils/communityVisibility';


// ─── MapPage ──────────────────────────────────────────────────────────────────
export default function MapPage() {
    const { memberships, normalCommunityIds, loading: authLoading } = useAuth();
    const [rawAlerts, setRawAlerts] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    /** null = all membership communities; [] = none; [ids] = subset */
    const [selectedCommunityIds, setSelectedCommunityIds] = useState(null);
    const { position: userPosition, error: geoError, request: requestLocation } = useUserGeolocation();

    const unsubRef = useRef(null);

    const mapCommunities = useMemo(() => (
        memberships
            .filter((m) => m.community && !isOfficialEntityCommunity(m.community))
            .map((m) => ({ id: m.communityId, name: m.community.name || 'Comunidad' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    ), [memberships]);

    const effectiveCommunityIds = useMemo(() => {
        if (selectedCommunityIds == null) return normalCommunityIds;
        return selectedCommunityIds;
    }, [selectedCommunityIds, normalCommunityIds]);

    // Type / status / date → Firestore subscription only
    useEffect(() => {
        if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
        }

        setAlertsLoading(true);

        const unsub = subscribeToMapAlertsFiltered(filters, (data) => {
            setRawAlerts(data);
            setAlertsLoading(false);
        });

        unsubRef.current = unsub;

        return () => {
            if (unsubRef.current) {
                unsubRef.current();
                unsubRef.current = null;
            }
        };
    }, [filters]);

    // Community filter is client-side AND with type/status/date results
    const alerts = useMemo(
        () => filterAlertsByCommunities(rawAlerts, effectiveCommunityIds),
        [rawAlerts, effectiveCommunityIds],
    );

    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters);
    }, []);

    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (normalCommunityIds.length === 0) {
        return (
            <div className="empty-state" style={{ margin: 'var(--space-6)' }}>
                <div className="empty-state-title">Sin comunidades</div>
                <div className="empty-state-desc">
                    Únete a una comunidad desde la app móvil para ver alertas en el mapa.
                </div>
            </div>
        );
    }

    return (
        <div className="map-page has-community-filter">
            <div className="map-container">
                <MapContainer
                    center={userPosition || DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    minZoom={2}
                    maxZoom={20}
                    worldCopyJump={false}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        minZoom={2}
                        maxZoom={20}
                        noWrap={true}
                    />

                    <RequestLocationOnFirstInteraction
                        enabled={!userPosition}
                        onRequest={requestLocation}
                    />
                    <AutoCenterOnUser position={userPosition} />
                    <UserLocationMarker position={userPosition} />

                    <LocateMeButton
                        userPosition={userPosition}
                        onLocate={requestLocation}
                    />

                    <DynamicMarkers alerts={alerts} onMarkerClick={setSelectedAlert} />
                </MapContainer>

                <MapFilterPanel
                    types={filters.types}
                    status={filters.status}
                    dateRange={filters.dateRange}
                    customStart={filters.customStart}
                    customEnd={filters.customEnd}
                    onChange={handleFiltersChange}
                    totalVisible={alerts.length}
                />

                <MapCommunityFilterBar
                    communities={mapCommunities}
                    selectedIds={selectedCommunityIds}
                    onChange={setSelectedCommunityIds}
                />

                {!alertsLoading && <MapAlertCountBadge count={alerts.length} />}
                {alertsLoading && (
                    <div className="map-loading-overlay">
                        <div className="loading-spinner" />
                    </div>
                )}

                {geoError && (
                    <div className="map-geo-hint">
                        <div className="map-geo-hint-title">Ubicación desactivada</div>
                        <div className="map-geo-hint-desc">
                            Activa los permisos de ubicación para este navegador si deseas centrar el mapa en tu posición.
                        </div>
                    </div>
                )}

                {selectedAlert && (
                    <SelectedAlertPanel
                        alert={selectedAlert}
                        onClose={() => setSelectedAlert(null)}
                        onShowDetail={() => setShowModal(true)}
                    />
                )}
            </div>

            {showModal && selectedAlert && (
                <AlertDetailModal alert={selectedAlert} onClose={() => setShowModal(false)} />
            )}
        </div>
    );
}
