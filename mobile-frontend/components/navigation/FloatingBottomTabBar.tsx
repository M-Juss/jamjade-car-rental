import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamilies } from '@/constants/fonts';
import { mobileLayout } from '@/constants/layout';

import type { FloatingTabConfig } from '@/constants/navigation-tabs';
import { themeColors } from '@/constants/theme';
import { setUnreadNotificationCount, useUnreadNotificationCount } from '@/lib/customer/notification-unread';
import { getNotifications } from '@/services/api';

type FloatingBottomTabBarProps = BottomTabBarProps & {
  tabs: FloatingTabConfig[];
  onDisabledTabPress?: (tab: FloatingTabConfig) => void;
};

const ACTIVE = themeColors.primary;
const INACTIVE = themeColors.mutedForeground;
const BAR_HEIGHT = mobileLayout.tabBarHeight;
const BAR_LIFT = mobileLayout.tabBarLift;
const FLOAT_GAP = mobileLayout.floatingGap;

export function FloatingBottomTabBar({
  descriptors,
  navigation,
  onDisabledTabPress,
  state,
  tabs,
}: FloatingBottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const unreadNotificationCount = useUnreadNotificationCount();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(() => Keyboard.isVisible());
  const focusedRoute = state.routes[state.index];
  const isTabBarHidden =
    isKeyboardVisible && Boolean(descriptors[focusedRoute.key]?.options.tabBarHideOnKeyboard);
  const translateY = useRef(new Animated.Value(0)).current;
  const hideOffset = BAR_HEIGHT + BAR_LIFT + insets.bottom + FLOAT_GAP + 20;

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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

    return () => translateY.stopAnimation();
  }, [hideOffset, isTabBarHidden, translateY]);

  return (
    <Animated.View
      accessibilityElementsHidden={isTabBarHidden}
      importantForAccessibility={isTabBarHidden ? 'no-hide-descendants' : 'auto'}
      pointerEvents={isTabBarHidden ? 'none' : 'box-none'}
      style={[
        styles.safeArea,
        {
          paddingBottom: insets.bottom + FLOAT_GAP,
          paddingLeft: Math.max(12, insets.left),
          paddingRight: Math.max(12, insets.right),
          transform: [{ translateY }],
        },
      ]}>
      <View style={styles.bar}>
        <View pointerEvents="none" style={styles.barSurface} />
        {tabs.map((tab) => {
          const routeIndex = state.routes.findIndex((routeItem) => routeItem.name === tab.routeName);

          if (routeIndex === -1) {
            return null;
          }

          const route = state.routes[routeIndex];
          const options = descriptors[route.key]?.options;
          const isFocused = state.index === routeIndex;
          const isDisabled = Boolean(tab.disabled);
          const isFeatured = Boolean(tab.featured);
          const isNotificationsTab = tab.routeName === 'notifications';
          const color = isFocused ? ACTIVE : INACTIVE;
          const accessibilityLabel =
            isNotificationsTab && unreadNotificationCount > 0
              ? `${tab.label}, ${unreadNotificationCount} unread`
              : (tab.disabledAccessibilityLabel ?? options?.tabBarAccessibilityLabel ?? tab.label);

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

          return (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={
                isDisabled ? { disabled: true } : isFocused ? { selected: true } : undefined
              }
              key={route.key}
              onLongPress={handleLongPress}
              onPress={handlePress}
              // NativeWind's native interop needs static styles to preserve the equal-width layout.
              style={[styles.tabButton, isFeatured && styles.featuredButton]}>
              {({ pressed }) => (
                <View style={[styles.tabContent, pressed && styles.pressedTabButton]}>
                  <View
                    style={[
                      styles.iconContainer,
                      isFeatured && styles.featuredIconContainer,
                      isFeatured && isDisabled && styles.disabledFeaturedIconContainer,
                    ]}>
                    <MaterialCommunityIcons
                      name={tab.icon}
                      size={isFeatured ? 24 : 22}
                      color={isFeatured ? themeColors.surface : isDisabled ? themeColors.subtleForeground : color}
                    />
                    {isNotificationsTab && unreadNotificationCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text className="font-sans" style={styles.unreadBadgeText}>
                          {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    className="font-sans"
                    style={[
                      styles.label,
                      isFeatured && styles.featuredLabel,
                      isFocused && styles.activeLabel,
                      isDisabled && styles.disabledLabel,
                    ]}
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}>
                    {tab.label}
                  </Text>
                </View>
              )}
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
    right: 0,
    position: 'absolute',
  },
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
