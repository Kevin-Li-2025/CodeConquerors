import { DEFAULT_CITY_NAME } from '../../constants/defaultMapRegion';
import { AppTheme } from '../../constants/theme';
import { Hazard, ReportHazardOption, ReportHazardType } from './MapTypes';

export const hazards: Hazard[] = [
  {
    id: 1,
    title: 'Broken street light',
    type: 'lighting',
    latitude: 52.4865,
    longitude: -1.891,
    description: 'There is a broken street light. The street is dimly-lit.',
    status: 'Acknowledged',
    locationText: `Hazard located in ${DEFAULT_CITY_NAME}`,
    reportedTime: '2 minutes ago',
  },
  {
    id: 2,
    title: 'No wheelchair ramp',
    type: 'wheelchair',
    latitude: 52.4852,
    longitude: -1.888,
    description: 'Wheelchair users may find it difficult to access this path safely.',
    status: 'Pending',
    locationText: 'Hazard located near city centre',
    reportedTime: '10 minutes ago',
  },
];

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
