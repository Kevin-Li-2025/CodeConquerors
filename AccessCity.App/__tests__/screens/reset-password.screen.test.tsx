import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ResetPasswordScreen from '@/app/reset-password';
import { authService } from '@/services/auth.service';

const mockUseLocalSearchParams = jest.fn<Record<string, string>, []>(() => ({}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useSegments: () => [],
  Stack: ({ children }: { children: React.ReactNode }) => children,
  Tabs: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/services/auth.service', () => ({
  authService: {
    resetPassword: jest.fn(() => Promise.resolve({ message: 'ok' })),
  },
}));

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows validation when fields are empty', async () => {
    const { getByText, findByText } = render(<ResetPasswordScreen />);

    fireEvent.press(getByText('Save & Log In'));
    expect(await findByText('All fields are required.')).toBeTruthy();
  });

  it('requires password length', async () => {
    const { getByText, getByPlaceholderText, getAllByPlaceholderText, findByText } = render(
      <ResetPasswordScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('Paste token here'), 'tok');
    const secureFields = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(secureFields[0], 'short');
    fireEvent.changeText(secureFields[1], 'short');

    fireEvent.press(getByText('Save & Log In'));
    expect(await findByText('Password must be at least 8 characters.')).toBeTruthy();
  });

  it('requires matching passwords', async () => {
    const { getByText, getByPlaceholderText, getAllByPlaceholderText, findByText } = render(
      <ResetPasswordScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('Paste token here'), 'tok');
    const secureFields = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(secureFields[0], 'Password12');
    fireEvent.changeText(secureFields[1], 'Password34');

    fireEvent.press(getByText('Save & Log In'));
    expect(await findByText('Passwords do not match.')).toBeTruthy();
  });

  it('calls resetPassword and navigates after success alert', async () => {
    const { getByText, getByPlaceholderText, getAllByPlaceholderText } = render(
      <ResetPasswordScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('Paste token here'), 'reset-token');
    const secureFields = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(secureFields[0], 'Password12');
    fireEvent.changeText(secureFields[1], 'Password12');

    fireEvent.press(getByText('Save & Log In'));

    await waitFor(() => {
      expect(authService.resetPassword).toHaveBeenCalledWith({
        email: 'a@b.com',
        token: 'reset-token',
        newPassword: 'Password12',
      });
    });

    expect(Alert.alert).toHaveBeenCalled();
    const alertCall = jest.mocked(Alert.alert).mock.calls[0];
    const buttons = alertCall[2];
    expect(buttons?.[0]?.onPress).toBeDefined();
    buttons![0].onPress!();

    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('prefills email from route params', () => {
    mockUseLocalSearchParams.mockReturnValue({ email: 'preset@test.com' });

    const { getByDisplayValue } = render(<ResetPasswordScreen />);
    expect(getByDisplayValue('preset@test.com')).toBeTruthy();
  });
});
