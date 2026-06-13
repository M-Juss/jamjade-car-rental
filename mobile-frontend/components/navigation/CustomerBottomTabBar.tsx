import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCustomerTabBarVisibility } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { type CustomerTabConfig } from '@/constants/customer-tabs';
import { useCustomer } from '@/lib/customer/customer-store';
import {
  setUnreadNotificationCount,
  useUnreadNotificationCount,
} from '@/lib/customer/notification-unread';
import { getNotifications } from '@/services/api';

type CustomerBottomTabBarProps = BottomTabBarProps & {
  tabs: CustomerTabConfig[];
};

const ACTIVE = '#1F58E7';
const INACTIVE = '#88A2CF';
const BAR = '#FFFFFF';
const FEATURED = '#346EF6';
const FLOAT_GAP = 10;
const BAR_HEIGHT = 74;

export function CustomerBottomTabBar({
  descriptors,
  navigation,
  state,
  tabs,
}: CustomerBottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const customer = useCustomer();
  const unreadNotificationCount = useUnreadNotificationCount();
  const { isTabBarHidden } = useCustomerTabBarVisibility();
  const [isTelematicsInfoVisible, setIsTelematicsInfoVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const hideOffset = BAR_HEIGHT + insets.bottom + FLOAT_GAP + 20;
  const hasActiveBooking = customer.bookingStatus === 'active' || customer.bookingStatus === 'ongoing';

  useEffect(() => {
    let isActive = true;

    void getNotifications()
      .then((notifications) => {
        if (isActive) {
          setUnreadNotificationCount(
            notifications.filter((notification) => !notification.isRead).length,
          );
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
    <>
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
          const isDisabled = Boolean(tab.requiresActiveBooking && !hasActiveBooking);
          const color = isFocused ? ACTIVE : INACTIVE;
          const isNotificationsTab = tab.routeName === 'notifications';
          const accessibilityLabel = isNotificationsTab && unreadNotificationCount > 0
            ? `${tab.label}, ${unreadNotificationCount} unread`
            : isDisabled && tab.routeName === 'telematics'
              ? 'Telematics locked. Tap for activation information.'
              : options.tabBarAccessibilityLabel;

          const handlePress = () => {
            if (isDisabled) {
              if (tab.routeName === 'telematics') {
                setIsTelematicsInfoVisible(true);
              }
              return;
            }

            if (Platform.OS === 'ios') {
              Haptics.selectionAsync();
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
                    <MaterialCommunityIcons name={tab.icon} size={26} color="#FFFFFF" />
                    {isDisabled ? (
                      <View style={styles.featuredInfoBadge}>
                        <MaterialCommunityIcons name="information-outline" size={13} color="#346EF6" />
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text
                  style={[
                    styles.featuredLabel,
                    isFocused && styles.activeLabel,
                    isDisabled && styles.disabledLabel,
                  ]}
                  numberOfLines={1}>
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
                <MaterialCommunityIcons name={tab.icon} size={22} color={isDisabled ? '#C7D0E2' : color} />
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
    <Modal
      animationType="fade"
      onRequestClose={() => setIsTelematicsInfoVisible(false)}
      transparent
      visible={isTelematicsInfoVisible}>
      <Pressable style={styles.infoBackdrop} onPress={() => setIsTelematicsInfoVisible(false)}>
        <Pressable
          accessibilityRole="alert"
          onPress={(event) => event.stopPropagation()}
          style={[styles.infoTooltip, { bottom: insets.bottom + BAR_HEIGHT + FLOAT_GAP + 18 }]}>
          <View style={styles.infoTooltipArrow} />
          <View style={styles.infoTooltipIcon}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#346EF6" />
          </View>
          <View style={styles.infoTooltipContent}>
            <Text style={styles.infoTooltipTitle}>Telematics activation</Text>
            <Text style={styles.infoTooltipText}>
              This feature will only activate when the owner starts your self-drive booking.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
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
    backgroundColor: BAR,
    borderColor: '#D6E5FF',
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 430,
    paddingHorizontal: 6,
    shadowColor: '#1F58E7',
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
    backgroundColor: '#DC2626',
    borderColor: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderColor: '#E2ECFF',
    borderRadius: 42,
    borderWidth: 4,
    height: 84,
    justifyContent: 'center',
    marginTop: -32,
    shadowColor: FEATURED,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    width: 84,
  },
  featuredOuterActive: {
    borderColor: '#FFFFFF',
  },
  featuredInner: {
    alignItems: 'center',
    backgroundColor: FEATURED,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  featuredInfoBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E5FF',
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
  },
  disabledFeaturedOuter: {
    shadowOpacity: 0.08,
  },
  disabledFeaturedInner: {
    backgroundColor: '#A8B2C3',
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
    color: '#C7D0E2',
  },
  infoBackdrop: {
    backgroundColor: 'rgba(11, 18, 32, 0.2)',
    flex: 1,
  },
  infoTooltip: {
    alignSelf: 'center',
    backgroundColor: '#17315F',
    borderColor: '#346EF6',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 24,
    maxWidth: 360,
    paddingHorizontal: 16,
    paddingVertical: 15,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  infoTooltipArrow: {
    alignSelf: 'center',
    backgroundColor: '#17315F',
    bottom: -7,
    height: 14,
    left: '50%',
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 14,
  },
  infoTooltipIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoTooltipContent: {
    flex: 1,
    minWidth: 0,
  },
  infoTooltipTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  infoTooltipText: {
    color: '#D8E5FF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
  },
});
