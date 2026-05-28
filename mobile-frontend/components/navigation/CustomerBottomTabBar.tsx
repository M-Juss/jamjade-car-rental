import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCustomerTabBarVisibility } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { type CustomerTabConfig } from '@/constants/customer-tabs';
import { useCustomer } from '@/lib/customer/customer-store';

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
  const { isTabBarHidden } = useCustomerTabBarVisibility();
  const translateY = useRef(new Animated.Value(0)).current;
  const hideOffset = BAR_HEIGHT + insets.bottom + FLOAT_GAP + 20;
  const hasActiveBooking = customer.bookingStatus === 'active' || customer.bookingStatus === 'ongoing';

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
          const isDisabled = Boolean(tab.requiresActiveBooking && !hasActiveBooking);
          const color = isFocused ? ACTIVE : INACTIVE;

          const handlePress = () => {
            if (isDisabled) {
              console.log(`${tab.label} tab is disabled until an active booking is available.`);
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
                accessibilityLabel={options.tabBarAccessibilityLabel}
                accessibilityRole="button"
                accessibilityState={isDisabled ? { disabled: true } : isFocused ? { selected: true } : undefined}
                key={route.key}
                onLongPress={handleLongPress}
                onPress={handlePress}
                style={styles.featuredButton}>
                <View style={[styles.featuredOuter, isFocused && styles.featuredOuterActive, isDisabled && styles.disabledFeaturedOuter]}>
                  <View style={[styles.featuredInner, isDisabled && styles.disabledFeaturedInner]}>
                    <MaterialCommunityIcons name={tab.icon} size={26} color="#FFFFFF" />
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
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isDisabled ? { disabled: true } : isFocused ? { selected: true } : undefined}
              key={route.key}
              onLongPress={handleLongPress}
              onPress={handlePress}
              style={styles.tabButton}>
              <MaterialCommunityIcons name={tab.icon} size={22} color={isDisabled ? '#C7D0E2' : color} />
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
});
