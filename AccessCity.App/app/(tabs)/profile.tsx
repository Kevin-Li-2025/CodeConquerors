import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { AppTheme } from '@/constants/theme';
import { getItemAsync, setItemAsync } from '@/services/sessionStorage';
import {
  accountService,
  type AccessibilityPreferences,
  type AccountProfile,
  type NotificationSettings,
} from '@/services/account.service';

type ProfileAction = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name']
    | React.ComponentProps<typeof Feather>['name']
    | React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconFamily: 'ionicons' | 'feather' | 'material';
  route?: string;
};

const PREFERENCES_STORAGE_KEY = 'accesscity_accessibility_preferences';

const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  mobilityDevice: 'Manual wheelchair',
  avoidStairs: true,
  avoidSteepIncline: true,
  preferCurbRamps: true,
  preferSmoothSurface: true,
  maxDetourToleranceMinutes: 30,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  hazardAlerts: true,
  routeWarnings: true,
  reportUpdates: true,
  weeklySummary: false,
};

const PROFILE_ACTIONS: ProfileAction[] = [
  {
    id: 'edit-profile',
    title: 'Edit Profile',
    description: 'Update your personal information',
    icon: 'user',
    iconFamily: 'feather',
  },
  {
    id: 'preferences',
    title: 'Accessibility Preferences',
    description: 'Customize route preferences',
    icon: 'map-pin',
    iconFamily: 'feather',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Manage alert settings',
    icon: 'notifications-outline',
    iconFamily: 'ionicons',
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    description: 'Control your data',
    icon: 'lock-closed-outline',
    iconFamily: 'ionicons',
  },
  {
    id: 'support',
    title: 'Help & Support',
    description: 'Get assistance',
    icon: 'help-circle-outline',
    iconFamily: 'ionicons',
  },
  {
    id: 'ops',
    title: 'System Operations',
    description: 'Monitor backend health and admin workflows',
    icon: 'settings-outline',
    iconFamily: 'ionicons',
    route: '/ops',
  },
];

function formatStat(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '-';
}

function boolLabel(value: boolean) {
  return value ? 'Yes' : 'No';
}

function getPreferenceRows(preferences: AccessibilityPreferences) {
  return [
    {
      id: 'mobilityDevice',
      label: 'Mobility device',
      value: preferences.mobilityDevice,
      icon: 'wheelchair-accessibility',
    },
    {
      id: 'avoidStairs',
      label: 'Avoid stairs',
      value: boolLabel(preferences.avoidStairs),
      icon: 'stairs',
    },
    {
      id: 'avoidSteepIncline',
      label: 'Avoid steep incline',
      value: boolLabel(preferences.avoidSteepIncline),
      icon: 'angle-acute',
    },
    {
      id: 'preferCurbRamps',
      label: 'Prefer curb ramps',
      value: boolLabel(preferences.preferCurbRamps),
      icon: 'slope-uphill',
    },
    {
      id: 'preferSmoothSurface',
      label: 'Prefer smooth surface',
      value: boolLabel(preferences.preferSmoothSurface),
      icon: 'road-variant',
    },
    {
      id: 'maxDetourToleranceMinutes',
      label: 'Max detour tolerance',
      value: `${preferences.maxDetourToleranceMinutes} min`,
      icon: 'timer-outline',
    },
  ] as const;
}

function ActionIcon({ item }: { item: ProfileAction }) {
  if (item.iconFamily === 'feather') {
    return <Feather name={item.icon as React.ComponentProps<typeof Feather>['name']} size={22} color={AppTheme.color.primary} />;
  }

  if (item.iconFamily === 'material') {
    return (
      <MaterialCommunityIcons
        name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
        size={22}
        color={AppTheme.color.primary}
      />
    );
  }

  return <Ionicons name={item.icon as React.ComponentProps<typeof Ionicons>['name']} size={22} color={AppTheme.color.primary} />;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const fallbackFullName = user?.fullName || '';
  const [accountProfile, setAccountProfile] = React.useState<AccountProfile | null>(null);
  const [profileNameDraft, setProfileNameDraft] = React.useState(fallbackFullName);
  const [preferences, setPreferences] = React.useState<AccessibilityPreferences>(DEFAULT_ACCESSIBILITY_PREFERENCES);
  const [isEditingPreferences, setIsEditingPreferences] = React.useState(false);
  const [notificationSettings, setNotificationSettings] = React.useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [activePanel, setActivePanel] = React.useState<'profile' | 'notifications' | 'support' | null>(null);
  const [supportSubject, setSupportSubject] = React.useState('');
  const [supportMessage, setSupportMessage] = React.useState('');
  const [isSavingPanel, setIsSavingPanel] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function loadProfileData() {
      const [storedPreferencesResult, accountResult, notificationsResult] = await Promise.allSettled([
        getItemAsync(PREFERENCES_STORAGE_KEY),
        accountService.getProfile(),
        accountService.getNotificationSettings(),
      ]);

      if (!isMounted) return;

      if (accountResult.status === 'fulfilled') {
        setAccountProfile(accountResult.value);
        setProfileNameDraft(accountResult.value.fullName || fallbackFullName);
        setPreferences({
          ...DEFAULT_ACCESSIBILITY_PREFERENCES,
          ...accountResult.value.accessibilityPreferences,
        });
      } else if (storedPreferencesResult.status === 'fulfilled' && storedPreferencesResult.value) {
        try {
          const parsed = JSON.parse(storedPreferencesResult.value) as Partial<AccessibilityPreferences>;
          setPreferences({
            ...DEFAULT_ACCESSIBILITY_PREFERENCES,
            ...parsed,
          });
        } catch (error) {
          console.warn('Failed to parse stored accessibility preferences:', error);
        }
      }

      if (notificationsResult.status === 'fulfilled') {
        setNotificationSettings(notificationsResult.value);
      } else {
        console.warn('Failed to load notification settings:', notificationsResult.reason);
      }
    }

    void loadProfileData();

    return () => {
      isMounted = false;
    };
  }, [fallbackFullName]);

  async function persistPreferences(nextPreferences: AccessibilityPreferences) {
    setPreferences(nextPreferences);
    try {
      await setItemAsync(PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
      const profile = await accountService.updateProfile({ accessibilityPreferences: nextPreferences });
      setAccountProfile(profile);
    } catch (error) {
      console.warn('Failed to persist accessibility preferences:', error);
    }
  }

  function updatePreference(id: keyof AccessibilityPreferences) {
    const mobilityDevices: AccessibilityPreferences['mobilityDevice'][] = [
      'Manual wheelchair',
      'Power wheelchair',
      'Stroller',
      'Walking',
    ];

    let nextPreferences = preferences;

    if (id === 'mobilityDevice') {
      const currentIndex = mobilityDevices.indexOf(preferences.mobilityDevice);
      nextPreferences = {
        ...preferences,
        mobilityDevice: mobilityDevices[(currentIndex + 1) % mobilityDevices.length],
      };
    } else if (id === 'maxDetourToleranceMinutes') {
      const options = [10, 15, 20, 30, 45];
      const currentIndex = options.indexOf(preferences.maxDetourToleranceMinutes);
      nextPreferences = {
        ...preferences,
        maxDetourToleranceMinutes: options[(currentIndex + 1) % options.length],
      };
    } else {
      nextPreferences = {
        ...preferences,
        [id]: !preferences[id],
      };
    }

    void persistPreferences(nextPreferences);
  }

  function handleProfileAction(action: ProfileAction) {
    if (action.route) {
      router.push(action.route as never);
      return;
    }

    switch (action.id) {
      case 'edit-profile':
        setProfileNameDraft(accountProfile?.fullName || user?.fullName || '');
        setActivePanel((current) => current === 'profile' ? null : 'profile');
        break;
      case 'preferences':
        setIsEditingPreferences((current) => !current);
        break;
      case 'notifications':
        setActivePanel((current) => current === 'notifications' ? null : 'notifications');
        break;
      case 'privacy':
        Alert.alert('Privacy & security', 'Access tokens are stored in the app session. Log out revokes the refresh token and clears local session data.');
        break;
      case 'support':
        setActivePanel((current) => current === 'support' ? null : 'support');
        break;
      default:
        break;
    }
  }

  async function handleSaveProfile() {
    const fullName = profileNameDraft.trim();
    if (!fullName) {
      Alert.alert('Profile name required', 'Enter the name you want shown on your profile.');
      return;
    }

    setIsSavingPanel(true);
    try {
      const profile = await accountService.updateProfile({ fullName });
      setAccountProfile(profile);
      setProfileNameDraft(profile.fullName);
      setActivePanel(null);
      Alert.alert('Profile updated', 'Your profile details were saved.');
    } catch (error: any) {
      Alert.alert('Profile error', error?.message || 'Could not update profile.');
    } finally {
      setIsSavingPanel(false);
    }
  }

  async function handleSaveNotifications() {
    setIsSavingPanel(true);
    try {
      const saved = await accountService.updateNotificationSettings(notificationSettings);
      setNotificationSettings(saved);
      setActivePanel(null);
      Alert.alert('Notifications updated', 'Your notification settings were saved.');
    } catch (error: any) {
      Alert.alert('Notification error', error?.message || 'Could not update notification settings.');
    } finally {
      setIsSavingPanel(false);
    }
  }

  async function handleSubmitSupport() {
    if (supportSubject.trim().length < 3 || supportMessage.trim().length < 10) {
      Alert.alert('More detail needed', 'Add a short subject and at least 10 characters of message detail.');
      return;
    }

    setIsSavingPanel(true);
    try {
      const response = await accountService.submitSupportContact({
        subject: supportSubject,
        message: supportMessage,
        category: 'app-support',
      });
      setSupportSubject('');
      setSupportMessage('');
      setActivePanel(null);
      Alert.alert('Support request sent', `Ticket ${response.id} is ${response.status}.`);
    } catch (error: any) {
      Alert.alert('Support error', error?.message || 'Could not send support request.');
    } finally {
      setIsSavingPanel(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  function toggleNotificationSetting(id: keyof NotificationSettings) {
    setNotificationSettings((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  const displayName = accountProfile?.fullName || user?.fullName || 'AccessCity User';
  const displayEmail = accountProfile?.email || user?.email || 'No email available';
  const profileStats = accountProfile?.stats;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={28} color={AppTheme.color.textInverse} />
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name}>{displayName}</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/map' as never)}>
                <Text style={styles.publicProfile}>Open route map ›</Text>
              </TouchableOpacity>
              <Text style={styles.email} numberOfLines={1}>{displayEmail}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Verified user</Text>
                </View>
                <View style={styles.contributorBadge}>
                  <Text style={styles.contributorBadgeText}>Contributor</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsDivider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatStat(profileStats?.reportsSubmitted)}</Text>
              <Text style={styles.statLabel}>My reports</Text>
            </View>

            <View style={styles.statSeparator} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatStat(profileStats?.resolvedReports)}</Text>
              <Text style={styles.statLabel}>Resolved reports</Text>
            </View>

            <View style={styles.statSeparator} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatStat(profileStats?.communityImpact)}</Text>
              <Text style={styles.statLabel}>Community impact</Text>
            </View>
          </View>
        </View>

        <View style={styles.preferencesCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Accessibility preferences</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setIsEditingPreferences((current) => !current)}>
              <Text style={styles.editText}>{isEditingPreferences ? 'Done' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
          {isEditingPreferences ? (
            <Text style={styles.preferenceHint}>Tap any row to change it. Preferences are saved to your profile and cached locally.</Text>
          ) : null}
          {getPreferenceRows(preferences).map((preference, index) => (
            <TouchableOpacity
              key={preference.label}
              activeOpacity={0.84}
              disabled={!isEditingPreferences}
              onPress={() => updatePreference(preference.id as keyof AccessibilityPreferences)}
              style={[
                styles.preferenceRow,
                index !== getPreferenceRows(preferences).length - 1 && styles.preferenceBorder,
                isEditingPreferences && styles.preferenceRowEditable,
              ]}
            >
              <View style={styles.preferenceLeft}>
                <MaterialCommunityIcons
                  name={preference.icon}
                  size={18}
                  color={AppTheme.color.text}
                />
                <Text style={styles.preferenceLabel}>{preference.label}</Text>
              </View>
              <View style={styles.preferenceValueWrap}>
                <Text style={styles.preferenceValue}>{preference.value}</Text>
                {isEditingPreferences ? (
                  <Ionicons name="swap-horizontal" size={15} color={AppTheme.color.textSubtle} />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionsCard}>
          {PROFILE_ACTIONS.map((action, index) => (
            <TouchableOpacity
              key={action.id}
              activeOpacity={0.85}
              onPress={() => {
                handleProfileAction(action);
              }}
              style={[
                styles.actionRow,
                index !== PROFILE_ACTIONS.length - 1 && styles.actionBorder,
              ]}
            >
              <View style={styles.actionIconWrap}>
                <ActionIcon item={action} />
              </View>

              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={AppTheme.color.textSubtle} />
            </TouchableOpacity>
          ))}
        </View>

        {activePanel === 'profile' ? (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Profile details</Text>
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={styles.textInput}
              value={profileNameDraft}
              onChangeText={setProfileNameDraft}
              placeholder="Full name"
              placeholderTextColor={AppTheme.color.textSubtle}
            />
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.panelButton, isSavingPanel && styles.panelButtonDisabled]}
              disabled={isSavingPanel}
              onPress={() => void handleSaveProfile()}
            >
              <Text style={styles.panelButtonText}>{isSavingPanel ? 'Saving…' : 'Save profile'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {activePanel === 'notifications' ? (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Notification settings</Text>
            {([
              ['hazardAlerts', 'Hazard alerts'],
              ['routeWarnings', 'Route warnings'],
              ['reportUpdates', 'Report updates'],
              ['weeklySummary', 'Weekly summary'],
            ] as const).map(([id, label]) => (
              <TouchableOpacity
                key={id}
                activeOpacity={0.86}
                style={styles.settingRow}
                onPress={() => toggleNotificationSetting(id)}
              >
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingValue}>{notificationSettings[id] ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.panelButton, isSavingPanel && styles.panelButtonDisabled]}
              disabled={isSavingPanel}
              onPress={() => void handleSaveNotifications()}
            >
              <Text style={styles.panelButtonText}>{isSavingPanel ? 'Saving…' : 'Save notifications'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {activePanel === 'support' ? (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Help & support</Text>
            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.textInput}
              value={supportSubject}
              onChangeText={setSupportSubject}
              placeholder="What do you need help with?"
              placeholderTextColor={AppTheme.color.textSubtle}
            />
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.textInput, styles.messageInput]}
              value={supportMessage}
              onChangeText={setSupportMessage}
              multiline
              textAlignVertical="top"
              placeholder="Describe the issue or feedback..."
              placeholderTextColor={AppTheme.color.textSubtle}
            />
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.panelButton, isSavingPanel && styles.panelButtonDisabled]}
              disabled={isSavingPanel}
              onPress={() => void handleSubmitSupport()}
            >
              <Text style={styles.panelButtonText}>{isSavingPanel ? 'Sending…' : 'Send support request'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity activeOpacity={0.85} style={styles.logoutButton} onPress={() => void handleSignOut()}>
          <Ionicons name="log-out-outline" size={20} color={AppTheme.color.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  screen: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  content: {
    width: '100%',
    maxWidth: AppTheme.layout.mobileFrameWidth,
    alignSelf: 'center',
    paddingHorizontal: AppTheme.space.lg,
    paddingTop: AppTheme.space.lg,
    paddingBottom: 36,
  },
  header: {
    marginBottom: AppTheme.space.md,
  },
  screenTitle: {
    color: AppTheme.color.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0,
  },
  profileCard: {
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: AppTheme.space.lg,
    ...AppTheme.shadow.card,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.color.primary,
  },
  profileInfo: {
    flex: 1,
    marginLeft: AppTheme.space.lg,
  },
  name: {
    color: AppTheme.color.text,
    ...AppTheme.type.sectionTitle,
  },
  publicProfile: {
    marginTop: 2,
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  email: {
    marginTop: 3,
    color: AppTheme.color.textSubtle,
    ...AppTheme.type.label,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: AppTheme.space.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: AppTheme.space.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: AppTheme.color.accentSoft,
  },
  badgeText: {
    color: AppTheme.color.accent,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  contributorBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: AppTheme.space.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: AppTheme.color.skySoft,
  },
  contributorBadgeText: {
    color: '#2D6FA8',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  statsDivider: {
    height: 1,
    backgroundColor: AppTheme.color.border,
    marginTop: AppTheme.space.xl,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 78,
    paddingHorizontal: 10,
  },
  statSeparator: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: AppTheme.color.border,
  },
  statValue: {
    color: AppTheme.color.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: AppTheme.space.xs,
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
    textAlign: 'center',
  },
  statFootnote: {
    marginTop: AppTheme.space.sm,
    color: AppTheme.color.warning,
    ...AppTheme.type.label,
    textAlign: 'center',
  },
  preferencesCard: {
    marginTop: 14,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: AppTheme.space.md,
    ...AppTheme.shadow.card,
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  editText: {
    color: '#276FB0',
    ...AppTheme.type.label,
  },
  preferenceHint: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
    marginBottom: AppTheme.space.sm,
  },
  preferenceRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  preferenceRowEditable: {
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderRadius: AppTheme.radius.sm,
    paddingHorizontal: AppTheme.space.sm,
  },
  preferenceBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.color.border,
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  preferenceLabel: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  preferenceValue: {
    color: AppTheme.color.text,
    ...AppTheme.type.label,
    textAlign: 'right',
  },
  preferenceValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionsCard: {
    marginTop: 14,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    overflow: 'hidden',
    ...AppTheme.shadow.card,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppTheme.space.lg,
    minHeight: 58,
    paddingVertical: 10,
  },
  actionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.color.border,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.color.primarySoft,
  },
  actionTextWrap: {
    flex: 1,
    marginLeft: AppTheme.space.md,
    marginRight: AppTheme.space.md,
  },
  actionTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.meta,
  },
  actionDescription: {
    marginTop: AppTheme.space.xs,
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  detailCard: {
    marginTop: 14,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: AppTheme.space.lg,
    ...AppTheme.shadow.card,
  },
  detailTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
    marginBottom: AppTheme.space.md,
  },
  fieldLabel: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
    marginBottom: AppTheme.space.xs,
    marginTop: AppTheme.space.sm,
  },
  textInput: {
    minHeight: 46,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surfaceSubtle,
    color: AppTheme.color.text,
    paddingHorizontal: AppTheme.space.md,
    paddingVertical: AppTheme.space.sm,
    ...AppTheme.type.body,
  },
  messageInput: {
    minHeight: 108,
  },
  settingRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.color.border,
  },
  settingLabel: {
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  settingValue: {
    color: '#276FB0',
    ...AppTheme.type.label,
  },
  panelButton: {
    minHeight: 48,
    marginTop: AppTheme.space.lg,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelButtonDisabled: {
    opacity: 0.55,
  },
  panelButtonText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.cardTitle,
  },
  logoutButton: {
    marginTop: 14,
    marginBottom: 12,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    ...AppTheme.shadow.card,
  },
  logoutText: {
    color: AppTheme.color.danger,
    ...AppTheme.type.cardTitle,
  },
});
