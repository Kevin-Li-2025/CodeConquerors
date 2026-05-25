import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Hazard } from './MapTypes';
import { AppTheme } from '@/constants/theme';

type HazardPreviewCardProps = {
  visible: boolean;
  hazard: Hazard | null;
  onClose: () => void;
  onOpenDetails: () => void;
};

export default function HazardPreviewCard({
  visible,
  hazard,
  onClose,
  onOpenDetails,
}: HazardPreviewCardProps) {
  if (!visible || !hazard) return null;

  const hazardTypeLabel = hazard.type
    ? hazard.type.replace(/[_-]+/g, ' ').toUpperCase()
    : 'HAZARD';

  return (
    <View style={styles.hazardPreviewCard}>
      <Pressable style={styles.hazardPreviewClose} onPress={onClose}>
        <Ionicons name="close" size={18} color={AppTheme.color.textMuted} />
      </Pressable>

      <Text style={styles.hazardPreviewLabel}>{hazardTypeLabel}</Text>
      <Text style={styles.hazardPreviewTitle}>{hazard.title}</Text>

      <TouchableOpacity
        style={styles.hazardPreviewDetailsButton}
        onPress={onOpenDetails}
      >
        <Text style={styles.hazardPreviewDetailsText}>Details</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  hazardPreviewCard: {
    position: 'absolute',
    left: AppTheme.space.lg,
    top: 160,
    width: 210,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: AppTheme.space.lg,
    ...AppTheme.shadow.floating,
  },
  hazardPreviewClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppTheme.color.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hazardPreviewLabel: {
    color: AppTheme.color.textSubtle,
    marginBottom: 6,
    ...AppTheme.type.label,
  },
  hazardPreviewTitle: {
    color: AppTheme.color.text,
    marginBottom: 14,
    paddingRight: 24,
    ...AppTheme.type.sectionTitle,
  },
  hazardPreviewDetailsButton: {
    alignSelf: 'flex-start',
    backgroundColor: AppTheme.color.primarySoft,
    borderRadius: AppTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hazardPreviewDetailsText: {
    color: AppTheme.color.primary,
    ...AppTheme.type.meta,
  },
});
