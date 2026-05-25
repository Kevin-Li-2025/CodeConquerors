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
    getSafePathOptionsResolved: jest.fn(),
  },
}));

jest.mock('@/services/aiAssist.service', () => ({
  aiAssistService: {
    explainRoute: jest.fn(),
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
import { aiAssistService } from '@/services/aiAssist.service';

describe('MapPageWeb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const route = {
      path: { type: 'LineString', coordinates: [[-1.89, 52.48], [-1.88, 52.485]] },
      distance: 1200,
      estimatedTime: 18,
      safetyScore: 0.92,
      warnings: [],
      steps: [{ instruction: 'Head east' }],
    };
    jest.mocked(routingService.getSafePathOptionsResolved).mockResolvedValue({
      recommended: route,
      variants: [
        { kind: 'accessible', description: 'Accessible route', route },
        { kind: 'fastest', description: 'Fastest route', route },
      ],
    });
    jest.mocked(routingService.getSafePathResolved).mockResolvedValue(route);
    jest.mocked(aiAssistService.explainRoute).mockResolvedValue({
      forRouteDecision: false,
      provider: 'local-rules',
      explanation: 'This route avoids known hazards and keeps to smoother pavements.',
      reasons: ['Avoids known hazards'],
      limitations: [],
      generatedAtUtc: '2026-05-25T00:00:00Z',
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
    expect(getByText('1 city reports')).toBeTruthy();
    expect(getByText('Wheelchair')).toBeTruthy();
    await waitFor(() => expect(routingService.getSafePathOptionsResolved).toHaveBeenCalled());
    expect(routingService.getSafePathOptionsResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: 'manual-wheelchair',
        preferences: expect.arrayContaining(['avoid-reported-hazards', 'prefer-crossings', 'low-light-penalty']),
      }),
    );
    expect(getByText('18 min')).toBeTruthy();
    expect(getByText('1.2 km')).toBeTruthy();
    await waitFor(() => expect(getByText('Compared 3 route options')).toBeTruthy());
    expect(getByText('This route avoids known hazards and keeps to smoother pavements.')).toBeTruthy();
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

    await waitFor(() => expect(routingService.getSafePathOptionsResolved).toHaveBeenCalledTimes(1));
    fireEvent.changeText(getByLabelText('Destination'), 'New Street Station');
    fireEvent.press(getByLabelText('Search destination'));

    await waitFor(() => {
      expect(geocodingService.search).toHaveBeenCalledWith('New Street Station');
      expect(routingService.getSafePathOptionsResolved).toHaveBeenCalledTimes(2);
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

    await waitFor(() => expect(routingService.getSafePathOptionsResolved).toHaveBeenCalled());
    fireEvent.press(getByText('Start navigation'));

    expect(await findByText('Navigation active')).toBeTruthy();
    expect(await findByText('Head east')).toBeTruthy();

    fireEvent.press(getByText('End'));
    await waitFor(() => expect(queryByText('Head east')).toBeNull());
  });
});
