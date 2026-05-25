import React from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { reportHazardLabelMap, reportHazardOptions } from './mapData';
import { ReportHazardType } from './MapTypes';
import { AppTheme } from '@/constants/theme';

type ReportHazardModalProps = {
  visible: boolean;
  reportStep: 1 | 2 | 3;
  selectedReportType: ReportHazardType | null;
  reportDescription: string;
  severity?: 'Low' | 'Medium' | 'High';
  onClose: () => void;
  onSelectType: (type: ReportHazardType) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onDone: () => void;
  onChangeDescription: (text: string) => void;
  onChangeSeverity?: (severity: 'Low' | 'Medium' | 'High') => void;
  onAddPhoto?: () => void;
  selectedPhotoLabel?: string | null;
  locationLabel?: string;
  locationHint?: string;
  isResolvingLocation?: boolean;
  canSubmit?: boolean;
  onRetryLocation?: () => void;
};

function renderOptionIcon(
  iconType: 'ionicons' | 'material',
  iconName: string,
  iconColor: string
) {
  if (iconType === 'material') {
    return (
      <MaterialCommunityIcons
        name={iconName as any}
        size={28}
        color={iconColor}
      />
    );
  }

  return <Ionicons name={iconName as any} size={28} color={iconColor} />;
}

export default function ReportHazardModal({
  visible,
  reportStep,
  selectedReportType,
  reportDescription,
  severity = 'Medium',
  onClose,
  onSelectType,
  onNext,
  onBack,
  onSubmit,
  onDone,
  onChangeDescription,
  onChangeSeverity,
  onAddPhoto,
  selectedPhotoLabel,
  locationLabel = 'Current Location',
  locationHint = 'Using your current location',
  isResolvingLocation = false,
  canSubmit = true,
  onRetryLocation,
}: ReportHazardModalProps) {
  const selectedTypeOption = reportHazardOptions.find(
    (item) => item.key === selectedReportType
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close report issue"
              >
                <Ionicons name="close" size={20} color={AppTheme.color.text} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Report issue</Text>
              <View style={styles.closeButtonPlaceholder} />
            </View>
            <View style={styles.sheetDivider} />

            <View style={styles.stepRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, reportStep >= 1 && styles.stepCircleActive]}>
                  <Text style={[styles.stepNumber, reportStep >= 1 && styles.stepNumberActive]}>1</Text>
                </View>
                <Text style={styles.stepTitle}>Type</Text>
              </View>

              <View style={[styles.stepLine, reportStep >= 2 && styles.stepLineActive]} />

              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, reportStep >= 2 && styles.stepCircleActive]}>
                  <Text style={[styles.stepNumber, reportStep >= 2 && styles.stepNumberActive]}>2</Text>
                </View>
                <Text style={styles.stepTitle}>Details</Text>
              </View>

              <View style={[styles.stepLine, reportStep >= 3 && styles.stepLineActive]} />

              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, reportStep >= 3 && styles.stepCircleActive]}>
                  <Text style={[styles.stepNumber, reportStep >= 3 && styles.stepNumberActive]}>3</Text>
                </View>
                <Text style={styles.stepTitle}>Confirm</Text>
              </View>
            </View>

            {reportStep === 1 && (
              <>
                <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
                  <Text style={styles.questionTitle}>
                    What is the issue?
                    <Text style={styles.required}>*</Text>
                  </Text>

                  <Text style={styles.questionSubtitle}>
                    Select the closest match for the route impact.
                  </Text>

                  <View style={styles.grid}>
                    {reportHazardOptions.map((item) => {
                      const isSelected = selectedReportType === item.key;

                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[styles.card, isSelected && styles.cardSelected]}
                          onPress={() => onSelectType(item.key)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          {isSelected ? (
                            <View style={styles.cardSelectedIndicator}>
                              <Ionicons name="checkmark" size={14} color={AppTheme.color.textInverse} />
                            </View>
                          ) : null}
                          <View style={[styles.cardIconBox, { backgroundColor: item.iconBg }]}>
                            {renderOptionIcon(item.iconType, item.iconName, item.iconColor)}
                          </View>
                          <Text style={styles.cardText}>{item.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={styles.sheetBottomButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.nextButton, !selectedReportType && styles.nextButtonDisabled]}
                    onPress={onNext}
                    disabled={!selectedReportType}
                  >
                    <Text style={[styles.nextButtonText, !selectedReportType && styles.nextButtonTextDisabled]}>
                      Next
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {reportStep === 2 && (
              <>
                <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
                  <View style={styles.selectedTypeBox}>
                    <View style={styles.selectedTypeLeft}>
                      <View
                        style={[
                          styles.selectedTypeIcon,
                          { backgroundColor: selectedTypeOption?.iconBg ?? AppTheme.color.surfaceSubtle },
                        ]}
                      >
                        {selectedTypeOption
                          ? renderOptionIcon(
                              selectedTypeOption.iconType,
                              selectedTypeOption.iconName,
                              selectedTypeOption.iconColor
                            )
                          : <Ionicons name="warning-outline" size={22} color={AppTheme.color.danger} />}
                      </View>

                      <View style={styles.selectedTypeTextWrap}>
                        <Text style={styles.selectedTypeMiniLabel}>Reporting</Text>
                        <Text style={styles.selectedTypeText}>
                          {selectedReportType
                            ? reportHazardLabelMap[selectedReportType]
                            : ''}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity onPress={onBack}>
                      <Text style={styles.changeText}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sectionTitle}>Detected location</Text>

                  <View style={styles.locationBox}>
                    {isResolvingLocation ? (
                      <ActivityIndicator size="small" color={AppTheme.color.textMuted} />
                    ) : (
                      <Ionicons name="location-outline" size={22} color={AppTheme.color.textMuted} />
                    )}
                    <Text style={styles.locationText} numberOfLines={2}>
                      {locationLabel}
                    </Text>
                  </View>

                  <Text style={styles.locationHint}>{locationHint}</Text>
                  {!canSubmit && onRetryLocation ? (
                    <TouchableOpacity
                      activeOpacity={0.84}
                      style={styles.retryLocationButton}
                      onPress={onRetryLocation}
                    >
                      <Ionicons name="refresh" size={15} color={AppTheme.color.text} />
                      <Text style={styles.retryLocationText}>Try location again</Text>
                    </TouchableOpacity>
                  ) : null}

                  <Text style={styles.sectionTitle}>Add photos <Text style={styles.optionalText}>(optional)</Text></Text>

                  <View style={styles.photoRow}>
                    <TouchableOpacity
                      style={styles.photoBoxWide}
                      activeOpacity={0.85}
                      onPress={onAddPhoto}
                    >
                      <Ionicons name="camera-outline" size={24} color={AppTheme.color.text} />
                      <View style={styles.photoCopy}>
                        <Text style={styles.photoTitle}>{selectedPhotoLabel ? 'Replace photo' : 'Add photo'}</Text>
                        <Text style={styles.photoHelper} numberOfLines={1}>
                          {selectedPhotoLabel || 'A photo helps verify the issue faster'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.similarReportBox}>
                    <Ionicons name="git-merge-outline" size={18} color={AppTheme.color.warning} />
                    <Text style={styles.similarReportText}>
                      Similar report found nearby. Add confirmation instead?
                    </Text>
                  </View>

                  <Text style={styles.sectionTitle}>Describe the issue <Text style={styles.optionalText}>(optional)</Text></Text>

                  <View style={styles.quickChipRow}>
                    {['Pavement is blocked', 'Hard to pass', 'Too narrow'].map((chip) => (
                      <TouchableOpacity
                        key={chip}
                        activeOpacity={0.85}
                        style={styles.quickChip}
                        onPress={() => onChangeDescription(reportDescription ? `${reportDescription} ${chip}` : chip)}
                      >
                        <Text style={styles.quickChipText}>{chip}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.descriptionInput}
                    placeholder="Add one short note, if useful..."
                    placeholderTextColor={AppTheme.color.textSubtle}
                    multiline
                    value={reportDescription}
                    onChangeText={onChangeDescription}
                    textAlignVertical="top"
                  />

                  <Text style={styles.sectionTitle}>Severity</Text>
                  <View style={styles.segmentedRow}>
                    {(['Low', 'Medium', 'High'] as const).map((option) => (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.84}
                        style={[styles.segmentPill, severity === option && styles.segmentPillActive]}
                        onPress={() => onChangeSeverity?.(option)}
                      >
                        <Text style={[styles.segmentText, severity === option && styles.segmentTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.sheetBottomButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.nextButton, !canSubmit && styles.nextButtonDisabled]}
                    onPress={onSubmit}
                    disabled={!canSubmit}
                  >
                    <Text style={[styles.nextButtonText, !canSubmit && styles.nextButtonTextDisabled]}>
                      {canSubmit ? 'Submit' : 'Need location'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {reportStep === 3 && (
              <>
                <View style={styles.successContainer}>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark" size={40} color={AppTheme.color.success} />
                  </View>

                  <Text style={styles.successTitle}>Report Submitted!</Text>

                  <Text style={styles.successSubtitle}>
                    Thank you for making our community safer
                  </Text>

                  <View style={styles.successMessageBox}>
                    <Text style={styles.successMessageText}>
                      Your report has been acknowledged
                    </Text>
                  </View>
                </View>

                <View style={styles.sheetBottomButtons}>
                  <TouchableOpacity style={styles.fullWidthButton} onPress={onDone}>
                    <Text style={styles.nextButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    backgroundColor: 'rgba(23, 21, 16, 0.28)',
  },
  sheetWrapper: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: AppTheme.layout.mobileFrameWidth,
    backgroundColor: AppTheme.color.surface,
    borderTopLeftRadius: AppTheme.radius.xl,
    borderTopRightRadius: AppTheme.radius.xl,
    paddingTop: 10,
    paddingHorizontal: AppTheme.space.xl,
    paddingBottom: AppTheme.space.xl,
    ...AppTheme.shadow.floating,
    height: '94%',
    maxHeight: '94%',
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: AppTheme.color.borderStrong,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPlaceholder: {
    width: 34,
    height: 34,
  },
  sheetTitle: {
    textAlign: 'center',
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: AppTheme.color.border,
    marginTop: AppTheme.space.md,
    marginBottom: AppTheme.space.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: AppTheme.space.md,
  },
  stepItem: {
    width: '28%',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppTheme.color.surface,
    borderWidth: 1,
    borderColor: AppTheme.color.borderStrong,
    marginBottom: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: AppTheme.color.primary,
    borderColor: AppTheme.color.primary,
  },
  stepNumber: {
    color: AppTheme.color.textMuted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  stepNumberActive: {
    color: AppTheme.color.textInverse,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: AppTheme.color.border,
    marginTop: 14,
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: AppTheme.color.primary,
  },
  stepTitle: {
    textAlign: 'center',
    color: AppTheme.color.text,
    marginBottom: 5,
    ...AppTheme.type.label,
  },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingBottom: 10 },
  questionTitle: {
    color: AppTheme.color.text,
    marginBottom: 3,
    ...AppTheme.type.sectionTitle,
  },
  required: { color: AppTheme.color.danger },
  questionSubtitle: {
    color: AppTheme.color.textMuted,
    marginBottom: AppTheme.space.md,
    ...AppTheme.type.label,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    minHeight: 116,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingVertical: AppTheme.space.md,
    paddingHorizontal: AppTheme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  cardSelected: {
    borderColor: AppTheme.color.danger,
    backgroundColor: AppTheme.color.dangerSoft,
  },
  cardSelectedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.color.primary,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardText: {
    textAlign: 'center',
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  sheetBottomButtons: {
    flexDirection: 'row',
    gap: AppTheme.space.md,
    marginTop: AppTheme.space.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderRadius: AppTheme.radius.lg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
  },
  cancelButtonText: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },
  nextButton: {
    flex: 1,
    backgroundColor: AppTheme.color.primary,
    borderRadius: AppTheme.radius.lg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthButton: {
    flex: 1,
    backgroundColor: AppTheme.color.primary,
    borderRadius: AppTheme.radius.lg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: AppTheme.color.surfaceMuted,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
  },
  nextButtonText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.cardTitle,
  },
  nextButtonTextDisabled: {
    color: AppTheme.color.textSubtle,
  },
  selectedTypeBox: {
    minHeight: 84,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  selectedTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  selectedTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedTypeTextWrap: {
    flex: 1,
  },
  selectedTypeMiniLabel: {
    color: AppTheme.color.textSubtle,
    marginBottom: 2,
    ...AppTheme.type.label,
  },
  selectedTypeText: {
    color: AppTheme.color.text,
    flexShrink: 1,
    ...AppTheme.type.sectionTitle,
  },
  changeText: {
    color: AppTheme.color.primary,
    ...AppTheme.type.meta,
  },
  sectionTitle: {
    color: AppTheme.color.text,
    marginBottom: AppTheme.space.sm,
    ...AppTheme.type.cardTitle,
  },
  locationBox: {
    height: 64,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  locationText: {
    color: AppTheme.color.text,
    marginLeft: 10,
    flex: 1,
    ...AppTheme.type.body,
  },
  locationHint: {
    marginTop: 10,
    color: AppTheme.color.accent,
    marginBottom: 12,
    ...AppTheme.type.meta,
  },
  retryLocationButton: {
    minHeight: 38,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 12,
    marginBottom: 22,
  },
  retryLocationText: {
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  descriptionInput: {
    minHeight: 96,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: AppTheme.color.text,
    marginBottom: 22,
    ...AppTheme.type.body,
  },
  quickChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 10,
  },
  quickChip: {
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
  },
  quickChipText: {
    color: AppTheme.color.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  optionalText: {
    color: AppTheme.color.textSubtle,
  },
  photoRow: {
    flexDirection: 'row',
    gap: AppTheme.space.sm,
    marginTop: 4,
    marginBottom: 12,
  },
  photoBoxWide: {
    flex: 1,
    minHeight: 72,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  photoCopy: {
    flex: 1,
    minWidth: 0,
  },
  photoHelper: {
    color: AppTheme.color.textMuted,
    marginTop: 2,
    ...AppTheme.type.label,
  },
  similarReportBox: {
    minHeight: 44,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.warningSoft,
    borderWidth: 1,
    borderColor: '#F4D28A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  similarReportText: {
    flex: 1,
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  photoPreview: {
    flex: 1,
    height: 90,
    borderRadius: AppTheme.radius.md,
    backgroundColor: '#E8DED2',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    overflow: 'hidden',
  },
  photoPreviewLine: {
    position: 'absolute',
    left: -8,
    right: -8,
    top: 52,
    height: 3,
    backgroundColor: 'rgba(23, 21, 16, 0.15)',
    transform: [{ rotate: '-9deg' }],
  },
  photoPreviewPatch: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,253,247,0.62)',
  },
  photoBox: {
    width: 120,
    height: 90,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  photoTitle: {
    color: AppTheme.color.text,
    marginTop: 6,
    textAlign: 'center',
    ...AppTheme.type.label,
  },
  photoSubtitle: {
    color: AppTheme.color.textMuted,
    marginTop: 2,
    maxWidth: 92,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: AppTheme.space.lg,
  },
  segmentPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: AppTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
  },
  segmentPillActive: {
    borderColor: '#F3C2A9',
    backgroundColor: AppTheme.color.peachSoft,
  },
  segmentText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  segmentTextActive: {
    color: AppTheme.color.danger,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  successIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: AppTheme.color.successSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  successTitle: {
    color: AppTheme.color.text,
    marginBottom: AppTheme.space.sm,
    ...AppTheme.type.headline,
  },
  successSubtitle: {
    color: AppTheme.color.textMuted,
    textAlign: 'center',
    marginBottom: 18,
    ...AppTheme.type.body,
  },
  successMessageBox: {
    width: '100%',
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderRadius: AppTheme.radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  successMessageText: {
    color: AppTheme.color.textMuted,
    textAlign: 'center',
    ...AppTheme.type.body,
  },
});
