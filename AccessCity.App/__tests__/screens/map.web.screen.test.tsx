import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/components/MapView', () => function MockMapView(props: any) {
  const { Text, View } = require('react-native');
  return (
    <View>
      <Text>web-map</Text>
      <Text>{props.markers.length} markers</Text>
    </View>
  );
});

jest.mock('@/services/hazards.service', () => ({
  hazardsService: {
    getHazardsPage: jest.fn(),
  },
}));

jest.mock('@/services/routing.service', () => ({
  routingService: {
    getSafePathResolved: jest.fn(),
  },
}));

jest.mock('@/services/geocoding.service', () => ({
  geocodingService: {
    search: jest.fn(),
  },
}));

import MapPageWeb from '@/app/(tabs)/map.web';
import { hazardsService } from '@/services/hazards.service';
import { routingService } from '@/services/routing.service';
import { geocodingService } from '@/services/geocoding.service';

describe('MapPageWeb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(routingService.getSafePathResolved).mockResolvedValue({
      path: { type: 'LineString', coordinates: [[-1.89, 52.48], [-1.88, 52.485]] },
      distance: 1200,
      estimatedTime: 18,
      safetyScore: 0.92,
      warnings: [],
      steps: [{ instruction: 'Head east' }],
    });
  });

  it('loads live hazards into the web map', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValue({
      items: [
        {
          id: 'h1',
          title: 'Blocked pavement',
          type: 'obstruction',
          latitude: 52.4862,
          longitude: -1.8904,
          description: 'Path blocked',
          status: 'Reported',
          locationText: 'Birmingham',
          reportedTime: 'Today',
        },
      ],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    });

    const { getByText } = render(<MapPageWeb />);

    expect(getByText('web-map')).toBeTruthy();
    await waitFor(() => expect(getByText('1 markers')).toBeTruthy());
    expect(getByText('Live')).toBeTruthy();
    expect(getByText('1 city reports')).toBeTruthy();
    expect(getByText('Birmingham')).toBeTruthy();
    await waitFor(() => expect(routingService.getSafePathResolved).toHaveBeenCalled());
    expect(routingService.getSafePathResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: 'manual-wheelchair',
        preferences: expect.arrayContaining(['avoid-reported-hazards', 'prefer-crossings', 'low-light-penalty']),
      }),
    );
    expect(getByText('18 min')).toBeTruthy();
    expect(getByText('1.2 km')).toBeTruthy();
  });

  it('searches a destination and recalculates the route', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValue({
      items: [],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    });
    jest.mocked(geocodingService.search).mockResolvedValue([
      {
        display_name: 'New Street Station, Birmingham',
        lat: '52.4777',
        lon: '-1.8986',
      },
    ]);

    const { getByLabelText, getByText } = render(<MapPageWeb />);

    await waitFor(() => expect(routingService.getSafePathResolved).toHaveBeenCalledTimes(1));
    fireEvent.changeText(getByLabelText('Destination'), 'New Street Station');
    fireEvent.press(getByLabelText('Search destination'));

    await waitFor(() => {
      expect(geocodingService.search).toHaveBeenCalledWith('New Street Station');
      expect(routingService.getSafePathResolved).toHaveBeenCalledTimes(2);
    });
    expect(getByText('New Street Station, Birmingham')).toBeTruthy();
  });

  it('starts and ends web guidance from a loaded route', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValue({
      items: [],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    });

    const { getByText, findByText, queryByText } = render(<MapPageWeb />);

    await waitFor(() => expect(routingService.getSafePathResolved).toHaveBeenCalled());
    fireEvent.press(getByText('Start navigation'));

    expect(await findByText('Navigation active')).toBeTruthy();
    expect(await findByText('Head east')).toBeTruthy();

    fireEvent.press(getByText('End navigation'));
    await waitFor(() => expect(queryByText('Head east')).toBeNull());
  });
});
