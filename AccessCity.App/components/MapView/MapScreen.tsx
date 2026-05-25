import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppTheme } from '@/constants/theme';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map Not Available on Web</Text>
      <Text style={styles.message}>
        The interactive map and routing features are optimized for mobile devices.
        Please use the Expo Go app on your phone to view the map.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppTheme.space.xl,
    backgroundColor: AppTheme.color.background,
  },
  title: {
    marginBottom: 10,
    color: AppTheme.color.primary,
    ...AppTheme.type.headline,
  },
  message: {
    textAlign: 'center',
    color: AppTheme.color.textMuted,
    ...AppTheme.type.body,
  },
});
