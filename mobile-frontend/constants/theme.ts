import { Platform } from 'react-native';

import { fontFamilies } from './fonts';

export const themeColors = {
  background: '#F8FAFF',
  border: '#DDE8FF',
  destructive: '#D92D20',
  destructiveBorder: '#FECACA',
  destructiveSurface: '#FEF2F2',
  foreground: '#17315F',
  muted: '#EEF4FF',
  mutedForeground: '#6C7A96',
  secondaryForeground: '#53647F',
  primary: '#346EF6',
  // Google Maps requires a neutral attribution color.
  googleAttribution: '#5E5E5E',
  primaryHover: '#2558D8',
  subtleForeground: '#91A0B8',
  success: '#047857',
  successBorder: '#BBF7D0',
  successSurface: '#ECFDF5',
  surface: '#FFFFFF',
  warning: '#806128',
  warningBorder: '#FFE7A6',
  warningSurface: '#FFF9E8',
} as const;

// Dark mode is not yet implemented across JamJade screens. Both entries use the
// supported light palette so system theme changes cannot create a partial theme.
export const Colors = {
  light: {
    text: themeColors.foreground,
    background: themeColors.background,
    tint: themeColors.primary,
    icon: themeColors.mutedForeground,
    tabIconDefault: themeColors.subtleForeground,
    tabIconSelected: themeColors.primary,
  },
  dark: {
    text: themeColors.foreground,
    background: themeColors.background,
    tint: themeColors.primary,
    icon: themeColors.mutedForeground,
    tabIconDefault: themeColors.subtleForeground,
    tabIconSelected: themeColors.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: fontFamilies.regular,
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: fontFamilies.regular,
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: fontFamilies.regular,
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
