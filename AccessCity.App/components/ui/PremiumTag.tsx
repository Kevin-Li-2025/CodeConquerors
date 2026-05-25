import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppTheme } from '@/constants/theme';

type PremiumTagTone = 'accent' | 'danger' | 'good' | 'neutral' | 'warning';
type PremiumTagVariant = 'soft' | 'solid' | 'surface';

type PremiumTagProps = {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  tone?: PremiumTagTone;
  variant?: PremiumTagVariant;
};

const TAG_TONES: Record<
  PremiumTagTone,
  {
    bg: string;
    border: string;
    dot: string;
    text: string;
  }
> = {
  accent: {
    bg: AppTheme.color.accentSoft,
    border: '#C7E4BF',
    dot: AppTheme.color.accent,
    text: AppTheme.color.accent,
  },
  danger: {
    bg: AppTheme.color.dangerSoft,
    border: '#FDBA9C',
    dot: AppTheme.color.danger,
    text: AppTheme.color.danger,
  },
  good: {
    bg: AppTheme.color.successSoft,
    border: '#B8DCB6',
    dot: AppTheme.color.success,
    text: AppTheme.color.success,
  },
  neutral: {
    bg: AppTheme.color.surfaceSubtle,
    border: AppTheme.color.border,
    dot: AppTheme.color.textMuted,
    text: AppTheme.color.textMuted,
  },
  warning: {
    bg: AppTheme.color.warningSoft,
    border: '#F2D992',
    dot: AppTheme.color.warning,
    text: AppTheme.color.warning,
  },
};

export function PremiumTag({
  label,
  icon,
  tone = 'neutral',
  variant = 'soft',
}: PremiumTagProps) {
  const palette = TAG_TONES[tone];
  const isSolid = variant === 'solid';
  const isSurface = variant === 'surface';
  const textColor = isSolid ? AppTheme.color.textInverse : palette.text;

  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: isSolid
            ? AppTheme.color.ink
            : isSurface
              ? AppTheme.color.surface
              : palette.bg,
          borderColor: isSolid ? AppTheme.color.ink : palette.border,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={13} color={textColor} />
      ) : (
        <View
          style={[
            styles.dot,
            { backgroundColor: isSolid ? AppTheme.color.peach : palette.dot },
          ]}
        />
      )}
      <Text numberOfLines={1} style={[styles.text, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    minHeight: 30,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    ...AppTheme.type.label,
  },
});
