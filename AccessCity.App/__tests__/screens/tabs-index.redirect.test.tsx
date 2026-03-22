import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect-href">{href}</Text>,
  };
});

import HomeRedirect from '@/app/(tabs)/index';

describe('HomeRedirect (tabs index)', () => {
  it('redirects to map tab', () => {
    const { getByTestId } = render(<HomeRedirect />);
    expect(getByTestId('redirect-href').props.children).toBe('/(tabs)/map');
  });
});
