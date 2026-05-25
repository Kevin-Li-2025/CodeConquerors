import React from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Hazard } from './MapTypes';
import { AppTheme } from '@/constants/theme';

type HazardDetailsModalProps = {
  visible: boolean;
  hazard: Hazard | null;
  onClose: () => void;
  onAvoidRoute?: () => void;
};

export default function HazardDetailsModal({
  visible,
  hazard,
  onClose,
  onAvoidRoute,
}: HazardDetailsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.detailModalRoot}>
        <Pressable style={styles.detailOverlay} onPress={onClose} />

        <View style={styles.hazardDetailCard}>
          <View style={styles.hazardDetailHeader}>
            <View
              style={[
                styles.hazardDetailIconBox,
                hazard?.type === 'wheelchair'
                  ? styles.hazardDetailIconBlue
                  : styles.hazardDetailIconYellow,
              ]}
            >
              {hazard?.type === 'wheelchair' ? (
                <MaterialCommunityIcons
                  name="wheelchair-accessibility"
                  size={28}
                  color={AppTheme.color.primary}
                />
              ) : (
                <Ionicons name="bulb-outline" size={28} color={AppTheme.color.warning} />
              )}
            </View>

            <View style={styles.hazardDetailHeaderText}>
              <Text style={styles.hazardDetailTitle}>{hazard?.title}</Text>

              <View style={styles.hazardStatusBadge}>
                <Text style={styles.hazardStatusText}>
                  Status: {hazard?.status}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.hazardDetailDivider} />

          <Text style={styles.hazardDetailSectionLabel}>Description</Text>
          <Text style={styles.hazardDetailDescription}>
            {hazard?.description}
          </Text>

          <View style={styles.hazardMetaRow}>
            <View style={styles.hazardMetaItem}>
              <Ionicons name="location-outline" size={20} color={AppTheme.color.danger} />
              <Text style={styles.hazardMetaTitle}>Location</Text>
              <Text style={styles.hazardMetaText}>{hazard?.locationText}</Text>
            </View>

            <View style={styles.hazardMetaItem}>
              <Ionicons name="time-outline" size={20} color={AppTheme.color.textSubtle} />
              <Text style={styles.hazardMetaTitle}>Reported</Text>
              <Text style={styles.hazardMetaText}>{hazard?.reportedTime}</Text>
            </View>
          </View>

          <View style={styles.hazardActionRow}>
            <TouchableOpacity
              style={[styles.avoidRouteButton, !onAvoidRoute && styles.avoidRouteButtonDisabled]}
              onPress={onAvoidRoute}
              disabled={!onAvoidRoute}
              accessibilityRole="button"
              accessibilityLabel="Avoid this hazard in route"
            >
              <Ionicons name="navigate-outline" size={18} color={AppTheme.color.textInverse} />
              <Text style={styles.avoidRouteButtonText}>Avoid in Route</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.detailSecondaryButton} onPress={onClose}>
              <Ionicons name="chevron-forward" size={18} color={AppTheme.color.textMuted} />
              <Text style={styles.detailSecondaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  detailModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.32)',
  },
  hazardDetailCard: {
    width: '100%',
    maxWidth: AppTheme.layout.maxFormWidth,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: AppTheme.space.xl,
    paddingVertical: AppTheme.space.xl,
    ...AppTheme.shadow.floating,
  },
  hazardDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hazardDetailIconBox: {
    width: 68,
    height: 68,
    borderRadius: AppTheme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  hazardDetailIconYellow: {
    backgroundColor: AppTheme.color.warningSoft,
  },
  hazardDetailIconBlue: {
    backgroundColor: AppTheme.color.primarySoft,
  },
  hazardDetailHeaderText: {
    flex: 1,
  },
  hazardDetailTitle: {
    color: AppTheme.color.text,
    marginBottom: AppTheme.space.sm,
    ...AppTheme.type.sectionTitle,
  },
  hazardStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: AppTheme.color.warningSoft,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: AppTheme.space.md,
    paddingVertical: 6,
  },
  hazardStatusText: {
    color: AppTheme.color.warning,
    ...AppTheme.type.meta,
  },
  hazardDetailDivider: {
    height: 1,
    backgroundColor: AppTheme.color.border,
    marginVertical: AppTheme.space.lg,
  },
  hazardDetailSectionLabel: {
    color: AppTheme.color.textMuted,
    marginBottom: AppTheme.space.sm,
    ...AppTheme.type.cardTitle,
  },
  hazardDetailDescription: {
    color: AppTheme.color.text,
    marginBottom: AppTheme.space.xl,
    ...AppTheme.type.body,
  },
  hazardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppTheme.space.xl,
    gap: AppTheme.space.lg,
  },
  hazardMetaItem: {
    flex: 1,
  },
  hazardMetaTitle: {
    color: AppTheme.color.textSubtle,
    marginTop: 6,
    marginBottom: AppTheme.space.xs,
    ...AppTheme.type.meta,
  },
  hazardMetaText: {
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
  hazardActionRow: {
    flexDirection: 'row',
    gap: AppTheme.space.md,
  },
  avoidRouteButton: {
    flex: 1,
    height: 54,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  avoidRouteButtonDisabled: {
    opacity: 0.5,
  },
  avoidRouteButtonText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.cardTitle,
  },
  detailSecondaryButton: {
    flex: 1,
    height: 54,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  detailSecondaryButtonText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.cardTitle,
  },
});
