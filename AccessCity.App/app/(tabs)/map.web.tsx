import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import MapView from '@/components/MapView';
import { PremiumTag } from '@/components/ui/PremiumTag';
import { DEFAULT_MAP_CENTER_LNG_LAT } from '@/constants/defaultMapRegion';
import { AppTheme } from '@/constants/theme';
import { type AppHazard, hazardsService } from '@/services/hazards.service';
import { routingService, type RouteResponse } from '@/services/routing.service';
import { type Hazard } from '@/models/spatial';

type TagTone = React.ComponentProps<typeof PremiumTag>['tone'];

function toMapHazard(hazard: AppHazard): Hazard {
  return {
    id: hazard.id,
    title: hazard.title,
    type: hazard.type,
    latitude: hazard.latitude,
    longitude: hazard.longitude,
    description: hazard.description,
    status: hazard.status,
    locationText: hazard.locationText,
    reportedTime: hazard.reportedTime,
  };
}

function formatHazardType(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusTone(status: string): TagTone {
  const normalized = status.toLowerCase();
  if (normalized.includes('resolved')) return 'good';
  if (normalized.includes('review') || normalized.includes('acknowledged')) return 'warning';
  if (normalized.includes('reported') || normalized.includes('pending')) return 'danger';
  return 'neutral';
}

const DEFAULT_ROUTE_REQUEST = {
  start: { x: -1.89, y: 52.48 },
  end: { x: -1.88, y: 52.485 },
  profile: 'manual-wheelchair',
  safetyWeight: 0.7,
  preferences: ['avoid_hazards', 'wheelchair_accessible'],
};

function formatDistance(distance?: number) {
  if (typeof distance !== 'number' || !Number.isFinite(distance)) return '-';
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
}

function formatEta(minutes?: number) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return '-';
  return `${Math.max(1, Math.round(minutes))} min`;
}

function formatSafetyScore(score?: number) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '-';
  return String(Math.round(score * 100));
}

function formatSafetyLabel(score?: number) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Pending';
  if (score >= 0.85) return 'Very safe';
  if (score >= 0.7) return 'Safe';
  if (score >= 0.5) return 'Use care';
  return 'High risk';
}

function formatRouteImpactLabel(route: RouteResponse | null, routeStatus: 'idle' | 'loading' | 'ready' | 'error') {
  if (routeStatus === 'loading') return 'Checking route impact';
  if (routeStatus === 'error') return 'Route impact unavailable';

  const warningCount = route?.warnings?.length ?? 0;
  if (warningCount > 0) return `${warningCount} affect this route`;
  if (route) return 'No reports affect this route';
  return 'Route impact pending';
}

function routeToGeoJson(route: RouteResponse | null) {
  if (!route?.path) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: route.path,
        properties: {},
      },
    ],
  };
}

export default function MapPageWeb() {
  const params = useLocalSearchParams<{ avoidHazardId?: string; avoidHazardTitle?: string }>();
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHazards, setShowHazards] = useState(true);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [routeError, setRouteError] = useState<string | null>(null);
  const hazardRequestIdRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const routeLoadingRef = useRef(false);

  const centerCoordinate = useMemo<[number, number]>(() => {
    const first = hazards[0];
    return first
      ? [first.longitude, first.latitude]
      : DEFAULT_MAP_CENTER_LNG_LAT;
  }, [hazards]);

  const routeGeoJSON = useMemo(() => routeToGeoJson(route), [route]);

  const loadHazards = useCallback(async () => {
    const requestId = hazardRequestIdRef.current + 1;
    hazardRequestIdRef.current = requestId;

    try {
      setIsLoading(true);
      setError(null);
      const page = await hazardsService.getHazardsPage({ status: 'Reported', limit: 100 });
      if (hazardRequestIdRef.current !== requestId) return;
      setHazards(page.items.map(toMapHazard));
    } catch (loadError) {
      if (hazardRequestIdRef.current !== requestId) return;
      console.warn('Failed to load web map hazards:', loadError);
      setError('Could not load hazards');
      setHazards([]);
    } finally {
      if (hazardRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadRecommendedRoute = useCallback(async () => {
    if (routeLoadingRef.current) return;

    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;
    routeLoadingRef.current = true;

    try {
      setRouteStatus('loading');
      setRouteError(null);
      const nextRoute = await routingService.getSafePathResolved(DEFAULT_ROUTE_REQUEST);
      if (routeRequestIdRef.current !== requestId) return;
      setRoute(nextRoute);
      setRouteStatus('ready');
    } catch (loadError) {
      if (routeRequestIdRef.current !== requestId) return;
      console.warn('Failed to load recommended route:', loadError);
      setRoute(null);
      setRouteStatus('error');
      setRouteError('Route engine unavailable');
    } finally {
      if (routeRequestIdRef.current === requestId) {
        routeLoadingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    void loadHazards();
    void loadRecommendedRoute();
  }, [loadHazards, loadRecommendedRoute]);

  return (
    <View style={styles.container}>
      <MapView
        centerCoordinate={centerCoordinate}
        markers={hazards}
        routeGeoJSON={routeGeoJSON}
        onMarkerPress={setSelectedHazard}
        showHazards={showHazards}
      />

      <View style={styles.topPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>AccessCity</Text>
          <PremiumTag
            label={isLoading ? 'Loading' : 'Live'}
            tone={isLoading ? 'neutral' : 'good'}
            variant={isLoading ? 'surface' : 'soft'}
          />
        </View>

        <View style={styles.searchStack}>
          <View style={styles.searchRow}>
            <Ionicons name="radio-button-on-outline" size={14} color={AppTheme.color.textSubtle} />
            <Text style={styles.searchLabel}>From</Text>
            <Text style={styles.searchValue}>My location</Text>
          </View>
          <View style={styles.searchDivider} />
          <View style={styles.searchRow}>
            <Ionicons name="location-outline" size={14} color={AppTheme.color.textSubtle} />
            <Text style={styles.searchLabel}>To</Text>
            <Text style={styles.searchValue}>Where to?</Text>
            <Ionicons name="swap-vertical" size={16} color={AppTheme.color.text} />
          </View>
        </View>

        <View style={styles.modeRow}>
          <PremiumTag label="Walking" icon="walk-outline" tone="good" variant="soft" />
          <PremiumTag label="Wheelchair" icon="accessibility-outline" tone="accent" variant="surface" />
          <PremiumTag label="Stroller" icon="body-outline" tone="neutral" variant="surface" />
        </View>

        <View style={styles.routeModeRow}>
          <View style={styles.routeModeActive}>
            <Text style={styles.routeModeActiveText}>Safe route</Text>
          </View>
          <Text style={styles.routeModeText}>Accessible</Text>
          <Text style={styles.routeModeText}>Fastest</Text>
        </View>

        <View style={styles.tagRow}>
          <PremiumTag
            label={showHazards ? `${hazards.length} city reports` : 'Reports hidden'}
            icon="warning-outline"
            tone={hazards.length > 0 ? 'danger' : 'neutral'}
            variant="surface"
          />
          <PremiumTag
            label={formatRouteImpactLabel(route, routeStatus)}
            icon="shield-checkmark-outline"
            tone={route?.warnings?.length ? 'warning' : 'good'}
            variant="soft"
          />
          <PremiumTag label="Birmingham" icon="location-outline" tone="accent" variant="surface" />
          {params.avoidHazardTitle ? (
            <PremiumTag
              label={`Avoiding ${String(params.avoidHazardTitle).slice(0, 18)}`}
              icon="navigate-outline"
              tone="warning"
              variant="soft"
            />
          ) : null}
        </View>
      </View>

      <View style={styles.mapControls}>
        <TouchableOpacity
          style={[styles.controlButton, !showHazards && styles.controlButtonMuted]}
          activeOpacity={0.86}
          onPress={() => setShowHazards((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel="Toggle hazard layer"
        >
          <Ionicons name="layers-outline" size={19} color={showHazards ? AppTheme.color.text : AppTheme.color.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          activeOpacity={0.86}
          onPress={() => void loadRecommendedRoute()}
          accessibilityRole="button"
          accessibilityLabel="Refresh recommended route"
        >
          {routeStatus === 'loading' ? (
            <ActivityIndicator size="small" color={AppTheme.color.text} />
          ) : (
            <Ionicons name="navigate" size={19} color={AppTheme.color.text} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            void loadHazards();
            void loadRecommendedRoute();
          }}
          accessibilityRole="button"
          accessibilityLabel="Refresh hazards"
          activeOpacity={0.86}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={AppTheme.color.text} />
          ) : (
            <Ionicons name="refresh" size={18} color={AppTheme.color.text} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.recommendationCard}>
        <View style={styles.recommendationHeader}>
          <View>
            <Text style={styles.recommendationTitle}>Recommended route</Text>
            <View style={styles.recommendationMetaRow}>
              <Text style={styles.routeMetric}>{formatEta(route?.estimatedTime)}</Text>
              <Text style={styles.routeMetric}>{formatDistance(route?.distance)}</Text>
              <Text style={styles.routeMetricMuted}>
                {routeStatus === 'loading'
                  ? 'Calculating'
                  : route?.warnings?.length
                    ? `${route.warnings.length} warnings`
                    : routeStatus === 'ready'
                      ? 'No route warnings'
                      : 'Route not loaded'}
              </Text>
            </View>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>{formatSafetyScore(route?.safetyScore)}</Text>
            <Text style={styles.scoreLabel}>{formatSafetyLabel(route?.safetyScore)}</Text>
          </View>
        </View>
        <View style={styles.routeSparkline}>
          <View style={styles.sparklineFill} />
        </View>
        {routeError ? <Text style={styles.routeErrorText}>{routeError}</Text> : null}
        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.9}
          onPress={() => {
            if (!route) {
              void loadRecommendedRoute();
              return;
            }
            Alert.alert('Route ready', 'The backend route is loaded on the map. Turn-by-turn navigation is the next mobile integration step.');
          }}
        >
          {routeStatus === 'loading' ? (
            <ActivityIndicator size="small" color={AppTheme.color.textInverse} />
          ) : (
            <Ionicons name="navigate-outline" size={16} color={AppTheme.color.textInverse} />
          )}
          <Text style={styles.startButtonText}>{route ? 'Start navigation' : 'Load route'}</Text>
        </TouchableOpacity>
        <View style={styles.reasonList}>
          {[
            route ? 'This route avoids known hazards' : 'Finding a safer route',
            'Mostly smooth pavements',
            route?.warnings?.length ? 'Review warnings before you go' : 'No major warnings on this route',
          ].map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <Ionicons name="checkmark-circle" size={14} color={AppTheme.color.success} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      </View>

      {selectedHazard ? (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleBlock}>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {selectedHazard.title}
              </Text>
              <View style={styles.detailTagRow}>
                <PremiumTag
                  label={selectedHazard.status}
                  tone={getStatusTone(selectedHazard.status)}
                  variant="soft"
                />
                <PremiumTag
                  label={formatHazardType(selectedHazard.type)}
                  icon="pricetag-outline"
                  tone="neutral"
                  variant="surface"
                />
                <PremiumTag
                  label={selectedHazard.reportedTime}
                  icon="time-outline"
                  tone="neutral"
                  variant="surface"
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setSelectedHazard(null)}
              accessibilityRole="button"
              accessibilityLabel="Close hazard details"
            >
              <Ionicons name="close" size={18} color={AppTheme.color.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.detailDescription} numberOfLines={3}>
            {selectedHazard.description}
          </Text>
          <Text style={styles.detailLocation} numberOfLines={1}>
            {selectedHazard.locationText}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  topPanel: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    maxWidth: AppTheme.layout.mobileFrameWidth,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: 'rgba(255, 253, 247, 0.98)',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    boxShadow: '0 12px 24px rgba(26, 23, 16, 0.12)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  searchStack: {
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    paddingHorizontal: 10,
  },
  searchRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchDivider: {
    height: 1,
    backgroundColor: AppTheme.color.border,
    marginLeft: 22,
  },
  searchLabel: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  searchValue: {
    flex: 1,
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  routeModeRow: {
    minHeight: 40,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.color.surfaceSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  routeModeActive: {
    flex: 1,
    minHeight: 32,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeModeActiveText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.label,
  },
  routeModeText: {
    flex: 1,
    textAlign: 'center',
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapControls: {
    position: 'absolute',
    right: 18,
    top: 308,
    gap: 10,
  },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AppTheme.color.surface,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 16px rgba(26, 23, 16, 0.12)',
  },
  controlButtonMuted: {
    opacity: 0.68,
  },
  errorPanel: {
    position: 'absolute',
    top: 88,
    left: 18,
    right: 18,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
  },
  errorText: {
    color: AppTheme.color.danger,
    ...AppTheme.type.meta,
  },
  recommendationCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    maxWidth: AppTheme.layout.mobileFrameWidth,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: 'rgba(255, 253, 247, 0.98)',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    padding: 12,
    boxShadow: '0 14px 28px rgba(26, 23, 16, 0.14)',
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  recommendationTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  recommendationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 7,
  },
  routeMetric: {
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  routeMetricMuted: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  scoreBadge: {
    width: 52,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.success,
    alignItems: 'center',
    paddingVertical: 7,
  },
  scoreValue: {
    color: AppTheme.color.textInverse,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '800',
  },
  scoreLabel: {
    color: AppTheme.color.textInverse,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  routeSparkline: {
    height: 44,
    borderRadius: 12,
    backgroundColor: AppTheme.color.successSoft,
    marginTop: 12,
    overflow: 'hidden',
  },
  routeErrorText: {
    marginTop: 8,
    color: AppTheme.color.warning,
    ...AppTheme.type.label,
  },
  sparklineFill: {
    position: 'absolute',
    left: -8,
    right: -8,
    bottom: 12,
    height: 2,
    backgroundColor: AppTheme.color.success,
    transform: [{ rotate: '4deg' }],
  },
  startButton: {
    minHeight: 42,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  startButtonText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.label,
  },
  reasonList: {
    marginTop: 12,
    gap: 5,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reasonText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  detailPanel: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    padding: 14,
    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.1)',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  detailTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  detailTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  detailDescription: {
    marginTop: 12,
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
  detailLocation: {
    marginTop: 10,
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
  },
});
