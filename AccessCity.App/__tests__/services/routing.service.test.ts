import { api } from '@/services/api';
import { routingService } from '@/services/routing.service';

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const routeRequest = {
  start: { x: -1.9, y: 52.48 },
  end: { x: -1.885, y: 52.486 },
  profile: 'manual-wheelchair',
  safetyWeight: 0.7,
};

describe('routingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits explicit async safe-path jobs', async () => {
    jest.mocked(api.post).mockResolvedValue({
      jobId: 'route-job-1',
      status: 'pending',
    } as never);

    await routingService.submitSafePathJob(routeRequest);

    expect(api.post).toHaveBeenCalledWith('/routing/safe-path/async', routeRequest, {
      skipAuth: true,
    });
  });

  it('polls route jobs by encoded id', async () => {
    jest.mocked(api.get).mockResolvedValue({
      jobId: 'route job/1',
      status: 'completed',
    } as never);

    await routingService.getRouteJob('route job/1');

    expect(api.get).toHaveBeenCalledWith('/routing/jobs/route%20job%2F1', {
      skipAuth: true,
    });
  });

  it('requests hazard blend risk with coordinate query params', async () => {
    jest.mocked(api.get).mockResolvedValue({ overallRisk: 0.4 } as never);

    await routingService.getHazardBlendRisk(52.48, -1.89, 500);

    expect(api.get).toHaveBeenCalledWith(
      '/routing/hazard-blend-risk?lat=52.48&lng=-1.89&radius=500',
      { skipAuth: true }
    );
  });
});
