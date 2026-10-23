import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mobileLayout } from '@/constants/layout';

import type { FloatingTabConfig } from '@/constants/navigation-tabs';
import { getUnreadNotificationRevision, setUnreadNotificationCount, useUnreadNotificationCount } from '@/lib/customer/notification-unread';
import { getUnreadNotificationCount } from '@/services/api';

import { FloatingTabBarSurface } from './FloatingTabBarSurface';

type FloatingBottomTabBarProps = BottomTabBarProps & {
  tabs: FloatingTabConfig[];
  onDisabledTabPress?: (tab: FloatingTabConfig) => void;
};

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

    const revision = getUnreadNotificationRevision();
    void getUnreadNotificationCount()
      .then((count) => {
        if (isActive && revision === getUnreadNotificationRevision()) {
          setUnreadNotificationCount(count);
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
      <FloatingTabBarSurface items={tabs.flatMap((tab) => {
        const routeIndex = state.routes.findIndex((routeItem) => routeItem.name === tab.routeName);
        if (routeIndex === -1) return [];
        const route = state.routes[routeIndex];
        const options = descriptors[route.key]?.options;
        const isFocused = state.index === routeIndex;
        const isDisabled = Boolean(tab.disabled);
        const isNotificationsTab = tab.routeName === 'notifications';
        return [{
          key: route.key,
          label: tab.label,
          icon: tab.icon,
          selected: isFocused,
          disabled: isDisabled,
          onDisabledPress: isDisabled && onDisabledTabPress ? () => onDisabledTabPress(tab) : undefined,
          featured: tab.featured,
          badgeCount: isNotificationsTab ? unreadNotificationCount : undefined,
          accessibilityLabel: isNotificationsTab && unreadNotificationCount > 0
            ? `${tab.label}, ${unreadNotificationCount} unread`
            : (tab.disabledAccessibilityLabel ?? options?.tabBarAccessibilityLabel ?? tab.label),
          onPress: () => {
            if (isDisabled) { onDisabledTabPress?.(tab); return; }
            if (Platform.OS === 'ios') void Haptics.selectionAsync();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          },
          onLongPress: () => { navigation.emit({ type: 'tabLongPress', target: route.key }); },
        }];
      })} />
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
});
