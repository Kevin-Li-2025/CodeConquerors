import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ForgotPasswordScreen from '@/app/forgot-password';
import { authService } from '@/services/auth.service';

jest.mock('@/services/auth.service', () => ({
  authService: {
    forgotPassword: jest.fn(() => Promise.resolve({ message: 'ok' })),
  },
}));

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation when email is missing or invalid', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.press(getByText('Send Reset Link'));
    expect(await findByText('Please enter a valid email address.')).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'not-an-email');
    fireEvent.press(getByText('Send Reset Link'));
    expect(await findByText('Please enter a valid email address.')).toBeTruthy();
  });

  it('calls forgotPassword and shows success state', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'user@test.com');
    fireEvent.press(getByText('Send Reset Link'));

    await waitFor(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith('user@test.com');
    });

    expect(await findByText('Check your email')).toBeTruthy();
  });

  it('navigates to reset-password from success state', async () => {
    jest.mocked(authService.forgotPassword).mockResolvedValue({ message: 'ok' });

    const { getByText, getByPlaceholderText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'user@test.com');
    fireEvent.press(getByText('Send Reset Link'));

    expect(await findByText('Enter Token')).toBeTruthy();
    fireEvent.press(getByText('Enter Token'));
    expect(router.push).toHaveBeenCalledWith('/reset-password');
  });

  it('navigates back from success screen', async () => {
    jest.mocked(authService.forgotPassword).mockResolvedValue({ message: 'ok' });

    const { getByText, getByPlaceholderText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'user@test.com');
    fireEvent.press(getByText('Send Reset Link'));

    expect(await findByText('Back to Login')).toBeTruthy();
    fireEvent.press(getByText('Back to Login'));
    expect(router.back).toHaveBeenCalled();
  });
});
