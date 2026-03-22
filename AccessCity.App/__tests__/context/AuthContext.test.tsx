import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

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

import { authService } from '@/services/auth.service';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function Consumer() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <Text>loading</Text>;
  return <Text>{isAuthenticated ? 'in' : 'out'}</Text>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authService.getSession).mockResolvedValue(null);
  });

  it('finishes loading and exposes unauthenticated state', async () => {
    const { getByText } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(getByText('loading')).toBeTruthy();
    await waitFor(() => expect(getByText('out')).toBeTruthy());
  });
});

describe('useAuth', () => {
  it('throws outside AuthProvider', () => {
    function Bad() {
      useAuth();
      return null;
    }

    expect(() => render(<Bad />)).toThrow('useAuth must be used within an AuthProvider');
  });
});
