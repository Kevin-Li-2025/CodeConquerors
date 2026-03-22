import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedView } from '@/components/themed-view';
import { Text } from 'react-native';

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#222222',
}));

describe('ThemedView', () => {
  it('renders children with themed background', () => {
    const { getByText } = render(
      <ThemedView>
        <Text>Inside</Text>
      </ThemedView>,
    );
    expect(getByText('Inside')).toBeTruthy();
  });
});
