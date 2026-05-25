import { api } from './api';

export type DashboardSummary = {
  totalHazards: number;
  activeUsers: number;
  activeUsersDefinition: string;
  pendingAlerts: number;
  resolved: number;
};

export type DashboardHeatMap = {
  type?: string;
  features?: unknown[];
};

export type InfrastructureFeedItem = {
  id: string;
  type: string;
  description: string;
  status: string;
  reportedAt: string;
  coordinates?: number[] | null;
};

export type DashboardInfrastructureFeed = InfrastructureFeedItem[];

export type IntegrationStatus = {
  openWeatherApiKeyConfigured: boolean;
  googlePlacesApiKeyConfigured: boolean;
  overpassEndpoint: string;
  nominatimConfigured: boolean;
  osrmUsesPublicDemo: boolean;
  ukPoliceDataPublicApi: boolean;
  notes: string;
};

export type OsmImportJobResponse = {
  jobId: string;
  status: string;
  filePath: string;
  queuedAtUtc: string;
  startedAtUtc?: string | null;
  finishedAtUtc?: string | null;
  attempts: number;
  feedIngestionRunId?: number | null;
  errorSummary?: string | null;
};

export type OsmImportResult = Record<string, unknown>;

export type RouteGraphProfileRouteRequest = {
  name: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

export type RouteGraphProfileRequest = {
  routes?: RouteGraphProfileRouteRequest[];
  hotReadsPerRoute?: number;
};

export type RouteGraphProfileRouteResult = {
  name: string;
  shardKey?: string | null;
  sourceShardCount: number;
  nodeCount: number;
  edgeCount: number;
  isTruncated: boolean;
  wouldCacheDistributedPayload: boolean;
  hasAltPreprocessing: boolean;
  landmarkCount: number;
  artifactBytes: number;
  redisPayloadBytes: number;
  persistedArtifact: boolean;
  coldLoadMilliseconds: number;
  hotLoadMilliseconds: number;
  preprocessingMilliseconds: number;
  artifactPackMilliseconds: number;
  artifactStoreReadMilliseconds: number;
  artifactUnpackMilliseconds: number;
};

export type RouteGraphProfileResponse = {
  profiledAtUtc: string;
  sourceType: string;
  sourceName?: string | null;
  sourceBuildMilliseconds: number;
  sourceRecordsSeen: number;
  sourceNodeCount: number;
  sourceEdgeCount: number;
  sourceIsTruncated: boolean;
  sourceShardCount: number;
  artifactSchemaVersion: string;
  edgeCostVersion: number;
  edgeWeightVersion: number;
  preprocessingAlgorithm: string;
  routeCount: number;
  totalShardReferences: number;
  uniqueShardReferences: number;
  shardReuseRatio: number;
  totalArtifactBytes: number;
  maxArtifactBytes: number;
  totalRedisPayloadBytes: number;
  maxRedisPayloadBytes: number;
  averageShardReferencesPerRoute: number;
  maxSourceShardCountPerRoute: number;
  persistedShardArtifactCount: number;
  persistedShardArtifactBytes: number;
  persistedShardArtifactBuildMilliseconds: number;
  maxColdLoadMilliseconds: number;
  maxHotLoadMilliseconds: number;
  p95HotLoadMilliseconds: number;
  maxPreprocessingMilliseconds: number;
  maxArtifactPackMilliseconds: number;
  maxArtifactStoreReadMilliseconds: number;
  maxArtifactUnpackMilliseconds: number;
  p95ArtifactUnpackMilliseconds: number;
  qualityGatePassed: boolean;
  qualityGateWarnings: string[];
  routes: RouteGraphProfileRouteResult[];
};

export type MapTileProfile = {
  z: number;
  x: number;
  y: number;
  hazardCount: number;
  bytes: number;
  lookupMilliseconds: number;
  encodeMilliseconds: number;
  totalMilliseconds: number;
  cacheHit: boolean;
  generatedAt: string;
};

export type AccessibilityReviewRequest = { notes?: string };
export type AccessibilityReviewResponse = Record<string, unknown>;

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    return api.get<DashboardSummary>('/dashboard/summary', { skipAuth: true });
  },

  async getHeatMap(): Promise<DashboardHeatMap> {
    return api.get<DashboardHeatMap>('/dashboard/heat-map', { skipAuth: true });
  },

  async getInfrastructureFeed(limit = 20): Promise<DashboardInfrastructureFeed> {
    return api.get<DashboardInfrastructureFeed>(
      `/dashboard/infrastructure-feed?limit=${encodeURIComponent(String(limit))}`,
      { skipAuth: true }
    );
  },
};

export const integrationsService = {
  async getStatus(): Promise<IntegrationStatus> {
    return api.get<IntegrationStatus>('/integrations/status', { skipAuth: true });
  },
};

export const adminOsmService = {
  async runImportNow(): Promise<OsmImportResult> {
    return api.post<OsmImportResult>('/admin/osm/import', {});
  },

  async queueImportJob(): Promise<OsmImportJobResponse> {
    return api.post<OsmImportJobResponse>('/admin/osm/import-jobs', {});
  },

  async getImportJob(jobId: string): Promise<OsmImportJobResponse> {
    return api.get<OsmImportJobResponse>(
      `/admin/osm/import-jobs/${encodeURIComponent(jobId)}`
    );
  },

  async profileRouteGraph(request: RouteGraphProfileRequest): Promise<RouteGraphProfileResponse> {
    return api.post<RouteGraphProfileResponse>('/admin/osm/route-graph/profile', request);
  },
};

export const tileProfileService = {
  async getProfile(z: number, x: number, y: number): Promise<MapTileProfile> {
    return api.get<MapTileProfile>(
      `/tiles/${encodeURIComponent(String(z))}/${encodeURIComponent(String(x))}/${encodeURIComponent(String(y))}/profile`
    );
  },
};

export const adminAccessibilityService = {
  async applyVerification(
    submissionId: string,
    request: AccessibilityReviewRequest = {}
  ): Promise<AccessibilityReviewResponse> {
    return api.post<AccessibilityReviewResponse>(
      `/admin/accessibility-verifications/${encodeURIComponent(submissionId)}/apply`,
      request
    );
  },

  async rejectVerification(
    submissionId: string,
    request: AccessibilityReviewRequest = {}
  ): Promise<AccessibilityReviewResponse> {
    return api.post<AccessibilityReviewResponse>(
      `/admin/accessibility-verifications/${encodeURIComponent(submissionId)}/reject`,
      request
    );
  },
};
