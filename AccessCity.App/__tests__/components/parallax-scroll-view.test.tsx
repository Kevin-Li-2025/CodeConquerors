import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#f8fafc',
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

import ParallaxScrollView from '@/components/parallax-scroll-view';

describe('ParallaxScrollView', () => {
  it('renders header and body', () => {
    const { getByText } = render(
      <ParallaxScrollView
        headerImage={<Text>HeaderImg</Text>}
        headerBackgroundColor={{ light: '#fff', dark: '#000' }}
      >
        <Text>Scroll child</Text>
      </ParallaxScrollView>,
    );

    expect(getByText('HeaderImg')).toBeTruthy();
    expect(getByText('Scroll child')).toBeTruthy();
  });
});
