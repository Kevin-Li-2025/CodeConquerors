import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/components/MapView/MapScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'map-screen' }, 'MapScreen');
});

import MapPage from '@/app/(tabs)/map.native';

describe('MapPage (native)', () => {
  it('renders MapScreen', () => {
    const { getByTestId } = render(<MapPage />);
    expect(getByTestId('map-screen')).toBeTruthy();
  });
});
