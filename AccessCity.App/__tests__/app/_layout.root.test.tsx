import React from 'react';
import { render, act } from '@testing-library/react-native';
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('expo-router', () => {
  const React = require('react');
  function Stack({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  Stack.Screen = function Screen() {
    return null;
  };
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useSegments: () => [],
    Tabs: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('@/services/auth.service', () => ({
  authService: {
    getSession: jest.fn(() => Promise.resolve(null)),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(() => Promise.resolve()),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    clearSession: jest.fn(),
  },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

import RootLayout from '@/app/_layout';

describe('RootLayout', () => {
  it('mounts root providers and stack', async () => {
    const { UNSAFE_root } = render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(UNSAFE_root).toBeTruthy();
  });
});
