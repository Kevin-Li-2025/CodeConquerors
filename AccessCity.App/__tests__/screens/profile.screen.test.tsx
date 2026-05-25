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
    fireEvent.press(getByText('System Operations'));

    expect(router.push).toHaveBeenCalledWith('/ops');
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
