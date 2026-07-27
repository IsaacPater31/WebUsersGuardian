import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import {
    subscribeToMapAlertsFiltered,
    sortAlertsNewestFirst,
    sortPendingAlertsNewestFirst,
    findNewestPendingAmongChanges,
} from '@/features/alerts/repository/alertRepository';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/features/map/utils/mapUtils';
import DynamicMarkers from '@/features/map/ui/DynamicMarkers';
import { UserLocationMarker, LocateMeButton, AutoCenterOnUser } from '@/features/map/ui/UserLocation';
import AlertDetailModal from '@/features/alerts/ui/AlertDetailModal';
import useUserGeolocation from '@/features/map/utils/useUserGeolocation';
import SelectedAlertPanel from '@/features/map/ui/SelectedAlertPanel';
import MapAlertCountBadge from '@/features/map/ui/MapAlertCountBadge';
import RequestLocationOnFirstInteraction from '@/features/map/ui/RequestLocationOnFirstInteraction';
import MapFilterPanel from '@/features/map/ui/MapFilterPanel';
import MapCommunityFilterBar from '@/features/map/ui/MapCommunityFilterBar';
import ViewScopeToggle from '@/features/scope/ui/ViewScopeToggle';
import { DEFAULT_FILTERS } from '@/shared/config/filterOptions';
import { ACTIVE_ALERT_FEEDBACK_MS } from '@/shared/config/alertTypes';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useViewScope } from '@/features/scope/controller/useViewScope';
import { filterAlertsByCommunities } from '@/features/alerts/utils/alertScope';
import { mergeTypeOptionsFromAlerts } from '@/features/alerts/utils/alertTypePresentation';
import { getMemberAliasMap } from '@/features/communities/repository/communityRepository';
import { resolveSenderLabelForAlert } from '@/shared/utils/memberDisplayLabel';

function MapFocusController({ focusAlert }) {
    const map = useMap();
    const lastFocusKeyRef = useRef(null);

    useEffect(() => {
        if (!focusAlert?.id || !focusAlert?.location) return;
        const focusKey = `${focusAlert.id}-${focusAlert.__focusKey ?? 'default'}`;
        if (lastFocusKeyRef.current === focusKey) return;

        const lat = Number(focusAlert.location.latitude);
        const lng = Number(focusAlert.location.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        lastFocusKeyRef.current = focusKey;
        const nextZoom = Math.max(map.getZoom(), 15);
        map.flyTo([lat, lng], nextZoom, {
            animate: true,
            duration: 0.75,
            easeLinearity: 0.22,
        });
    }, [focusAlert, map]);

    return null;
}

function alertHasMapLocation(alert) {
    return Boolean(alert?.shareLocation && alert?.location);
}

export default function MapPage() {
    const { loading: authLoading } = useAuth();
    const {
        scope,
        setScope,
        showToggle,
        scopeIds,
        scopeCommunities,
        typeOptions,
        isReportsScope,
        hasAnyScope,
        ready,
    } = useViewScope();

    const [rawAlerts, setRawAlerts] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [selectedAlertId, setSelectedAlertId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [timedPriorityAlertId, setTimedPriorityAlertId] = useState(null);
    const [focusedAlert, setFocusedAlert] = useState(null);
    /** Prefer latest unattended alert over GPS one-shot center. */
    const [suppressUserAutoCenter, setSuppressUserAutoCenter] = useState(false);
    /** null = all scope communities; [] = none; [ids] = subset */
    const [selectedCommunityIds, setSelectedCommunityIds] = useState(null);
    const [aliasMaps, setAliasMaps] = useState({});
    const { position: userPosition, error: geoError, request: requestLocation } = useUserGeolocation();

    const unsubRef = useRef(null);
    const isInitialSnapshotRef = useRef(true);
    const lastAutoFocusIdRef = useRef(null);
    const effectiveCommunityIdsRef = useRef(null);

    // Reset selection + type filters when switching Comunidades ↔ Reportes
    useEffect(() => {
        setSelectedCommunityIds(null);
        setFilters((prev) => ({ ...prev, types: [] }));
        setSelectedAlertId(null);
        setFocusedAlert(null);
        setShowModal(false);
        setTimedPriorityAlertId(null);
        setSuppressUserAutoCenter(false);
        lastAutoFocusIdRef.current = null;
    }, [scope]);

    const effectiveCommunityIds = useMemo(() => {
        if (selectedCommunityIds == null) return scopeIds;
        return selectedCommunityIds;
    }, [selectedCommunityIds, scopeIds]);

    effectiveCommunityIdsRef.current = effectiveCommunityIds;

    useEffect(() => {
        const ids = (effectiveCommunityIds || []).filter(Boolean);
        if (!ids.length) {
            setAliasMaps({});
            return undefined;
        }
        let cancelled = false;
        Promise.all(ids.map(async (id) => [id, await getMemberAliasMap(id)]))
            .then((entries) => {
                if (cancelled) return;
                setAliasMaps(Object.fromEntries(entries));
            })
            .catch((err) => {
                console.warn('[MapPage] alias maps', err);
                if (!cancelled) setAliasMaps({});
            });
        return () => { cancelled = true; };
    }, [effectiveCommunityIds]);

    useEffect(() => {
        if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
        }

        isInitialSnapshotRef.current = true;
        lastAutoFocusIdRef.current = null;
        setSuppressUserAutoCenter(false);
        setAlertsLoading(true);

        const unsub = subscribeToMapAlertsFiltered(filters, (data, meta = {}) => {
            setRawAlerts(data);
            setAlertsLoading(false);

            const communityFilter = effectiveCommunityIdsRef.current;
            const scoped = filterAlertsByCommunities(data, communityFilter);
            const latestPending = sortPendingAlertsNewestFirst(scoped)[0] ?? null;

            if (isInitialSnapshotRef.current) {
                isInitialSnapshotRef.current = false;
                if (latestPending?.id && alertHasMapLocation(latestPending)) {
                    lastAutoFocusIdRef.current = latestPending.id;
                    setSuppressUserAutoCenter(true);
                    setFocusedAlert({ ...latestPending, __focusKey: Date.now() });
                }
                return;
            }

            const changedIds = Array.isArray(meta.changedIds) ? meta.changedIds : [];
            const newestChanged = findNewestPendingAmongChanges(scoped, changedIds);
            if (!newestChanged?.id) return;

            const nextActiveId = latestPending?.id ?? null;
            if (newestChanged.id !== nextActiveId) return;

            setTimedPriorityAlertId(newestChanged.id);

            if (
                newestChanged.id !== lastAutoFocusIdRef.current &&
                alertHasMapLocation(newestChanged)
            ) {
                lastAutoFocusIdRef.current = newestChanged.id;
                setSuppressUserAutoCenter(true);
                setSelectedAlertId(newestChanged.id);
                setFocusedAlert({ ...newestChanged, __focusKey: Date.now() });
            }
        });

        unsubRef.current = unsub;

        return () => {
            if (unsubRef.current) {
                unsubRef.current();
                unsubRef.current = null;
            }
        };
    }, [filters]);

    useEffect(() => {
        if (!timedPriorityAlertId) return undefined;
        const timeout = setTimeout(() => {
            setTimedPriorityAlertId(null);
        }, ACTIVE_ALERT_FEEDBACK_MS);
        return () => clearTimeout(timeout);
    }, [timedPriorityAlertId]);

    const alerts = useMemo(
        () => filterAlertsByCommunities(rawAlerts, effectiveCommunityIds),
        [rawAlerts, effectiveCommunityIds],
    );

    const listAlerts = useMemo(
        () => sortAlertsNewestFirst(alerts),
        [alerts],
    );

    const activeAlertId = useMemo(
        () => sortPendingAlertsNewestFirst(alerts)[0]?.id ?? null,
        [alerts],
    );

    const effectiveTypeOptions = useMemo(
        () => mergeTypeOptionsFromAlerts(typeOptions, alerts),
        [typeOptions, alerts],
    );

    const selectedAlert = useMemo(
        () => alerts.find((a) => a.id === selectedAlertId) || null,
        [alerts, selectedAlertId],
    );

    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters);
    }, []);

    const handleScopeChange = useCallback((next) => {
        setScope(next);
    }, [setScope]);

    const handleRecentAlertSelect = useCallback((alert) => {
        if (!alert) return;
        if (selectedAlertId === alert.id) {
            setSelectedAlertId(null);
            setFocusedAlert(null);
            return;
        }
        setSelectedAlertId(alert.id);
        setFocusedAlert({ ...alert, __focusKey: Date.now() });
    }, [selectedAlertId]);

    const handleMarkerClick = useCallback((alert) => {
        if (!alert) return;
        if (selectedAlertId === alert.id) {
            setSelectedAlertId(null);
            setFocusedAlert(null);
            return;
        }
        setSelectedAlertId(alert.id);
        setFocusedAlert({ ...alert, __focusKey: Date.now() });
    }, [selectedAlertId]);

    if (authLoading || !ready) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!hasAnyScope) {
        return (
            <div className="empty-state" style={{ margin: 'var(--space-6)' }}>
                <div className="empty-state-title">Sin datos en el mapa</div>
                <div className="empty-state-desc">
                    Únete a una comunidad o a un reporte (entidad) desde la app móvil para ver alertas aquí.
                </div>
            </div>
        );
    }

    return (
        <div className={`map-page${scopeCommunities.length > 0 ? ' has-community-filter' : ''}`}>
            {showToggle && (
                <div className="view-scope-toggle-wrap map-scope-toggle-wrap">
                    <ViewScopeToggle scope={scope} onChange={handleScopeChange} show />
                </div>
            )}
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
                    <AutoCenterOnUser
                        position={userPosition}
                        enabled={!suppressUserAutoCenter}
                    />
                    <UserLocationMarker position={userPosition} />

                    <LocateMeButton
                        userPosition={userPosition}
                        onLocate={requestLocation}
                    />

                    <DynamicMarkers
                        alerts={alerts}
                        onMarkerClick={handleMarkerClick}
                        highlightedAlertId={activeAlertId}
                        selectedAlertId={selectedAlertId}
                    />
                    <MapFocusController focusAlert={focusedAlert} />
                </MapContainer>

                <MapFilterPanel
                    types={filters.types}
                    status={filters.status}
                    dateRange={filters.dateRange}
                    customStart={filters.customStart}
                    customEnd={filters.customEnd}
                    onChange={handleFiltersChange}
                    totalVisible={alerts.length}
                    typeOptions={effectiveTypeOptions}
                    typesSectionLabel={isReportsScope ? 'Tipo de reporte' : 'Tipo de alerta'}
                    listAlerts={listAlerts}
                    activeAlertId={activeAlertId}
                    pulseAlertId={
                        timedPriorityAlertId && timedPriorityAlertId === activeAlertId
                            ? timedPriorityAlertId
                            : null
                    }
                    selectedAlertId={selectedAlertId}
                    onRecentAlertSelect={handleRecentAlertSelect}
                />

                <MapCommunityFilterBar
                    communities={scopeCommunities}
                    selectedIds={selectedCommunityIds}
                    onChange={setSelectedCommunityIds}
                    title={isReportsScope ? 'Entidades' : 'Comunidades'}
                    variant={isReportsScope ? 'entity' : 'community'}
                    ariaLabel={
                        isReportsScope
                            ? 'Filtrar por entidad de reportes'
                            : 'Filtrar alertas por comunidad'
                    }
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
                        senderLabel={resolveSenderLabelForAlert(selectedAlert, aliasMaps)}
                        onClose={() => {
                            setSelectedAlertId(null);
                            setFocusedAlert(null);
                        }}
                        onShowDetail={() => setShowModal(true)}
                    />
                )}
            </div>

            {showModal && selectedAlert && (
                <AlertDetailModal
                    alert={selectedAlert}
                    senderLabel={resolveSenderLabelForAlert(selectedAlert, aliasMaps)}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}
