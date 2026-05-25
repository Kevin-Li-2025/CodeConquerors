import { api } from '@/services/api';
import { spatialService } from '@/services/spatial.service';

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('spatialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads map overlays by layer name', async () => {
    jest.mocked(api.get).mockResolvedValue({
      type: 'FeatureCollection',
      layer: 'hazards',
      features: [],
    } as never);

    await spatialService.getMapOverlay('hazards');

    expect(api.get).toHaveBeenCalledWith('/spatial/map-overlay?layerName=hazards', {
      skipAuth: true,
    });
  });

  it('submits field accessibility verification payloads', async () => {
    const request = {
      source: 'field_report',
      notes: 'Smooth pavement and step-free entrance.',
      path: {
        surface: 'paved',
        hasStepFreeAccess: true,
      },
    };
    jest.mocked(api.post).mockResolvedValue({ id: 'submission-1' } as never);

    await spatialService.submitAccessibilityVerification(123, request);

    expect(api.post).toHaveBeenCalledWith(
      '/spatial/infrastructure/123/accessibility-verifications',
      request
    );
  });
});
