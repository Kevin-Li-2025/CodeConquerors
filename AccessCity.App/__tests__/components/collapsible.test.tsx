import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#111111',
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

import { Collapsible } from '@/components/ui/collapsible';

describe('Collapsible', () => {
  it('toggles content visibility when header pressed', () => {
    const { getByText, queryByText } = render(
      <Collapsible title="Section A">
        <Text>Hidden body</Text>
      </Collapsible>,
    );

    expect(queryByText('Hidden body')).toBeNull();

    fireEvent.press(getByText('Section A'));
    expect(getByText('Hidden body')).toBeTruthy();

    fireEvent.press(getByText('Section A'));
    expect(queryByText('Hidden body')).toBeNull();
  });
});
