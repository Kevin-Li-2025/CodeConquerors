/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';
const displayFont = Platform.select({
  ios: 'ui-serif',
  web: "Georgia, 'Times New Roman', serif",
  default: 'serif',
});

export const AppTheme = {
  color: {
    background: '#F8F4EA',
    surface: '#FFFDF7',
    surfaceSubtle: '#F4EFE4',
    surfaceMuted: '#EBE5D9',
    border: '#E8DFD0',
    borderStrong: '#D7CBB8',
    text: '#171510',
    textMuted: '#6E685D',
    textSubtle: '#9B9284',
    textInverse: '#FFFFFF',
    primary: '#171510',
    primaryDark: '#070604',
    primarySoft: '#F0ECE3',
    primaryMuted: '#D4C7B3',
    accent: '#4F8F5F',
    accentSoft: '#E5F3E7',
    warning: '#B8742B',
    warningSoft: '#FFF1D9',
    danger: '#C75F3D',
    dangerSoft: '#FFE7DE',
    success: '#458958',
    successSoft: '#E1F2E4',
    sky: '#BEE6F0',
    skySoft: '#E9F7F7',
    peach: '#F3A77B',
    peachSoft: '#FFE4D3',
    field: '#9FC36B',
    fieldSoft: '#EAF3D4',
    lake: '#DDF2EC',
    lavender: '#D9D1E8',
    butter: '#F6DC89',
    ink: '#171510',
    shadow: '#1A1710',
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  layout: {
    maxContentWidth: 1040,
    maxFormWidth: 520,
    mobileFrameWidth: 430,
    adminContentWidth: 1180,
    minTouchTarget: 48,
  },
  type: {
    displayTitle: {
      fontSize: 38,
      lineHeight: 44,
      fontWeight: '600',
      letterSpacing: 0,
      fontFamily: displayFont,
    },
    screenTitle: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
      letterSpacing: 0,
    },
    headline: {
      fontSize: 22,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: 0,
    },
    sectionTitle: {
      fontSize: 18,
      lineHeight: 26,
      fontWeight: '700',
      letterSpacing: 0,
    },
    cardTitle: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '700',
      letterSpacing: 0,
    },
    body: {
      fontSize: 15,
      lineHeight: 24,
      fontWeight: '500',
      letterSpacing: 0,
    },
    meta: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      letterSpacing: 0,
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      letterSpacing: 0,
    },
  },
  shadow: {
    card: {
      shadowColor: '#1B1710',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.055,
      shadowRadius: 22,
      elevation: 3,
    },
    floating: {
      shadowColor: '#1B1710',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.12,
      shadowRadius: 30,
      elevation: 8,
    },
  },
} as const;

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
