import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCustomerTabBarVisibility } from '@/components/navigation/CustomerTabBarVisibilityContext';
import type { FloatingTabConfig } from '@/constants/navigation-tabs';
import { themeColors } from '@/constants/theme';
import { setUnreadNotificationCount, useUnreadNotificationCount } from '@/lib/customer/notification-unread';
import { getNotifications } from '@/services/api';

type FloatingBottomTabBarProps = BottomTabBarProps & {
  tabs: FloatingTabConfig[];
  onDisabledTabPress?: (tab: FloatingTabConfig) => void;
};

const ACTIVE = themeColors.primary;
const INACTIVE = themeColors.subtleForeground;
const BAR_HEIGHT = 74;
const FLOAT_GAP = 10;

export function FloatingBottomTabBar({
  descriptors,
  navigation,
  onDisabledTabPress,
  state,
  tabs,
}: FloatingBottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const unreadNotificationCount = useUnreadNotificationCount();
  const { isTabBarHidden } = useCustomerTabBarVisibility();
  const translateY = useRef(new Animated.Value(0)).current;
  const hideOffset = BAR_HEIGHT + insets.bottom + FLOAT_GAP + 20;

  useEffect(() => {
    let isActive = true;

    void getNotifications()
      .then((notifications) => {
        if (isActive) {
          setUnreadNotificationCount(notifications.filter((notification) => !notification.isRead).length);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [state.index]);

  useEffect(() => {
    Animated.timing(translateY, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: isTabBarHidden ? hideOffset : 0,
      useNativeDriver: true,
    }).start();
  }, [hideOffset, isTabBarHidden, translateY]);

  return (
    <Animated.View
      pointerEvents={isTabBarHidden ? 'none' : 'box-none'}
      style={[styles.safeArea, { paddingBottom: insets.bottom + FLOAT_GAP, transform: [{ translateY }] }]}>
      <View style={[styles.bar, { height: BAR_HEIGHT }]}>
        {tabs.map((tab) => {
          const routeIndex = state.routes.findIndex((routeItem) => routeItem.name === tab.routeName);

          if (routeIndex === -1) {
            return null;
          }

          const route = state.routes[routeIndex];
          const options = descriptors[route.key]?.options;
          const isFocused = state.index === routeIndex;
          const isDisabled = Boolean(tab.disabled);
          const isNotificationsTab = tab.routeName === 'notifications';
          const color = isFocused ? ACTIVE : INACTIVE;
          const accessibilityLabel = isNotificationsTab && unreadNotificationCount > 0
            ? `${tab.label}, ${unreadNotificationCount} unread`
            : tab.disabledAccessibilityLabel ?? options?.tabBarAccessibilityLabel ?? tab.label;

          const handlePress = () => {
            if (isDisabled) {
              onDisabledTabPress?.(tab);
              return;
            }

            if (Platform.OS === 'ios') {
              void Haptics.selectionAsync();
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const handleLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          if (tab.featured) {
            return (
              <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={isDisabled ? { disabled: true } : isFocused ? { selected: true } : undefined}
                key={route.key}
                onLongPress={handleLongPress}
                onPress={handlePress}
                style={styles.featuredButton}>
                <View style={[styles.featuredOuter, isFocused && styles.featuredOuterActive, isDisabled && styles.disabledFeaturedOuter]}>
                  <View style={[styles.featuredInner, isDisabled && styles.disabledFeaturedInner]}>
                    <MaterialCommunityIcons name={tab.icon} size={26} color={themeColors.surface} />
                  </View>
                </View>
                <Text style={[styles.featuredLabel, isFocused && styles.activeLabel, isDisabled && styles.disabledLabel]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isDisabled ? { disabled: true } : isFocused ? { selected: true } : undefined}
              key={route.key}
              onLongPress={handleLongPress}
              onPress={handlePress}
              style={styles.tabButton}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name={tab.icon} size={22} color={isDisabled ? themeColors.border : color} />
                {isNotificationsTab && unreadNotificationCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, isFocused && styles.activeLabel, isDisabled && styles.disabledLabel]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    alignItems: 'center',
    bottom: 0,
    left: 0,
    paddingHorizontal: 14,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
  },
  bar: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 430,
    paddingHorizontal: 6,
    shadowColor: themeColors.primary,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: '100%',
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    height: 68,
    justifyContent: 'center',
    minWidth: 0,
  },
  label: {
    color: INACTIVE,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    maxWidth: 76,
    textAlign: 'center',
  },
  iconContainer: {
    position: 'relative',
  },
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
    right: -12,
    top: -10,
  },
  unreadBadgeText: {
    color: themeColors.surface,
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  activeLabel: {
    color: ACTIVE,
  },
  featuredButton: {
    alignItems: 'center',
    flex: 1.14,
    height: 102,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  featuredOuter: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 42,
    borderWidth: 4,
    height: 84,
    justifyContent: 'center',
    marginTop: -32,
    shadowColor: themeColors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    width: 84,
  },
  featuredOuterActive: {
    borderColor: themeColors.surface,
  },
  featuredInner: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  disabledFeaturedOuter: {
    shadowOpacity: 0.08,
  },
  disabledFeaturedInner: {
    backgroundColor: themeColors.subtleForeground,
  },
  featuredLabel: {
    color: INACTIVE,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
    marginTop: 1,
    maxWidth: 80,
    textAlign: 'center',
  },
  disabledLabel: {
    color: themeColors.border,
  },
});
