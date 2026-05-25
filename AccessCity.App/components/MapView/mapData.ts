import { AppTheme } from '../../constants/theme';
import { ReportHazardOption, ReportHazardType } from './MapTypes';

export const reportHazardOptions: ReportHazardOption[] = [
  {
    key: 'broken_street_light',
    label: 'Broken street light',
    iconType: 'ionicons',
    iconName: 'bulb-outline',
    iconColor: AppTheme.color.warning,
    iconBg: AppTheme.color.warningSoft,
  },
  {
    key: 'blocked_pavement',
    label: 'Blocked pavement',
    iconType: 'ionicons',
    iconName: 'warning-outline',
    iconColor: AppTheme.color.danger,
    iconBg: AppTheme.color.dangerSoft,
  },
  {
    key: 'parked_car_blocking_dropped_kerb',
    label: 'Parked car blocking dropped kerb',
    iconType: 'ionicons',
    iconName: 'car-outline',
    iconColor: AppTheme.color.primary,
    iconBg: AppTheme.color.primarySoft,
  },
  {
    key: 'road_obstruction',
    label: 'Road obstruction',
    iconType: 'ionicons',
    iconName: 'warning-outline',
    iconColor: AppTheme.color.danger,
    iconBg: AppTheme.color.dangerSoft,
  },
  {
    key: 'unsafe_crossing',
    label: 'Unsafe crossing',
    iconType: 'material',
    iconName: 'walk',
    iconColor: AppTheme.color.accent,
    iconBg: AppTheme.color.accentSoft,
  },
  {
    key: 'other',
    label: 'Other',
    iconType: 'ionicons',
    iconName: 'document-text-outline',
    iconColor: AppTheme.color.textMuted,
    iconBg: AppTheme.color.surfaceMuted,
  },
];

export const reportHazardLabelMap: Record<ReportHazardType, string> = {
  broken_street_light: 'Broken street light',
  blocked_pavement: 'Blocked pavement',
  parked_car_blocking_dropped_kerb: 'Parked car blocking dropped kerb',
  road_obstruction: 'Road obstruction',
  unsafe_crossing: 'Unsafe crossing',
  other: 'Other',
};
