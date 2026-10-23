import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamilies } from '@/constants/fonts';
import { mobileLayout } from '@/constants/layout';
import type { AppTabIcon } from '@/constants/navigation-tabs';
import { themeColors } from '@/constants/theme';

export type FloatingTabBarItem = {
  key: string;
  label: string;
  icon: AppTabIcon;
  selected?: boolean;
  featured?: boolean;
  featuredActive?: boolean;
  disabled?: boolean;
  busy?: boolean;
  badgeCount?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  onDisabledPress?: () => void;
  onLongPress?: () => void;
};

const ACTIVE = themeColors.primary;
const INACTIVE = themeColors.mutedForeground;
const BAR_HEIGHT = mobileLayout.tabBarHeight;
const BAR_LIFT = mobileLayout.tabBarLift;

// Presentation shared by Customer, Driver and local-state research navigation.
export function FloatingTabBarSurface({ items }: { items: FloatingTabBarItem[] }) {
  return (
    <View style={styles.bar}>
      <View pointerEvents="none" style={styles.barSurface} />
      {items.map((item) => {
        const color = item.selected ? ACTIVE : INACTIVE;
        return (
          <Pressable
            key={item.key}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityHint={item.accessibilityHint}
            accessibilityRole="button"
            aria-selected={item.selected}
            aria-disabled={item.disabled}
            accessibilityState={{ disabled: item.disabled, busy: item.busy }}
            disabled={item.disabled && !item.onDisabledPress}
            onPress={item.disabled && item.onDisabledPress ? item.onDisabledPress : item.onPress}
            onLongPress={item.onLongPress}
            style={[styles.tabButton, item.featured && styles.featuredButton]}>
            {({ pressed }) => (
              <View style={[styles.tabContent, pressed && styles.pressedTabButton]}>
                <View style={[styles.iconContainer, item.featured && styles.featuredIconContainer,
                  item.featured && item.disabled && !item.featuredActive && styles.disabledFeaturedIconContainer]}>
                  {item.busy ? <ActivityIndicator size="small" color={item.featured ? themeColors.surface : color} /> : (
                    <MaterialCommunityIcons name={item.icon} size={item.featured ? 24 : 22}
                      color={item.featured ? themeColors.surface : item.disabled ? themeColors.subtleForeground : color} />
                  )}
                  {!!item.badgeCount && item.badgeCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text className="font-sans" style={styles.unreadBadgeText}>{item.badgeCount > 99 ? '99+' : item.badgeCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="font-sans" style={[styles.label, item.featured && styles.featuredLabel,
                  item.selected && styles.activeLabel, item.disabled && styles.disabledLabel]}
                  maxFontSizeMultiplier={1.3} numberOfLines={1}>{item.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: BAR_HEIGHT + BAR_LIFT,
    maxWidth: 430,
    paddingHorizontal: 6,
    width: '100%',
  },
  barSurface: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 24,
    borderWidth: 1,
    bottom: 0,
    height: BAR_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    shadowColor: themeColors.foreground,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    height: BAR_HEIGHT + BAR_LIFT,
    justifyContent: 'center',
    minWidth: 0,
    paddingTop: BAR_LIFT,
  },
  tabContent: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 2,
    width: '100%',
  },
  featuredButton: { paddingTop: 0 },
  pressedTabButton: { opacity: 0.72 },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 26,
    position: 'relative',
  },
  featuredIconContainer: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.surface,
    borderRadius: 25,
    borderWidth: 3,
    height: 50,
    width: 50,
  },
  disabledFeaturedIconContainer: { backgroundColor: themeColors.subtleForeground },
  label: {
    color: INACTIVE,
    fontSize: 11,
    fontFamily: fontFamilies.medium,
    fontWeight: 'normal',
    lineHeight: 14,
    maxWidth: '100%',
    textAlign: 'center',
  },
  activeLabel: { color: ACTIVE },
  featuredLabel: { fontFamily: fontFamilies.semibold },
  disabledLabel: { color: themeColors.subtleForeground },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: themeColors.destructive,
    borderColor: themeColors.surface,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 19,
    minWidth: 19,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -8,
    top: -5,
  },
  unreadBadgeText: {
    color: themeColors.surface,
    fontSize: 9,
    fontFamily: fontFamilies.semibold,
    fontWeight: 'normal',
    lineHeight: 11,
  },
});
