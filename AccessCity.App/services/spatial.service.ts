import { api } from './api';

export type PointOfInterest = {
  id?: string;
  name?: string;
  category?: string;
  location?: any;
  accessibilityTags?: Record<string, string>;
  accessibilityProfile?: Record<string, unknown>;
};

export type MapOverlayResponse = {
  type: string;
  layer: string;
  features: unknown[];
};

export type SafeHavenPlace = {
  id: string;
  name: string;
  types: string[];
  latitude: number;
  longitude: number;
  openNow?: boolean | null;
};

export type SafeHavenNearbyResponse = {
  places: SafeHavenPlace[];
  googlePlacesConfigured: boolean;
  radiusMetres: number;
};

export type OfflineMapBundle = Record<string, unknown>;

export type AccessibilityVerificationRequest = Record<string, unknown>;
export type AccessibilityVerificationResponse = Record<string, unknown>;
export type InfrastructureAccessibilityProfile = Record<string, unknown>;

export const spatialService = {
  async getPointsOfInterest(latitude: number, longitude: number, radius = 1000): Promise<PointOfInterest[]> {
    return api.get<PointOfInterest[]>(
      `/spatial/poi?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}&radius=${encodeURIComponent(String(radius))}`,
      { skipAuth: true }
    );
  },

  async getMapOverlay(layerName: 'hazards' | 'infrastructure' | string): Promise<MapOverlayResponse> {
    return api.get<MapOverlayResponse>(
      `/spatial/map-overlay?layerName=${encodeURIComponent(layerName)}`,
      { skipAuth: true }
    );
  },

  async getAccessibilityProfile(assetId: number): Promise<InfrastructureAccessibilityProfile> {
    return api.get<InfrastructureAccessibilityProfile>(
      `/spatial/infrastructure/${encodeURIComponent(String(assetId))}/accessibility-profile`,
      { skipAuth: true }
    );
  },

  async submitAccessibilityVerification(
    assetId: number,
    request: AccessibilityVerificationRequest
  ): Promise<AccessibilityVerificationResponse> {
    return api.post<AccessibilityVerificationResponse>(
      `/spatial/infrastructure/${encodeURIComponent(String(assetId))}/accessibility-verifications`,
      request
    );
  },

  async getAccessibilityVerifications(assetId: number): Promise<AccessibilityVerificationResponse[]> {
    return api.get<AccessibilityVerificationResponse[]>(
      `/spatial/infrastructure/${encodeURIComponent(String(assetId))}/accessibility-verifications`
    );
  },

  async getNearbySafeHavens(latitude: number, longitude: number, radius = 500): Promise<SafeHavenNearbyResponse> {
    return api.get<SafeHavenNearbyResponse>(
      `/safe-haven/nearby?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}&radius=${encodeURIComponent(String(radius))}`,
      { skipAuth: true }
    );
  },

  async getOfflineMapBundle(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number
  ): Promise<OfflineMapBundle> {
    return api.get<OfflineMapBundle>(
      `/OfflineMap/bundle?minLat=${encodeURIComponent(String(minLat))}&minLng=${encodeURIComponent(String(minLng))}&maxLat=${encodeURIComponent(String(maxLat))}&maxLng=${encodeURIComponent(String(maxLng))}`
    );
  },
};
