import { api } from './api';
import { USER_KEY, getItemAsync, setItemAsync } from './sessionStorage';

export type AccessibilityPreferences = {
  mobilityDevice: 'Manual wheelchair' | 'Power wheelchair' | 'Stroller' | 'Walking';
  avoidStairs: boolean;
  avoidSteepIncline: boolean;
  preferCurbRamps: boolean;
  preferSmoothSurface: boolean;
  maxDetourToleranceMinutes: number;
};

export type AccountProfile = {
  email: string;
  fullName: string;
  accessibilityPreferences: AccessibilityPreferences;
  stats?: {
    reportsSubmitted: number;
    resolvedReports: number;
    communityImpact: number;
  };
};

export type NotificationSettings = {
  hazardAlerts: boolean;
  routeWarnings: boolean;
  reportUpdates: boolean;
  weeklySummary: boolean;
};

export type SupportContactRequest = {
  subject: string;
  message: string;
  category?: string;
};

export type SupportContactResponse = {
  id: string;
  status: string;
  createdAtUtc: string;
};

export const accountService = {
  async getProfile(): Promise<AccountProfile> {
    return api.get<AccountProfile>('/account/profile');
  },

  async updateProfile(request: Partial<Pick<AccountProfile, 'fullName' | 'accessibilityPreferences'>>): Promise<AccountProfile> {
    const profile = await api.put<AccountProfile>('/account/profile', request);

    const current = await getItemAsync(USER_KEY);
    const stored = current ? JSON.parse(current) : {};
    await setItemAsync(USER_KEY, JSON.stringify({
      ...stored,
      email: profile.email,
      fullName: profile.fullName,
    }));

    return profile;
  },

  async getNotificationSettings(): Promise<NotificationSettings> {
    return api.get<NotificationSettings>('/account/notifications');
  },

  async updateNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    return api.put<NotificationSettings>('/account/notifications', settings);
  },

  async submitSupportContact(request: SupportContactRequest): Promise<SupportContactResponse> {
    return api.post<SupportContactResponse>('/account/support/contact', request);
  },
};
