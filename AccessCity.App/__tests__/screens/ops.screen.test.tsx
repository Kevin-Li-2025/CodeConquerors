import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import OpsScreen from '@/app/(tabs)/ops';
import {
  adminOsmService,
  dashboardService,
  integrationsService,
  tileProfileService,
} from '@/services/system.service';
import { routingService } from '@/services/routing.service';
import { spatialService } from '@/services/spatial.service';
import { aiAssistService } from '@/services/aiAssist.service';

jest.mock('@/services/system.service', () => ({
  adminAccessibilityService: {
    applyVerification: jest.fn(),
    rejectVerification: jest.fn(),
  },
  adminOsmService: {
    runImportNow: jest.fn(),
    queueImportJob: jest.fn(),
    getImportJob: jest.fn(),
    profileRouteGraph: jest.fn(),
  },
  dashboardService: {
    getSummary: jest.fn(),
    getHeatMap: jest.fn(),
    getInfrastructureFeed: jest.fn(),
  },
  integrationsService: {
    getStatus: jest.fn(),
  },
  tileProfileService: {
    getProfile: jest.fn(),
  },
}));

jest.mock('@/services/routing.service', () => ({
  routingService: {
    getRouteGraphStatus: jest.fn(),
    getHazardBlendRisk: jest.fn(),
    submitSafePathJob: jest.fn(),
    getRouteJob: jest.fn(),
  },
}));

jest.mock('@/services/spatial.service', () => ({
  spatialService: {
    getMapOverlay: jest.fn(),
    getOfflineMapBundle: jest.fn(),
    getAccessibilityProfile: jest.fn(),
    getAccessibilityVerifications: jest.fn(),
    submitAccessibilityVerification: jest.fn(),
  },
}));

jest.mock('@/services/aiAssist.service', () => ({
  aiAssistService: {
    getAccessibilityReview: jest.fn(),
    generateAccessibilityCandidates: jest.fn(),
  },
}));

describe('OpsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dashboardService.getSummary).mockResolvedValue({
      totalHazards: 12,
      activeUsers: 3,
      activeUsersDefinition: 'test users',
      pendingAlerts: 4,
      resolved: 8,
    });
    jest.mocked(dashboardService.getHeatMap).mockResolvedValue({
      type: 'FeatureCollection',
      features: [{}, {}],
    });
    jest.mocked(dashboardService.getInfrastructureFeed).mockResolvedValue([
      {
        id: 'f1',
        type: 'steps',
        description: 'Steps near crossing.',
        status: 'Reported',
        reportedAt: '2026-01-01T00:00:00Z',
        coordinates: [-1.89, 52.48],
      },
    ]);
    jest.mocked(integrationsService.getStatus).mockResolvedValue({
      openWeatherApiKeyConfigured: true,
      googlePlacesApiKeyConfigured: false,
      overpassEndpoint: 'https://overpass.example/api',
      nominatimConfigured: true,
      osrmUsesPublicDemo: true,
      ukPoliceDataPublicApi: true,
      notes: 'test notes',
    });
    jest.mocked(routingService.getRouteGraphStatus).mockResolvedValue({
      nodeCount: 25,
      shardCount: 2,
    });
    jest.mocked(routingService.getHazardBlendRisk).mockResolvedValue({
      overallRisk: 0.42,
      hazardRisk: 0.2,
      weatherRisk: 0.1,
      riskFactors: ['reported hazard density'],
    });
    jest.mocked(routingService.submitSafePathJob).mockResolvedValue({
      jobId: 'route-job-1',
      status: 'pending',
      pollUrl: '/api/v1/routing/jobs/route-job-1',
    });
    jest.mocked(routingService.getRouteJob).mockResolvedValue({
      jobId: 'route-job-1',
      status: 'completed',
      route: { distance: 120 },
    });
    jest.mocked(adminOsmService.queueImportJob).mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
      filePath: 'configured',
      queuedAtUtc: '2026-01-01T00:00:00Z',
      attempts: 0,
    });
    jest.mocked(adminOsmService.runImportNow).mockResolvedValue({
      importedCount: 7,
    });
    jest.mocked(adminOsmService.profileRouteGraph).mockResolvedValue({
      profiledAtUtc: '2026-01-01T00:00:00Z',
      sourceType: 'route-graph-repository',
      sourceName: 'fixture',
      sourceBuildMilliseconds: 1,
      sourceRecordsSeen: 10,
      sourceNodeCount: 25,
      sourceEdgeCount: 40,
      sourceIsTruncated: false,
      sourceShardCount: 2,
      artifactSchemaVersion: 'packed-route-graph-v3',
      edgeCostVersion: 1,
      edgeWeightVersion: 1,
      preprocessingAlgorithm: 'ALT',
      routeCount: 1,
      totalShardReferences: 2,
      uniqueShardReferences: 2,
      shardReuseRatio: 1,
      totalArtifactBytes: 1024,
      maxArtifactBytes: 1024,
      totalRedisPayloadBytes: 900,
      maxRedisPayloadBytes: 900,
      averageShardReferencesPerRoute: 2,
      maxSourceShardCountPerRoute: 2,
      persistedShardArtifactCount: 2,
      persistedShardArtifactBytes: 1024,
      persistedShardArtifactBuildMilliseconds: 1,
      maxColdLoadMilliseconds: 5,
      maxHotLoadMilliseconds: 1,
      p95HotLoadMilliseconds: 1,
      maxPreprocessingMilliseconds: 2,
      maxArtifactPackMilliseconds: 3,
      maxArtifactStoreReadMilliseconds: 1,
      maxArtifactUnpackMilliseconds: 4,
      p95ArtifactUnpackMilliseconds: 4,
      qualityGatePassed: true,
      qualityGateWarnings: [],
      routes: [],
    });
    jest.mocked(tileProfileService.getProfile).mockResolvedValue({
      z: 14,
      x: 8102,
      y: 5411,
      hazardCount: 2,
      bytes: 2048,
      lookupMilliseconds: 1,
      encodeMilliseconds: 2,
      totalMilliseconds: 3,
      cacheHit: true,
      generatedAt: '2026-01-01T00:00:00Z',
    });
    jest.mocked(spatialService.getMapOverlay).mockResolvedValue({
      type: 'FeatureCollection',
      layer: 'hazards',
      features: [{ id: 'h1' }],
    });
    jest.mocked(spatialService.getOfflineMapBundle).mockResolvedValue({ hazards: [] });
    jest.mocked(spatialService.getAccessibilityProfile).mockResolvedValue({ id: 1 });
    jest.mocked(spatialService.getAccessibilityVerifications).mockResolvedValue([{ id: 'submission-1' }]);
    jest.mocked(spatialService.submitAccessibilityVerification).mockResolvedValue({
      id: 'submission-2',
      status: 'pending',
    });
    jest.mocked(aiAssistService.getAccessibilityReview).mockResolvedValue({
      infrastructureAssetId: 1,
      forRouteDecision: false,
      provider: 'stub',
      generatedAtUtc: '2026-01-01T00:00:00Z',
      adminSummary: 'Looks usable.',
      missingAttributeCandidates: [],
      verificationChecklist: [],
      guardrails: [],
    });
    jest.mocked(aiAssistService.generateAccessibilityCandidates).mockResolvedValue({
      infrastructureAssetId: 1,
      forRouteDecision: false,
      provider: 'stub',
      model: 'stub',
      generatedAtUtc: '2026-01-01T00:00:00Z',
      adminSummary: 'Candidate generated.',
      attributeCandidates: [],
      draftVerification: null,
      guardrails: [],
      limitations: [],
    });
  });

  it('loads overview endpoints on focus', async () => {
    const { findByText } = render(<OpsScreen />);

    expect(await findByText('System Operations')).toBeTruthy();
    expect(await findByText('Total hazards')).toBeTruthy();
    expect(await findByText('12')).toBeTruthy();
    expect(await findByText('OpenWeather configured')).toBeTruthy();

    expect(dashboardService.getSummary).toHaveBeenCalled();
    expect(integrationsService.getStatus).toHaveBeenCalled();
    expect(routingService.getRouteGraphStatus).toHaveBeenCalled();
  });

  it('runs operational actions through service wrappers', async () => {
    const { findByDisplayValue, findByText, getByText } = render(<OpsScreen />);

    await findByText('System Operations');

    fireEvent.press(getByText('Queue import'));
    await waitFor(() => expect(adminOsmService.queueImportJob).toHaveBeenCalled());
    expect(await findByText('job-1')).toBeTruthy();

    fireEvent.press(getByText('Run sync import'));
    await waitFor(() => expect(adminOsmService.runImportNow).toHaveBeenCalled());
    expect(await findByText(/importedCount/)).toBeTruthy();

    fireEvent.press(getByText('Run route graph profile'));
    await waitFor(() => expect(adminOsmService.profileRouteGraph).toHaveBeenCalledWith({
      routes: [],
      hotReadsPerRoute: 3,
    }));
    expect(await findByText('Quality gate passed')).toBeTruthy();

    fireEvent.press(getByText('Profile tile'));
    await waitFor(() => expect(tileProfileService.getProfile).toHaveBeenCalledWith(14, 8102, 5411));

    fireEvent.press(getByText('Load map overlay'));
    await waitFor(() => expect(spatialService.getMapOverlay).toHaveBeenCalledWith('hazards'));

    fireEvent.press(getByText('Load offline bundle'));
    await waitFor(() => expect(spatialService.getOfflineMapBundle).toHaveBeenCalled());

    fireEvent.press(getByText('Load blend risk'));
    await waitFor(() => expect(routingService.getHazardBlendRisk).toHaveBeenCalledWith(52.48, -1.89, 500));
    expect(await findByText('0.420')).toBeTruthy();

    fireEvent.press(getByText('Submit async route'));
    await waitFor(() => expect(routingService.submitSafePathJob).toHaveBeenCalled());
    expect(await findByDisplayValue('route-job-1')).toBeTruthy();

    fireEvent.press(getByText('Poll route job'));
    await waitFor(() => expect(routingService.getRouteJob).toHaveBeenCalledWith('route-job-1'));

    fireEvent.press(getByText('Load asset'));
    await waitFor(() => expect(spatialService.getAccessibilityProfile).toHaveBeenCalledWith(1));

    fireEvent.press(getByText('AI candidates'));
    await waitFor(() => expect(aiAssistService.generateAccessibilityCandidates).toHaveBeenCalled());

    fireEvent.press(getByText('Submit verification'));
    await waitFor(() => expect(spatialService.submitAccessibilityVerification).toHaveBeenCalled());
    expect(await findByText('Submitted verification submission-2.')).toBeTruthy();
  });
});
