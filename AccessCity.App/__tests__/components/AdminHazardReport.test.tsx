import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AdminHazardReport from '@/components/MapView/AdminHazardReport';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('AdminHazardReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when no pending hazards', async () => {
    jest.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/hazards') return [];
      if (path === '/dashboard/summary') return { pendingAlerts: 0 };
      return {};
    });

    const { findByText } = render(<AdminHazardReport />);

    expect(await findByText('No pending reports')).toBeTruthy();
  });

  it('lists pending reports and opens details', async () => {
    jest.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/hazards') {
        return [
          {
            id: 'h1',
            status: 'reported',
            type: 'Lighting',
            title: 'Dark alley',
            locationName: 'Main St',
            reportedAt: new Date().toISOString(),
            reporterName: 'Alex',
          },
        ];
      }
      if (path === '/hazards/h1') {
        return {
          id: 'h1',
          category: 'Lighting',
          status: 'pending',
          title: 'Dark alley',
          description: 'No lights.',
          locationName: 'Main St',
          createdAt: new Date().toISOString(),
          reporter: { name: 'Alex', email: 'a@b.com', verified: false },
        };
      }
      if (path === '/dashboard/summary') return { pendingAlerts: 1 };
      return {};
    });

    const { findByText, getByText } = render(<AdminHazardReport />);

    expect(await findByText('Dark alley')).toBeTruthy();
    fireEvent.press(getByText('Dark alley'));

    expect(await findByText('Report Details')).toBeTruthy();
    expect(await findByText('Review Report')).toBeTruthy();
  });

  it('submits approve decision and shows success', async () => {
    jest.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/hazards') {
        return [
          {
            id: 'h1',
            status: 'underreview',
            type: 'Obstruction',
            title: 'Blocked path',
            locationName: 'Side Rd',
            reportedAt: new Date().toISOString(),
          },
        ];
      }
      if (path === '/hazards/h1') {
        return {
          id: 'h1',
          category: 'Obstruction',
          status: 'pending',
          title: 'Blocked path',
          description: 'Barrier.',
          locationName: 'Side Rd',
          createdAt: new Date().toISOString(),
        };
      }
      if (path === '/dashboard/summary') return { pendingAlerts: 1 };
      return {};
    });
    jest.mocked(api.post).mockResolvedValue({});

    const { findByText, getByText } = render(<AdminHazardReport />);

    expect(await findByText('Blocked path')).toBeTruthy();
    fireEvent.press(getByText('Blocked path'));
    expect(await findByText('Review Report')).toBeTruthy();
    fireEvent.press(getByText('Review Report'));

    expect(await findByText('Approve Report')).toBeTruthy();
    fireEvent.press(getByText('Approve Report'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/hazards/h1/review',
        expect.objectContaining({ status: 'approved' }),
      );
    });

    expect(await findByText('Report Approved Successfully')).toBeTruthy();
  });
});
