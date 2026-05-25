import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { AppTheme } from '@/constants/theme';

const VISIBLE_TAB_ROUTES = new Set(['map', 'report/reportpage', 'hazard', 'profile']);

function getRouteLabel(routeName: string, options: BottomTabBarProps['descriptors'][string]['options']) {
  if (typeof options.tabBarLabel === 'string') return options.tabBarLabel;
  if (typeof options.title === 'string') return options.title;
  const leaf = routeName.split('/').pop() ?? routeName;
  return leaf.charAt(0).toUpperCase() + leaf.slice(1);
}

export function PremiumTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const visibleRoutes = state.routes.filter((route) => VISIBLE_TAB_ROUTES.has(route.name));

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const isFocused = state.routes[state.index]?.key === route.key;
          const label = getRouteLabel(route.name, options);
          const color = isFocused ? AppTheme.color.textInverse : AppTheme.color.textMuted;
          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color,
            size: isFocused ? 20 : 19,
          });

          function handlePress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          }

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={handlePress}
              style={[
                styles.item,
                isCompact && styles.itemCompact,
                isFocused && styles.itemActive,
              ]}
            >
              <View style={[styles.iconWrap, isCompact && styles.iconWrapCompact]}>{icon}</View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isCompact && styles.labelCompact,
                  isFocused && styles.labelActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
    paddingHorizontal: AppTheme.space.md,
    paddingTop: 4,
    paddingBottom: 8,
  },
  bar: {
    width: '100%',
    maxWidth: AppTheme.layout.mobileFrameWidth,
    minHeight: 54,
    alignSelf: 'center',
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(23, 21, 16, 0.1)',
    backgroundColor: 'rgba(255, 253, 247, 0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 5,
    ...AppTheme.shadow.floating,
  },
  item: {
    flex: 1,
    minHeight: 42,
    minWidth: 0,
    borderRadius: AppTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 6,
  },
  itemCompact: {
    flexDirection: 'column',
    gap: 2,
    paddingHorizontal: 4,
  },
  itemActive: {
    backgroundColor: AppTheme.color.ink,
    shadowColor: AppTheme.color.shadow,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    height: 18,
  },
  label: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
    maxWidth: 70,
  },
  labelCompact: {
    maxWidth: 58,
    fontSize: 10,
    lineHeight: 13,
  },
  labelActive: {
    color: AppTheme.color.textInverse,
  },
});
