import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/components/MapView/MapScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return () =>
    React.createElement(
      View,
      null,
      React.createElement(Text, null, 'Map is available in the iOS and Android app.'),
    );
});

import MapTabPage from '@/app/(tabs)/map';

describe('Map tab (platform entry)', () => {
  it('renders map entry (native resolves to MapScreen-backed page)', () => {
    const { getByText } = render(<MapTabPage />);
    expect(getByText('Map is available in the iOS and Android app.')).toBeTruthy();
  });
});
