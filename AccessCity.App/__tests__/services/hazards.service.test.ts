import { hazardsService } from '@/services/hazards.service';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const validBackendHazard = {
  id: '1',
  type: 'steps',
  description: 'Steep stairs.',
  status: 0,
  location: { coordinates: [-1.895, 52.481] },
  reportedAt: '2025-01-15T12:00:00.000Z',
};

describe('hazardsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getHazards maps backend items to app model', async () => {
    jest.mocked(api.get).mockResolvedValue([validBackendHazard]);

    const list = await hazardsService.getHazards();

    expect(list).toHaveLength(1);
    expect(list[0].latitude).toBe(52.481);
    expect(list[0].longitude).toBe(-1.895);
  });

  it('getHazards returns empty array when response is not an array', async () => {
    jest.mocked(api.get).mockResolvedValue({} as never);

    await expect(hazardsService.getHazards()).resolves.toEqual([]);
  });

  it('reportHazard posts GeoJSON location', async () => {
    jest.mocked(api.post).mockResolvedValue(validBackendHazard as never);

    await hazardsService.reportHazard({
      latitude: 52.48,
      longitude: -1.89,
      type: 'broken_pavement',
      description: 'Crack near curb',
    });

    expect(api.post).toHaveBeenCalledWith('/hazards', {
      type: 'broken_pavement',
      description: 'Crack near curb',
      photoUrl: '',
      location: {
        type: 'Point',
        coordinates: [-1.89, 52.48],
      },
    });
  });

  it('getHazardById returns null when request fails', async () => {
    jest.mocked(api.get).mockRejectedValue(new Error('network'));

    await expect(hazardsService.getHazardById('99')).resolves.toBeNull();
  });

  it('getHazardById maps single hazard with skipAuth', async () => {
    jest.mocked(api.get).mockResolvedValue(validBackendHazard as never);

    const hazard = await hazardsService.getHazardById('1');

    expect(api.get).toHaveBeenCalledWith('/hazards/1', { skipAuth: true });
    expect(hazard).not.toBeNull();
    expect(hazard!.id).toBe('1');
  });
});
