import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { AppTheme } from '@/constants/theme';
import { aiAssistService, AccessibilityAiInferenceResult, AccessibilityAiReviewResult } from '@/services/aiAssist.service';
import {
  PredictiveRiskResult,
  RouteGraphCoverageStatus,
  RouteJobResult,
  routingService,
} from '@/services/routing.service';
import { MapOverlayResponse, spatialService } from '@/services/spatial.service';
import {
  adminAccessibilityService,
  adminOsmService,
  dashboardService,
  DashboardInfrastructureFeed,
  DashboardSummary,
  integrationsService,
  IntegrationStatus,
  MapTileProfile,
  OsmImportJobResponse,
  OsmImportResult,
  RouteGraphProfileResponse,
  tileProfileService,
} from '@/services/system.service';

const DEFAULT_TILE = {
  z: '14',
  x: '8102',
  y: '5411',
};

const DEFAULT_BBOX = {
  minLat: '52.4700',
  minLng: '-1.9100',
  maxLat: '52.5000',
  maxLng: '-1.8600',
};

const DEFAULT_RISK_POINT = {
  lat: '52.4800',
  lng: '-1.8900',
  radius: '500',
};

const DEFAULT_ROUTE = {
  startLat: '52.4800',
  startLng: '-1.9000',
  endLat: '52.4860',
  endLng: '-1.8850',
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type OverviewState = {
  summary: DashboardSummary | null;
  integrations: IntegrationStatus | null;
  feed: DashboardInfrastructureFeed;
  heatMapFeatureCount: number | null;
  routeGraphStatus: RouteGraphCoverageStatus | null;
  error: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function compactDate(value?: string | null) {
  if (!value) return 'Not started';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNumber(value: number | undefined | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | undefined | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function formatBytes(value: number | undefined | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatMs(value: number | undefined | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  if (value < 1000) return `${value.toFixed(1)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatField(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRecordValue(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return null;
}

function stringifyPreview(value: unknown, maxLength = 360) {
  if (value === null || value === undefined) return 'No response yet.';
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function isTerminalJob(job: OsmImportJobResponse | null) {
  const status = String(job?.status ?? '').toLowerCase();
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color={AppTheme.color.primary} />
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return (
    <View style={[styles.metric, styles[`metric_${tone}`]]}>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  return (
    <View style={[styles.statusPill, styles[`status_${tone}`]]}>
      <View style={[styles.statusDot, styles[`statusDot_${tone}`]]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  secondary,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.actionButton,
        secondary ? styles.actionButtonSecondary : styles.actionButtonPrimary,
        (disabled || loading) && styles.actionButtonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={secondary ? AppTheme.color.primary : AppTheme.color.textInverse} />
      ) : (
        <Ionicons
          name={icon}
          size={17}
          color={secondary ? AppTheme.color.primary : AppTheme.color.textInverse}
        />
      )}
      <Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={AppTheme.color.textSubtle}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={18} color={AppTheme.color.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export default function OpsScreen() {
  const [overviewState, setOverviewState] = React.useState<LoadState>('idle');
  const [overview, setOverview] = React.useState<OverviewState>({
    summary: null,
    integrations: null,
    feed: [],
    heatMapFeatureCount: null,
    routeGraphStatus: null,
    error: null,
  });

  const [osmJob, setOsmJob] = React.useState<OsmImportJobResponse | null>(null);
  const [osmSyncResult, setOsmSyncResult] = React.useState<OsmImportResult | null>(null);
  const [osmLoading, setOsmLoading] = React.useState(false);
  const [osmSyncLoading, setOsmSyncLoading] = React.useState(false);
  const [osmError, setOsmError] = React.useState<string | null>(null);

  const [routeProfile, setRouteProfile] = React.useState<RouteGraphProfileResponse | null>(null);
  const [routeProfileLoading, setRouteProfileLoading] = React.useState(false);
  const [routeProfileError, setRouteProfileError] = React.useState<string | null>(null);

  const [tileInputs, setTileInputs] = React.useState(DEFAULT_TILE);
  const [tileProfile, setTileProfile] = React.useState<MapTileProfile | null>(null);
  const [tileLoading, setTileLoading] = React.useState(false);
  const [tileError, setTileError] = React.useState<string | null>(null);

  const [bboxInputs, setBboxInputs] = React.useState(DEFAULT_BBOX);
  const [overlayLayer, setOverlayLayer] = React.useState('hazards');
  const [mapOverlay, setMapOverlay] = React.useState<MapOverlayResponse | null>(null);
  const [offlineBundlePreview, setOfflineBundlePreview] = React.useState<unknown>(null);
  const [offlineLoading, setOfflineLoading] = React.useState(false);
  const [offlineError, setOfflineError] = React.useState<string | null>(null);
  const [overlayLoading, setOverlayLoading] = React.useState(false);
  const [overlayError, setOverlayError] = React.useState<string | null>(null);

  const [riskInputs, setRiskInputs] = React.useState(DEFAULT_RISK_POINT);
  const [routeInputs, setRouteInputs] = React.useState(DEFAULT_ROUTE);
  const [hazardBlendRisk, setHazardBlendRisk] = React.useState<PredictiveRiskResult | null>(null);
  const [riskProbeLoading, setRiskProbeLoading] = React.useState(false);
  const [riskProbeError, setRiskProbeError] = React.useState<string | null>(null);
  const [routeJob, setRouteJob] = React.useState<RouteJobResult | null>(null);
  const [routeJobId, setRouteJobId] = React.useState('');
  const [routeJobLoading, setRouteJobLoading] = React.useState(false);
  const [routeJobError, setRouteJobError] = React.useState<string | null>(null);

  const [assetId, setAssetId] = React.useState('1');
  const [verificationId, setVerificationId] = React.useState('');
  const [reviewNotes, setReviewNotes] = React.useState('');
  const [observationText, setObservationText] = React.useState(
    'Observed a clear pedestrian path, smooth surface, and no visible steps at the entrance.'
  );
  const [assetProfile, setAssetProfile] = React.useState<unknown>(null);
  const [verificationSubmissions, setVerificationSubmissions] = React.useState<unknown[]>([]);
  const [aiReview, setAiReview] = React.useState<AccessibilityAiReviewResult | null>(null);
  const [aiCandidates, setAiCandidates] = React.useState<AccessibilityAiInferenceResult | null>(null);
  const [accessibilityLoading, setAccessibilityLoading] = React.useState(false);
  const [accessibilityError, setAccessibilityError] = React.useState<string | null>(null);
  const [accessibilityActionMessage, setAccessibilityActionMessage] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    setOverviewState('loading');
    const [summaryResult, integrationsResult, feedResult, heatMapResult, routeGraphResult] = await Promise.allSettled([
      dashboardService.getSummary(),
      integrationsService.getStatus(),
      dashboardService.getInfrastructureFeed(8),
      dashboardService.getHeatMap(),
      routingService.getRouteGraphStatus(),
    ]);

    const errors = [summaryResult, integrationsResult, feedResult, heatMapResult, routeGraphResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => getErrorMessage(result.reason));

    setOverview({
      summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
      integrations: integrationsResult.status === 'fulfilled' ? integrationsResult.value : null,
      feed: feedResult.status === 'fulfilled' ? feedResult.value : [],
      heatMapFeatureCount: heatMapResult.status === 'fulfilled'
        ? (Array.isArray(heatMapResult.value.features) ? heatMapResult.value.features.length : 0)
        : null,
      routeGraphStatus: routeGraphResult.status === 'fulfilled' ? routeGraphResult.value : null,
      error: errors.length ? errors.join('\n') : null,
    });
    setOverviewState(errors.length ? 'error' : 'ready');
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadOverview();
    }, [loadOverview])
  );

  async function queueOsmJob() {
    setOsmLoading(true);
    setOsmError(null);
    try {
      const job = await adminOsmService.queueImportJob();
      setOsmJob(job);
    } catch (error) {
      setOsmError(getErrorMessage(error));
    } finally {
      setOsmLoading(false);
    }
  }

  async function refreshOsmJob() {
    if (!osmJob?.jobId) return;
    setOsmLoading(true);
    setOsmError(null);
    try {
      const job = await adminOsmService.getImportJob(osmJob.jobId);
      setOsmJob(job);
    } catch (error) {
      setOsmError(getErrorMessage(error));
    } finally {
      setOsmLoading(false);
    }
  }

  async function runSyncOsmImport() {
    setOsmSyncLoading(true);
    setOsmError(null);
    try {
      const result = await adminOsmService.runImportNow();
      setOsmSyncResult(result);
    } catch (error) {
      setOsmError(getErrorMessage(error));
    } finally {
      setOsmSyncLoading(false);
    }
  }

  async function runRouteGraphProfile() {
    setRouteProfileLoading(true);
    setRouteProfileError(null);
    try {
      const profile = await adminOsmService.profileRouteGraph({
        routes: [],
        hotReadsPerRoute: 3,
      });
      setRouteProfile(profile);
    } catch (error) {
      setRouteProfileError(getErrorMessage(error));
    } finally {
      setRouteProfileLoading(false);
    }
  }

  async function runTileProfile() {
    setTileLoading(true);
    setTileError(null);
    try {
      const profile = await tileProfileService.getProfile(
        parseInteger(tileInputs.z, Number(DEFAULT_TILE.z)),
        parseInteger(tileInputs.x, Number(DEFAULT_TILE.x)),
        parseInteger(tileInputs.y, Number(DEFAULT_TILE.y))
      );
      setTileProfile(profile);
    } catch (error) {
      setTileError(getErrorMessage(error));
    } finally {
      setTileLoading(false);
    }
  }

  async function loadOfflineBundle() {
    setOfflineLoading(true);
    setOfflineError(null);
    try {
      const bundle = await spatialService.getOfflineMapBundle(
        parseFloatField(bboxInputs.minLat, Number(DEFAULT_BBOX.minLat)),
        parseFloatField(bboxInputs.minLng, Number(DEFAULT_BBOX.minLng)),
        parseFloatField(bboxInputs.maxLat, Number(DEFAULT_BBOX.maxLat)),
        parseFloatField(bboxInputs.maxLng, Number(DEFAULT_BBOX.maxLng))
      );
      setOfflineBundlePreview(bundle);
    } catch (error) {
      setOfflineError(getErrorMessage(error));
    } finally {
      setOfflineLoading(false);
    }
  }

  async function loadMapOverlay() {
    setOverlayLoading(true);
    setOverlayError(null);
    try {
      const overlay = await spatialService.getMapOverlay(overlayLayer.trim() || 'hazards');
      setMapOverlay(overlay);
    } catch (error) {
      setOverlayError(getErrorMessage(error));
    } finally {
      setOverlayLoading(false);
    }
  }

  async function loadHazardBlendRisk() {
    setRiskProbeLoading(true);
    setRiskProbeError(null);
    try {
      const risk = await routingService.getHazardBlendRisk(
        parseFloatField(riskInputs.lat, Number(DEFAULT_RISK_POINT.lat)),
        parseFloatField(riskInputs.lng, Number(DEFAULT_RISK_POINT.lng)),
        parseFloatField(riskInputs.radius, Number(DEFAULT_RISK_POINT.radius))
      );
      setHazardBlendRisk(risk);
    } catch (error) {
      setRiskProbeError(getErrorMessage(error));
    } finally {
      setRiskProbeLoading(false);
    }
  }

  async function submitAsyncRouteJob() {
    setRouteJobLoading(true);
    setRouteJobError(null);
    try {
      const queued = await routingService.submitSafePathJob({
        start: {
          x: parseFloatField(routeInputs.startLng, Number(DEFAULT_ROUTE.startLng)),
          y: parseFloatField(routeInputs.startLat, Number(DEFAULT_ROUTE.startLat)),
        },
        end: {
          x: parseFloatField(routeInputs.endLng, Number(DEFAULT_ROUTE.endLng)),
          y: parseFloatField(routeInputs.endLat, Number(DEFAULT_ROUTE.endLat)),
        },
        safetyWeight: 0.7,
        profile: 'manual-wheelchair',
        preferences: ['avoid_hazards', 'wheelchair_accessible'],
      });

      const jobId = queued.jobId ?? '';
      setRouteJobId(jobId);
      setRouteJob({
        jobId: jobId || 'queued',
        status: queued.status ?? 'pending',
        route: queued.route ?? null,
        options: queued.options ?? null,
        error: null,
      });
    } catch (error) {
      setRouteJobError(getErrorMessage(error));
    } finally {
      setRouteJobLoading(false);
    }
  }

  async function pollAsyncRouteJob() {
    const jobId = routeJobId.trim();
    if (!jobId) {
      Alert.alert('Job required', 'Submit an async route job first.');
      return;
    }

    setRouteJobLoading(true);
    setRouteJobError(null);
    try {
      const job = await routingService.getRouteJob(jobId);
      setRouteJob(job);
    } catch (error) {
      setRouteJobError(getErrorMessage(error));
    } finally {
      setRouteJobLoading(false);
    }
  }

  async function loadAccessibilityAsset() {
    const id = parseInteger(assetId, 0);
    if (!id) {
      Alert.alert('Asset required', 'Enter a numeric infrastructure asset id.');
      return;
    }

    setAccessibilityLoading(true);
    setAccessibilityError(null);
    setAccessibilityActionMessage(null);
    const [profileResult, submissionsResult, reviewResult] = await Promise.allSettled([
      spatialService.getAccessibilityProfile(id),
      spatialService.getAccessibilityVerifications(id),
      aiAssistService.getAccessibilityReview(id),
    ]);

    const errors = [profileResult, submissionsResult, reviewResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => getErrorMessage(result.reason));

    setAssetProfile(profileResult.status === 'fulfilled' ? profileResult.value : null);
    setVerificationSubmissions(submissionsResult.status === 'fulfilled' ? submissionsResult.value : []);
    setAiReview(reviewResult.status === 'fulfilled' ? reviewResult.value : null);
    setAccessibilityError(errors.length ? errors.join('\n') : null);
    setAccessibilityLoading(false);
  }

  async function generateAccessibilityCandidates() {
    const id = parseInteger(assetId, 0);
    if (!id || !observationText.trim()) {
      Alert.alert('Observation required', 'Enter an asset id and a field observation.');
      return;
    }

    setAccessibilityLoading(true);
    setAccessibilityError(null);
    setAccessibilityActionMessage(null);
    try {
      const result = await aiAssistService.generateAccessibilityCandidates(id, {
        observationText,
        includeDraftVerification: true,
      });
      setAiCandidates(result);
    } catch (error) {
      setAccessibilityError(getErrorMessage(error));
    } finally {
      setAccessibilityLoading(false);
    }
  }

  async function submitAccessibilityVerification() {
    const id = parseInteger(assetId, 0);
    if (!id) {
      Alert.alert('Asset required', 'Enter a numeric infrastructure asset id.');
      return;
    }

    setAccessibilityLoading(true);
    setAccessibilityError(null);
    setAccessibilityActionMessage(null);
    try {
      const draft = aiCandidates?.draftVerification;
      const request = draft && typeof draft === 'object'
        ? {
            ...(draft as Record<string, unknown>),
            notes: observationText.trim() || (draft as { notes?: string }).notes,
          }
        : {
            observedAtUtc: new Date().toISOString(),
            source: 'field_report',
            notes: observationText.trim(),
            path: {
              surface: 'paved',
              smoothness: 'good',
              widthMetres: 1.8,
              hasStepFreeAccess: true,
              hasStairs: false,
              hasBarrier: false,
              wheelchairAccess: 'yes',
            },
          };

      const response = await spatialService.submitAccessibilityVerification(id, request);
      setVerificationSubmissions((current) => [response, ...current]);
      const submittedId = String((response as { id?: unknown }).id ?? '');
      if (submittedId) {
        setVerificationId(submittedId);
      }
      setAccessibilityActionMessage(`Submitted verification ${submittedId || 'for review'}.`);
    } catch (error) {
      setAccessibilityError(getErrorMessage(error));
    } finally {
      setAccessibilityLoading(false);
    }
  }

  async function reviewVerification(action: 'apply' | 'reject') {
    const submissionId = verificationId.trim();
    if (!submissionId) {
      Alert.alert('Submission required', 'Paste a verification submission id first.');
      return;
    }

    setAccessibilityLoading(true);
    setAccessibilityError(null);
    setAccessibilityActionMessage(null);
    try {
      const response = action === 'apply'
        ? await adminAccessibilityService.applyVerification(submissionId, { notes: reviewNotes })
        : await adminAccessibilityService.rejectVerification(submissionId, { notes: reviewNotes });
      setAccessibilityActionMessage(`${action === 'apply' ? 'Applied' : 'Rejected'} submission ${String((response as { id?: unknown }).id ?? submissionId)}.`);
    } catch (error) {
      setAccessibilityError(getErrorMessage(error));
    } finally {
      setAccessibilityLoading(false);
    }
  }

  const summary = overview.summary;
  const integrations = overview.integrations;
  const routeGraphRecord = overview.routeGraphStatus as Record<string, unknown> | null;
  const routeGraphStatusText = stringifyPreview(overview.routeGraphStatus, 520);
  const sourceNodes = getRecordValue(routeGraphRecord, ['routeNodeCount', 'nodeCount', 'sourceNodeCount', 'nodes']);
  const sourceEdges = getRecordValue(routeGraphRecord, ['routeEdgeCount', 'edgeCount', 'sourceEdgeCount', 'edges']);
  const sourceShards = getRecordValue(routeGraphRecord, ['routeShardCount', 'shardCount', 'sourceShardCount', 'persistedShardArtifactCount']);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={AppTheme.color.text} />
          </TouchableOpacity>
          <Text style={styles.topBarText}>Operations</Text>
        </View>

        <View style={styles.opsHero}>
          <View style={styles.opsHeroCopy}>
            <Text style={styles.opsEyebrow}>AccessCity Ops</Text>
            <Text style={styles.opsTitle}>System Operations</Text>
          </View>
          <View style={styles.opsHeroActions}>
            <View style={styles.opsStatusPill}>
              <View style={styles.opsStatusDot} />
              <Text style={styles.opsStatusText}>
                {overviewState === 'error' ? 'Review needed' : 'All systems operational'}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.refreshButton}
              onPress={() => void loadOverview()}
            >
              {overviewState === 'loading' ? (
                <ActivityIndicator size="small" color={AppTheme.color.text} />
              ) : (
                <Ionicons name="refresh-outline" size={16} color={AppTheme.color.text} />
              )}
              <Text style={styles.refreshButtonText}>Last 24h</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Section
          title="Backend Overview"
          subtitle="Dashboard, integrations, and route graph status"
          icon="pulse-outline"
        >
          <ErrorBanner message={overview.error} />
          <View style={styles.metricsGrid}>
            <Metric label="Total hazards" value={formatNumber(summary?.totalHazards)} />
            <Metric label="Pending alerts" value={formatNumber(summary?.pendingAlerts)} tone="warn" />
            <Metric label="Resolved" value={formatNumber(summary?.resolved)} tone="good" />
            <Metric label="Active users" value={formatNumber(summary?.activeUsers)} />
            <Metric label="Heatmap features" value={formatNumber(overview.heatMapFeatureCount)} />
            <Metric label="Feed items" value={formatNumber(overview.feed.length)} />
            <Metric label="Graph nodes" value={typeof sourceNodes === 'number' ? formatNumber(sourceNodes) : '-'} />
            <Metric label="Graph edges" value={typeof sourceEdges === 'number' ? formatNumber(sourceEdges) : '-'} />
            <Metric label="Graph shards" value={typeof sourceShards === 'number' ? formatNumber(sourceShards) : '-'} />
          </View>
          <Text style={styles.previewLabel}>Route graph status</Text>
          <Text style={styles.codePreview}>{routeGraphStatusText}</Text>
        </Section>

        <Section
          title="External Integrations"
          subtitle="Shows configured providers without making extra live outbound probes"
          icon="git-network-outline"
        >
          {integrations ? (
            <>
              <View style={styles.statusGrid}>
                <StatusPill
                  label={`OpenWeather ${integrations.openWeatherApiKeyConfigured ? 'configured' : 'fallback'}`}
                  tone={integrations.openWeatherApiKeyConfigured ? 'good' : 'warn'}
                />
                <StatusPill
                  label={`Google Places ${integrations.googlePlacesApiKeyConfigured ? 'configured' : 'fallback'}`}
                  tone={integrations.googlePlacesApiKeyConfigured ? 'good' : 'warn'}
                />
                <StatusPill
                  label={`Nominatim ${integrations.nominatimConfigured ? 'ready' : 'missing'}`}
                  tone={integrations.nominatimConfigured ? 'good' : 'bad'}
                />
                <StatusPill
                  label={integrations.osrmUsesPublicDemo ? 'Public OSRM host' : 'OSRM private host'}
                  tone={integrations.osrmUsesPublicDemo ? 'warn' : 'good'}
                />
                <StatusPill
                  label={`Police API ${integrations.ukPoliceDataPublicApi ? 'public' : 'missing'}`}
                  tone={integrations.ukPoliceDataPublicApi ? 'good' : 'bad'}
                />
              </View>
              <Text style={styles.previewLabel}>Overpass</Text>
              <Text style={styles.bodyText}>{integrations.overpassEndpoint}</Text>
              <Text style={styles.previewLabel}>Notes</Text>
              <Text style={styles.bodyText}>{integrations.notes}</Text>
            </>
          ) : (
            <Text style={styles.bodyText}>Integration status has not loaded yet.</Text>
          )}
        </Section>

        <Section
          title="OSM Import Job"
          subtitle="Queue production import through the worker path and poll status"
          icon="cloud-upload-outline"
        >
          <ErrorBanner message={osmError} />
          <View style={styles.buttonRow}>
            <ActionButton
              label="Queue import"
              icon="play-outline"
              loading={osmLoading && !osmJob}
              onPress={() => void queueOsmJob()}
            />
            <ActionButton
              label="Refresh job"
              icon="sync-outline"
              secondary
              disabled={!osmJob?.jobId}
              loading={osmLoading && Boolean(osmJob)}
              onPress={() => void refreshOsmJob()}
            />
            <ActionButton
              label="Run sync import"
              icon="flash-outline"
              secondary
              loading={osmSyncLoading}
              onPress={() => void runSyncOsmImport()}
            />
          </View>
          {osmJob ? (
            <View style={styles.detailRows}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <StatusPill label={osmJob.status} tone={isTerminalJob(osmJob) ? 'good' : 'warn'} />
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Job id</Text>
                <Text style={styles.detailValue}>{osmJob.jobId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Queued</Text>
                <Text style={styles.detailValue}>{compactDate(osmJob.queuedAtUtc)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Finished</Text>
                <Text style={styles.detailValue}>{compactDate(osmJob.finishedAtUtc)}</Text>
              </View>
              {osmJob.errorSummary ? <ErrorBanner message={osmJob.errorSummary} /> : null}
            </View>
          ) : (
            <Text style={styles.bodyText}>No import job queued from this session yet.</Text>
          )}
          <Text style={styles.previewLabel}>Sync import preview</Text>
          <Text style={styles.codePreview}>{stringifyPreview(osmSyncResult, 420)}</Text>
        </Section>

        <Section
          title="Route Graph Profile"
          subtitle="Measures shard reuse, artifact payloads, hot load, cold load, pack, and unpack time"
          icon="analytics-outline"
        >
          <ErrorBanner message={routeProfileError} />
          <View style={styles.buttonRow}>
            <ActionButton
              label="Run route graph profile"
              icon="speedometer-outline"
              loading={routeProfileLoading}
              onPress={() => void runRouteGraphProfile()}
            />
          </View>
          {routeProfile ? (
            <>
              <View style={styles.statusGrid}>
                <StatusPill
                  label={routeProfile.qualityGatePassed ? 'Quality gate passed' : 'Quality gate warnings'}
                  tone={routeProfile.qualityGatePassed ? 'good' : 'warn'}
                />
                <StatusPill
                  label={routeProfile.preprocessingAlgorithm || 'No preprocessing label'}
                  tone={routeProfile.preprocessingAlgorithm ? 'good' : 'neutral'}
                />
              </View>
              <View style={styles.metricsGrid}>
                <Metric label="Source nodes" value={formatNumber(routeProfile.sourceNodeCount)} />
                <Metric label="Source edges" value={formatNumber(routeProfile.sourceEdgeCount)} />
                <Metric label="Source shards" value={formatNumber(routeProfile.sourceShardCount)} />
                <Metric label="Shard reuse" value={formatPercent(routeProfile.shardReuseRatio)} />
                <Metric label="Max Redis payload" value={formatBytes(routeProfile.maxRedisPayloadBytes)} />
                <Metric label="Max artifact" value={formatBytes(routeProfile.maxArtifactBytes)} />
                <Metric label="Max cold load" value={formatMs(routeProfile.maxColdLoadMilliseconds)} />
                <Metric label="P95 hot load" value={formatMs(routeProfile.p95HotLoadMilliseconds)} />
                <Metric label="Max pack" value={formatMs(routeProfile.maxArtifactPackMilliseconds)} />
                <Metric label="Max unpack" value={formatMs(routeProfile.maxArtifactUnpackMilliseconds)} />
              </View>
              {routeProfile.qualityGateWarnings.length ? (
                <>
                  <Text style={styles.previewLabel}>Warnings</Text>
                  {routeProfile.qualityGateWarnings.map((warning) => (
                    <Text key={warning} style={styles.listItem}>- {warning}</Text>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.bodyText}>Run the profiler after imports or artifact changes to expose routing bottlenecks.</Text>
          )}
        </Section>

        <Section
          title="Routing API Probe"
          subtitle="Exercise async route jobs and the hazard blend risk model without blocking the UI"
          icon="navigate-outline"
        >
          <View style={styles.formGrid}>
            <Field label="Risk lat" value={riskInputs.lat} onChangeText={(lat) => setRiskInputs((current) => ({ ...current, lat }))} />
            <Field label="Risk lng" value={riskInputs.lng} onChangeText={(lng) => setRiskInputs((current) => ({ ...current, lng }))} />
            <Field label="Risk radius" value={riskInputs.radius} onChangeText={(radius) => setRiskInputs((current) => ({ ...current, radius }))} />
          </View>
          <ErrorBanner message={riskProbeError} />
          <View style={styles.buttonRow}>
            <ActionButton
              label="Load blend risk"
              icon="shield-checkmark-outline"
              loading={riskProbeLoading}
              onPress={() => void loadHazardBlendRisk()}
            />
          </View>
          <View style={styles.metricsGrid}>
            <Metric
              label="Blend overall risk"
              value={typeof hazardBlendRisk?.overallRisk === 'number' ? hazardBlendRisk.overallRisk.toFixed(3) : '-'}
              tone={typeof hazardBlendRisk?.overallRisk === 'number' && hazardBlendRisk.overallRisk > 0.6 ? 'warn' : 'neutral'}
            />
            <Metric label="Blend factors" value={formatNumber(hazardBlendRisk?.riskFactors?.length ?? null)} />
            <Metric label="Hazard risk" value={typeof hazardBlendRisk?.hazardRisk === 'number' ? hazardBlendRisk.hazardRisk.toFixed(3) : '-'} />
            <Metric label="Weather risk" value={typeof hazardBlendRisk?.weatherRisk === 'number' ? hazardBlendRisk.weatherRisk.toFixed(3) : '-'} />
          </View>

          <View style={styles.formGrid}>
            <Field label="Start lat" value={routeInputs.startLat} onChangeText={(startLat) => setRouteInputs((current) => ({ ...current, startLat }))} />
            <Field label="Start lng" value={routeInputs.startLng} onChangeText={(startLng) => setRouteInputs((current) => ({ ...current, startLng }))} />
            <Field label="End lat" value={routeInputs.endLat} onChangeText={(endLat) => setRouteInputs((current) => ({ ...current, endLat }))} />
            <Field label="End lng" value={routeInputs.endLng} onChangeText={(endLng) => setRouteInputs((current) => ({ ...current, endLng }))} />
            <Field label="Route job id" value={routeJobId} onChangeText={setRouteJobId} placeholder="Async job id" />
          </View>
          <ErrorBanner message={routeJobError} />
          <View style={styles.buttonRow}>
            <ActionButton
              label="Submit async route"
              icon="paper-plane-outline"
              loading={routeJobLoading && !routeJob}
              onPress={() => void submitAsyncRouteJob()}
            />
            <ActionButton
              label="Poll route job"
              icon="sync-outline"
              secondary
              disabled={!routeJobId.trim()}
              loading={routeJobLoading && Boolean(routeJob)}
              onPress={() => void pollAsyncRouteJob()}
            />
          </View>
          <Text style={styles.previewLabel}>Route job preview</Text>
          <Text style={styles.codePreview}>{stringifyPreview(routeJob, 520)}</Text>
        </Section>

        <Section
          title="Tile And Offline Cache"
          subtitle="Probe vector tile generation, map overlays, and offline bundle payload shape"
          icon="map-outline"
        >
          <View style={styles.formGrid}>
            <Field label="Tile z" value={tileInputs.z} onChangeText={(z) => setTileInputs((current) => ({ ...current, z }))} />
            <Field label="Tile x" value={tileInputs.x} onChangeText={(x) => setTileInputs((current) => ({ ...current, x }))} />
            <Field label="Tile y" value={tileInputs.y} onChangeText={(y) => setTileInputs((current) => ({ ...current, y }))} />
          </View>
          <ErrorBanner message={tileError} />
          <View style={styles.buttonRow}>
            <ActionButton
              label="Profile tile"
              icon="layers-outline"
              loading={tileLoading}
              onPress={() => void runTileProfile()}
            />
          </View>
          {tileProfile ? (
            <View style={styles.metricsGrid}>
              <Metric label="Hazards" value={formatNumber(tileProfile.hazardCount)} />
              <Metric label="Tile bytes" value={formatBytes(tileProfile.bytes)} />
              <Metric label="Lookup" value={formatMs(tileProfile.lookupMilliseconds)} />
              <Metric label="Encode" value={formatMs(tileProfile.encodeMilliseconds)} />
              <Metric label="Total" value={formatMs(tileProfile.totalMilliseconds)} />
              <Metric label="Cache" value={tileProfile.cacheHit ? 'Hit' : 'Miss'} tone={tileProfile.cacheHit ? 'good' : 'warn'} />
            </View>
          ) : null}

          <Field label="Overlay layer" value={overlayLayer} onChangeText={setOverlayLayer} placeholder="hazards or infrastructure" />
          <ErrorBanner message={overlayError} />
          <View style={styles.buttonRow}>
            <ActionButton
              label="Load map overlay"
              icon="map-outline"
              secondary
              loading={overlayLoading}
              onPress={() => void loadMapOverlay()}
            />
          </View>
          <View style={styles.metricsGrid}>
            <Metric label="Overlay features" value={formatNumber(mapOverlay?.features?.length ?? null)} />
            <Metric label="Overlay layer" value={mapOverlay?.layer ?? '-'} />
          </View>
          <Text style={styles.previewLabel}>Overlay preview</Text>
          <Text style={styles.codePreview}>{stringifyPreview(mapOverlay, 420)}</Text>

          <View style={styles.formGrid}>
            <Field label="Min lat" value={bboxInputs.minLat} onChangeText={(minLat) => setBboxInputs((current) => ({ ...current, minLat }))} />
            <Field label="Min lng" value={bboxInputs.minLng} onChangeText={(minLng) => setBboxInputs((current) => ({ ...current, minLng }))} />
            <Field label="Max lat" value={bboxInputs.maxLat} onChangeText={(maxLat) => setBboxInputs((current) => ({ ...current, maxLat }))} />
            <Field label="Max lng" value={bboxInputs.maxLng} onChangeText={(maxLng) => setBboxInputs((current) => ({ ...current, maxLng }))} />
          </View>
          <ErrorBanner message={offlineError} />
          <View style={styles.buttonRow}>
            <ActionButton
              label="Load offline bundle"
              icon="download-outline"
              secondary
              loading={offlineLoading}
              onPress={() => void loadOfflineBundle()}
            />
          </View>
          <Text style={styles.previewLabel}>Bundle preview</Text>
          <Text style={styles.codePreview}>{stringifyPreview(offlineBundlePreview)}</Text>
        </Section>

        <Section
          title="Accessibility Review"
          subtitle="Inspect asset profiles, AI candidate suggestions, and reviewed verification submissions"
          icon="accessibility-outline"
        >
          <ErrorBanner message={accessibilityError} />
          {accessibilityActionMessage ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={18} color={AppTheme.color.success} />
              <Text style={styles.successText}>{accessibilityActionMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formGrid}>
            <Field label="Asset id" value={assetId} onChangeText={setAssetId} />
            <Field label="Submission id" value={verificationId} onChangeText={setVerificationId} placeholder="Verification GUID" />
          </View>
          <Field label="Review notes" value={reviewNotes} onChangeText={setReviewNotes} placeholder="Reviewer decision notes" multiline />
          <Field label="Field observation" value={observationText} onChangeText={setObservationText} multiline />

          <View style={styles.buttonRow}>
            <ActionButton
              label="Load asset"
              icon="search-outline"
              loading={accessibilityLoading}
              onPress={() => void loadAccessibilityAsset()}
            />
            <ActionButton
              label="AI candidates"
              icon="sparkles-outline"
              secondary
              loading={accessibilityLoading}
              onPress={() => void generateAccessibilityCandidates()}
            />
            <ActionButton
              label="Submit verification"
              icon="cloud-upload-outline"
              secondary
              loading={accessibilityLoading}
              onPress={() => void submitAccessibilityVerification()}
            />
          </View>
          <View style={styles.buttonRow}>
            <ActionButton
              label="Apply"
              icon="checkmark-outline"
              secondary
              loading={accessibilityLoading}
              onPress={() => void reviewVerification('apply')}
            />
            <ActionButton
              label="Reject"
              icon="close-outline"
              secondary
              loading={accessibilityLoading}
              onPress={() => void reviewVerification('reject')}
            />
          </View>

          <View style={styles.metricsGrid}>
            <Metric label="Profile loaded" value={assetProfile ? 'Yes' : 'No'} tone={assetProfile ? 'good' : 'neutral'} />
            <Metric label="Submissions" value={formatNumber(verificationSubmissions.length)} />
            <Metric label="AI review candidates" value={formatNumber(aiReview?.missingAttributeCandidates.length ?? null)} />
            <Metric label="Generated candidates" value={formatNumber(aiCandidates?.attributeCandidates.length ?? null)} />
          </View>

          <Text style={styles.previewLabel}>AI review summary</Text>
          <Text style={styles.bodyText}>{aiReview?.adminSummary ?? 'No AI review loaded yet.'}</Text>
          <Text style={styles.previewLabel}>Generated candidate preview</Text>
          <Text style={styles.codePreview}>{stringifyPreview(aiCandidates, 520)}</Text>
        </Section>

        <View style={styles.bottomSpacer}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={AppTheme.color.textSubtle} />
          <Text style={styles.footerText}>
            Operations actions call the same production endpoints used by workers and admin workflows.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: AppTheme.layout.adminContentWidth,
    alignSelf: 'center',
    paddingHorizontal: AppTheme.space.xl,
    paddingTop: AppTheme.space.xl,
    paddingBottom: 42,
    gap: AppTheme.space.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.space.md,
    paddingHorizontal: 2,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: AppTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.color.surfaceMuted,
  },
  topBarText: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  opsHero: {
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: AppTheme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppTheme.space.lg,
    ...AppTheme.shadow.card,
  },
  opsHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  opsEyebrow: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
  },
  opsTitle: {
    marginTop: 2,
    color: AppTheme.color.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: 0,
  },
  opsHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.space.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  opsStatusPill: {
    minHeight: 36,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppTheme.color.accentSoft,
    borderWidth: 1,
    borderColor: '#B8DCB6',
  },
  opsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.color.success,
  },
  opsStatusText: {
    color: AppTheme.color.success,
    ...AppTheme.type.label,
  },
  refreshButton: {
    minHeight: 36,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: AppTheme.color.surface,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
  },
  refreshButtonText: {
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  section: {
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    padding: AppTheme.space.lg,
    ...AppTheme.shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AppTheme.space.lg,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: AppTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.color.primarySoft,
    marginRight: AppTheme.space.md,
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.sectionTitle,
  },
  sectionSubtitle: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.body,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppTheme.space.sm,
  },
  metric: {
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '22%',
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: AppTheme.space.md,
    paddingVertical: AppTheme.space.md,
  },
  metric_neutral: {
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderColor: AppTheme.color.border,
  },
  metric_good: {
    backgroundColor: AppTheme.color.successSoft,
    borderColor: '#86EFAC',
  },
  metric_warn: {
    backgroundColor: AppTheme.color.warningSoft,
    borderColor: '#FCD34D',
  },
  metric_bad: {
    backgroundColor: AppTheme.color.dangerSoft,
    borderColor: '#FDBA9C',
  },
  metricValue: {
    color: AppTheme.color.text,
    ...AppTheme.type.sectionTitle,
  },
  metricLabel: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
    marginTop: AppTheme.space.xs,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppTheme.space.sm,
    marginBottom: AppTheme.space.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: AppTheme.space.md,
    minHeight: 34,
  },
  status_good: {
    backgroundColor: AppTheme.color.successSoft,
    borderColor: '#86EFAC',
  },
  status_warn: {
    backgroundColor: AppTheme.color.warningSoft,
    borderColor: '#FCD34D',
  },
  status_bad: {
    backgroundColor: AppTheme.color.dangerSoft,
    borderColor: '#FDBA9C',
  },
  status_neutral: {
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderColor: AppTheme.color.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDot_good: {
    backgroundColor: AppTheme.color.success,
  },
  statusDot_warn: {
    backgroundColor: AppTheme.color.warning,
  },
  statusDot_bad: {
    backgroundColor: AppTheme.color.danger,
  },
  statusDot_neutral: {
    backgroundColor: AppTheme.color.textSubtle,
  },
  statusText: {
    color: AppTheme.color.text,
    ...AppTheme.type.meta,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppTheme.space.sm,
    marginBottom: AppTheme.space.md,
  },
  actionButton: {
    minHeight: AppTheme.layout.minTouchTarget,
    borderRadius: AppTheme.radius.md,
    paddingHorizontal: AppTheme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppTheme.space.sm,
    minWidth: 170,
  },
  actionButtonPrimary: {
    backgroundColor: AppTheme.color.primary,
  },
  actionButtonSecondary: {
    backgroundColor: AppTheme.color.primarySoft,
    borderWidth: 1,
    borderColor: AppTheme.color.primaryMuted,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.cardTitle,
  },
  actionButtonTextSecondary: {
    color: AppTheme.color.primary,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppTheme.space.md,
    marginBottom: AppTheme.space.md,
  },
  field: {
    minWidth: 180,
    flexGrow: 1,
    flexBasis: '22%',
  },
  fieldLabel: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
    marginBottom: AppTheme.space.xs,
  },
  input: {
    minHeight: AppTheme.layout.minTouchTarget,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surfaceSubtle,
    paddingHorizontal: AppTheme.space.md,
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: AppTheme.space.md,
    textAlignVertical: 'top',
  },
  detailRows: {
    gap: AppTheme.space.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppTheme.space.md,
    borderTopWidth: 1,
    borderTopColor: AppTheme.color.border,
    paddingTop: AppTheme.space.sm,
  },
  detailLabel: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
  previewLabel: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
    marginTop: AppTheme.space.md,
    marginBottom: AppTheme.space.xs,
  },
  codePreview: {
    color: AppTheme.color.text,
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderColor: AppTheme.color.border,
    borderWidth: 1,
    borderRadius: AppTheme.radius.md,
    padding: AppTheme.space.md,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  bodyText: {
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
  listItem: {
    color: AppTheme.color.text,
    ...AppTheme.type.body,
    marginBottom: 3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppTheme.space.sm,
    borderWidth: 1,
    borderColor: '#FDBA9C',
    backgroundColor: AppTheme.color.dangerSoft,
    borderRadius: AppTheme.radius.md,
    padding: AppTheme.space.md,
    marginBottom: AppTheme.space.md,
  },
  errorText: {
    flex: 1,
    color: AppTheme.color.danger,
    ...AppTheme.type.body,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.space.sm,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: AppTheme.color.successSoft,
    borderRadius: AppTheme.radius.md,
    padding: AppTheme.space.md,
    marginBottom: AppTheme.space.md,
  },
  successText: {
    flex: 1,
    color: AppTheme.color.success,
    ...AppTheme.type.body,
  },
  bottomSpacer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppTheme.space.sm,
    paddingVertical: AppTheme.space.lg,
  },
  footerText: {
    color: AppTheme.color.textSubtle,
    ...AppTheme.type.meta,
    textAlign: 'center',
  },
});
