import { router, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { PremiumTabBar } from '@/components/PremiumTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppTheme } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="map"
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: AppTheme.color.primary,
        tabBarInactiveTintColor: AppTheme.color.textSubtle,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarStyle: {
          height: 64,
          paddingTop: 4,
          paddingBottom: 8,
          borderTopColor: AppTheme.color.border,
          backgroundColor: AppTheme.color.surface,
        },
        tabBarItemStyle: {
          borderRadius: AppTheme.radius.md,
          marginHorizontal: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="paperplane.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="report/reportpage"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/report/reportpage');
          },
        }}
        options={{
          title: 'Report',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              size={size}
              name="exclamationmark.triangle.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="report/adminHazard-report"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="hazard"
        options={{
          title: 'Hazard',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              size={size}
              name="exclamationmark.triangle.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="ops"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
