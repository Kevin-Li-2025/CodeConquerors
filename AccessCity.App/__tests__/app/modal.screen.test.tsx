import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <Pressable accessibilityLabel={`link-${href}`}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#ffffff',
}));

import ModalScreen from '@/app/modal';

describe('ModalScreen', () => {
  it('renders title and home link', () => {
    const { getByText, getByLabelText } = render(<ModalScreen />);
    expect(getByText('This is a modal')).toBeTruthy();
    expect(getByLabelText('link-/')).toBeTruthy();
  });
});
