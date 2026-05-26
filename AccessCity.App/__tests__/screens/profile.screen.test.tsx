import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ProfileScreen from '@/app/(tabs)/profile';
import { createAuthWrapper } from '../testUtils';
import { dashboardService } from '@/services/system.service';
import { accountService } from '@/services/account.service';

jest.mock('@/services/system.service', () => ({
  dashboardService: {
    getSummary: jest.fn(),
  },
}));

jest.mock('@/services/sessionStorage', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/account.service', () => ({
  accountService: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getNotificationSettings: jest.fn(),
    updateNotificationSettings: jest.fn(),
    submitSupportContact: jest.fn(),
  },
}));

describe('ProfileScreen', () => {
  const mockSignOut = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dashboardService.getSummary).mockResolvedValue({
      totalHazards: 7,
      activeUsers: 3,
      activeUsersDefinition: 'test',
      pendingAlerts: 2,
      resolved: 4,
    });
    jest.mocked(accountService.getProfile).mockResolvedValue({
      email: 'u@test.com',
      fullName: 'Unit Test',
      accessibilityPreferences: {
        mobilityDevice: 'Manual wheelchair',
        avoidStairs: true,
        avoidSteepIncline: true,
        preferCurbRamps: true,
        preferSmoothSurface: true,
        maxDetourToleranceMinutes: 30,
      },
      stats: {
        reportsSubmitted: 7,
        resolvedReports: 4,
        communityImpact: 11,
      },
    });
    jest.mocked(accountService.getNotificationSettings).mockResolvedValue({
      hazardAlerts: true,
      routeWarnings: true,
      reportUpdates: true,
      weeklySummary: false,
    });
    jest.mocked(accountService.updateProfile).mockImplementation(async (payload: any) => ({
      email: 'u@test.com',
      fullName: payload.fullName ?? 'Unit Test',
      accessibilityPreferences: payload.accessibilityPreferences ?? {
        mobilityDevice: 'Manual wheelchair',
        avoidStairs: true,
        avoidSteepIncline: true,
        preferCurbRamps: true,
        preferSmoothSurface: true,
        maxDetourToleranceMinutes: 30,
      },
      stats: {
        reportsSubmitted: 7,
        resolvedReports: 4,
        communityImpact: 11,
      },
    }));
    jest.mocked(accountService.updateNotificationSettings).mockImplementation(async (settings: any) => settings);
    jest.mocked(accountService.submitSupportContact).mockResolvedValue({
      id: 'support-1',
      status: 'received',
    });
  });

  it('renders user name, email, and live summary', async () => {
    const Wrapper = createAuthWrapper({
      user: { email: 'u@test.com', fullName: 'Unit Test' },
      isAuthenticated: true,
      isLoading: false,
      signOut: mockSignOut,
    });

    const { findByText, getByText } = render(<ProfileScreen />, { wrapper: Wrapper });

    expect(getByText('Unit Test')).toBeTruthy();
    expect(getByText('u@test.com')).toBeTruthy();
    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByText('System Operations')).toBeTruthy();
    expect(await findByText('My reports')).toBeTruthy();
    expect(await findByText('7')).toBeTruthy();
  });

  it('opens system operations from profile', () => {
    const Wrapper = createAuthWrapper({
      user: { email: 'u@test.com', fullName: 'Unit Test' },
      isAuthenticated: true,
      isLoading: false,
      signOut: mockSignOut,
    });

    const { getByText } = render(<ProfileScreen />, { wrapper: Wrapper });
    fireEvent.press(getByText('Open Ops Console'));

    expect(router.push).toHaveBeenCalledWith('/ops');
  });

  it('opens privacy, verification, and contribution panels from real controls', async () => {
    const Wrapper = createAuthWrapper({
      user: { email: 'u@test.com', fullName: 'Unit Test' },
      isAuthenticated: true,
      isLoading: false,
      signOut: mockSignOut,
    });

    const { findByText, getByText } = render(<ProfileScreen />, { wrapper: Wrapper });

    fireEvent.press(getByText('Privacy & Security'));
    expect(getByText('Privacy & security')).toBeTruthy();
    expect(getByText('Session security')).toBeTruthy();
    expect(getByText('Log out and revoke')).toBeTruthy();

    expect(await findByText('Verified user')).toBeTruthy();
    fireEvent.press(getByText('Verified user'));
    expect(getByText('Account verification')).toBeTruthy();
    expect(getByText('Trusted session')).toBeTruthy();

    fireEvent.press(getByText('Contributor'));
    expect(getByText('Contribution impact')).toBeTruthy();
    expect(getByText('Routes improved')).toBeTruthy();
  });

  it('saves notification settings through the account API wrapper', async () => {
    const Wrapper = createAuthWrapper({
      user: { email: 'u@test.com', fullName: 'Unit Test' },
      isAuthenticated: true,
      isLoading: false,
      signOut: mockSignOut,
    });

    const { getByText } = render(<ProfileScreen />, { wrapper: Wrapper });

    fireEvent.press(getByText('Notifications'));
    fireEvent.press(getByText('Weekly summary'));
    fireEvent.press(getByText('Save notifications'));

    await waitFor(() => {
      expect(accountService.updateNotificationSettings).toHaveBeenCalledWith(
        expect.objectContaining({ weeklySummary: true }),
      );
    });
  });

  it('logs out and navigates to login', async () => {
    const Wrapper = createAuthWrapper({
      user: { email: 'u@test.com', fullName: 'U' },
      isAuthenticated: true,
      isLoading: false,
      signOut: mockSignOut,
    });

    const { getByText } = render(<ProfileScreen />, { wrapper: Wrapper });
    fireEvent.press(getByText('Log Out'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/login');
    });
  });
});
