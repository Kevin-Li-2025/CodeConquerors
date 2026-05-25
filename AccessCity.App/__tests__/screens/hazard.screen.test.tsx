import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HazardScreen from '@/app/(tabs)/hazard';
import { hazardsService } from '@/services/hazards.service';

jest.mock('@/services/hazards.service', () => ({
  hazardsService: {
    getHazardsPage: jest.fn(() => Promise.resolve({
      items: [],
      nextCursor: null,
      limit: 25,
      hasMore: false,
    })),
    getHazardById: jest.fn(() => Promise.resolve(null)),
  },
}));

describe('HazardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads hazards on focus and shows empty state', async () => {
    const { getByText, findByText } = render(<HazardScreen />);

    expect(getByText('Hazards')).toBeTruthy();

    await waitFor(() => {
      expect(hazardsService.getHazardsPage).toHaveBeenCalled();
    });

    expect(await findByText('No hazards found for this status.')).toBeTruthy();
  });

  it('renders hazard cards when API returns data', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValueOnce({
      items: [
        {
          id: '1',
          title: 'Broken pavement',
          type: 'broken_pavement',
          latitude: 52.48,
          longitude: -1.89,
          description: 'Crack near curb.',
          status: 'Reported',
          locationText: 'Somewhere',
          reportedTime: 'Today',
        },
      ],
      nextCursor: null,
      limit: 25,
      hasMore: false,
    });

    const { findByText } = render(<HazardScreen />);

    expect(await findByText('Broken pavement')).toBeTruthy();
    expect(await findByText('Birmingham, UK reports')).toBeTruthy();
  });

  it('filters visible hazards from the search control', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValueOnce({
      items: [
        {
          id: '1',
          title: 'Broken pavement',
          type: 'broken_pavement',
          latitude: 52.48,
          longitude: -1.89,
          description: 'Crack near curb.',
          status: 'Reported',
          locationText: 'Bristol Road',
          reportedTime: 'Today',
        },
        {
          id: '2',
          title: 'Broken street light',
          type: 'broken_light',
          latitude: 52.49,
          longitude: -1.88,
          description: 'Dark corner.',
          status: 'Reported',
          locationText: 'Selly Oak',
          reportedTime: 'Today',
        },
      ],
      nextCursor: null,
      limit: 25,
      hasMore: false,
    });

    const { findByText, getByLabelText, queryByText } = render(<HazardScreen />);

    expect(await findByText('Broken pavement')).toBeTruthy();
    expect(await findByText('Broken street light')).toBeTruthy();

    fireEvent.press(getByLabelText('Search hazards'));
    fireEvent.changeText(getByLabelText('Search hazards'), 'light');

    await waitFor(() => {
      expect(queryByText('Broken pavement')).toBeNull();
      expect(queryByText('Broken street light')).toBeTruthy();
    });
  });

  it('filter pills switch reported / acknowledged / resolved', async () => {
    const { getByText } = render(<HazardScreen />);

    await waitFor(() => expect(hazardsService.getHazardsPage).toHaveBeenCalled());

    fireEvent.press(getByText('Resolved'));

    await waitFor(() => {
      expect(hazardsService.getHazardsPage).toHaveBeenCalledTimes(2);
    });
  });
});
