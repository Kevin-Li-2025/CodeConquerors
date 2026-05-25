import React from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteFilters } from './MapTypes';
import { AppTheme } from '@/constants/theme';

type FilterModalProps = {
  visible: boolean;
  routeFilters: RouteFilters;
  onClose: () => void;
  onToggleFilter: <K extends keyof RouteFilters>(key: K) => void;
  onAdjustMinSafety: (delta: number) => void;
  onAdjustMaxSafety: (delta: number) => void;
  onApply: () => void;
  onReset: () => void;
};

export default function FilterModal({
  visible,
  routeFilters,
  onClose,
  onToggleFilter,
  onAdjustMinSafety,
  onAdjustMaxSafety,
  onApply,
  onReset,
}: FilterModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheetWrapper}>
          <View style={styles.filterSheet}>
            <View style={styles.dragHandle} />

            <Text style={styles.filterTitle}>Filter by:</Text>
            <Text style={styles.pilotHint}>Pilot area: Birmingham, UK — routing uses OpenStreetMap + local hazards.</Text>
            <View style={styles.sheetDivider} />

            <Text style={styles.filterSectionHeading}>Accessibility Preferences</Text>

            <View style={styles.filterCard}>
              <Text style={styles.filterCardTitle}>Filter accessibility preferences</Text>

              {[
                ['avoidSteepHills', 'Avoid steep hills'],
                ['wheelchairAccessible', 'Step-free / manual wheelchair routing'],
                ['avoidReportedHazards', 'Avoid reported hazards'],
                ['preferWellLitStreets', 'Well-lit streets'],
              ].map(([key, label]) => {
                const filterKey = key as keyof RouteFilters;
                const checked = typeof routeFilters[filterKey] === 'boolean'
                  ? (routeFilters[filterKey] as boolean)
                  : false;

                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.checkboxRow}
                    onPress={() => onToggleFilter(filterKey)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color={AppTheme.color.textInverse} />}
                    </View>
                    <Text style={styles.checkboxLabel}>{label}</Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.filterButtonRow}>
                <TouchableOpacity style={styles.applyButton} onPress={onApply}>
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.resetButton} onPress={onReset}>
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetDividerLarge} />

            <Text style={styles.filterSectionHeading}>Safety Score</Text>

            <View style={styles.safetyPanel}>
              <View style={styles.safetyAdjustRow}>
                <Text style={styles.safetyAdjustLabel}>Min</Text>
                <View style={styles.safetyStepper}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => onAdjustMinSafety(-10)}
                  >
                    <Text style={styles.stepperButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.safetyValue}>{routeFilters.minSafetyScore}</Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => onAdjustMinSafety(10)}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.safetyAdjustRow}>
                <Text style={styles.safetyAdjustLabel}>Max</Text>
                <View style={styles.safetyStepper}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => onAdjustMaxSafety(-10)}
                  >
                    <Text style={styles.stepperButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.safetyValue}>{routeFilters.maxSafetyScore}</Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => onAdjustMaxSafety(10)}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.safetySliderWrap}>
                <View style={styles.safetySliderTrack} />
                <View
                  style={[
                    styles.safetySliderActive,
                    {
                      left: `${routeFilters.minSafetyScore}%`,
                      width: `${routeFilters.maxSafetyScore - routeFilters.minSafetyScore}%`,
                    },
                  ]}
                />
                <View
                  style={[styles.safetySliderThumb, { left: `${routeFilters.minSafetyScore}%` }]}
                />
                <View
                  style={[styles.safetySliderThumb, { left: `${routeFilters.maxSafetyScore}%` }]}
                />
              </View>

              <View style={styles.safetyRangeLabels}>
                <Text style={styles.safetyRangeText}>0</Text>
                <Text style={styles.safetyRangeText}>100</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.24)',
  },
  sheetWrapper: { width: '100%', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: AppTheme.color.surface,
    borderTopLeftRadius: AppTheme.radius.xl,
    borderTopRightRadius: AppTheme.radius.xl,
    paddingTop: 10,
    paddingHorizontal: AppTheme.space.xl,
    paddingBottom: AppTheme.space.xxl,
    minHeight: '62%',
    ...AppTheme.shadow.floating,
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: AppTheme.color.borderStrong,
    alignSelf: 'center',
    marginBottom: 14,
  },
  filterTitle: {
    color: AppTheme.color.text,
    marginBottom: 4,
    ...AppTheme.type.headline,
  },
  pilotHint: {
    color: AppTheme.color.textMuted,
    marginBottom: 4,
    ...AppTheme.type.meta,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: AppTheme.color.border,
    marginTop: 14,
    marginBottom: 16,
  },
  filterSectionHeading: {
    color: AppTheme.color.text,
    marginBottom: 14,
    ...AppTheme.type.sectionTitle,
  },
  filterCard: {
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.color.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterCardTitle: {
    color: AppTheme.color.textSubtle,
    marginBottom: 14,
    ...AppTheme.type.body,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.color.textSubtle,
    backgroundColor: AppTheme.color.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    backgroundColor: AppTheme.color.primary,
    borderColor: AppTheme.color.primary,
  },
  checkboxLabel: {
    color: AppTheme.color.text,
    flexShrink: 1,
    ...AppTheme.type.body,
  },
  filterButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  applyButton: {
    flex: 1,
    height: 50,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.cardTitle,
  },
  resetButton: {
    flex: 1,
    height: 50,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.cardTitle,
  },
  sheetDividerLarge: {
    height: 1,
    backgroundColor: AppTheme.color.border,
    marginVertical: 22,
  },
  safetyPanel: { paddingTop: 4 },
  safetyAdjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  safetyAdjustLabel: {
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
  safetyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AppTheme.color.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: AppTheme.color.text,
    lineHeight: 22,
  },
  safetyValue: {
    width: 44,
    textAlign: 'center',
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  safetySliderWrap: {
    position: 'relative',
    height: 34,
    justifyContent: 'center',
    marginTop: 10,
  },
  safetySliderTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: AppTheme.color.borderStrong,
    width: '100%',
  },
  safetySliderActive: {
    position: 'absolute',
    height: 6,
    borderRadius: 999,
    backgroundColor: AppTheme.color.primary,
  },
  safetySliderThumb: {
    position: 'absolute',
    marginLeft: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppTheme.color.primary,
    borderWidth: 3,
    borderColor: AppTheme.color.surface,
    top: 6,
  },
  safetyRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  safetyRangeText: {
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
});
