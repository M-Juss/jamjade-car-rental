import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingBottomTabBar } from '@/components/navigation/FloatingBottomTabBar';
import { type CustomerTabConfig } from '@/constants/customer-tabs';
import { themeColors } from '@/constants/theme';
import { useCustomer } from '@/lib/customer/customer-store';

type CustomerBottomTabBarProps = BottomTabBarProps & {
  tabs: CustomerTabConfig[];
};

export function CustomerBottomTabBar({ tabs, ...props }: CustomerBottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const customer = useCustomer();
  const [isTelematicsInfoVisible, setIsTelematicsInfoVisible] = useState(false);
  const hasActiveBooking = customer.bookingStatus === 'active' || customer.bookingStatus === 'ongoing';
  const floatingTabs = tabs.map((tab) => ({
    ...tab,
    disabled: Boolean(tab.requiresActiveBooking && !hasActiveBooking),
    disabledAccessibilityLabel: tab.requiresActiveBooking && !hasActiveBooking
      ? 'Telematics locked. Tap for activation information.'
      : undefined,
  }));

  return (
    <>
      <FloatingBottomTabBar
        {...props}
        onDisabledTabPress={(tab) => {
          if (tab.routeName === 'telematics') {
            setIsTelematicsInfoVisible(true);
          }
        }}
        tabs={floatingTabs}
      />
      <Modal
        animationType="fade"
        onRequestClose={() => setIsTelematicsInfoVisible(false)}
        transparent
        visible={isTelematicsInfoVisible}>
        <Pressable style={styles.infoBackdrop} onPress={() => setIsTelematicsInfoVisible(false)}>
          <Pressable
            accessibilityRole="alert"
            onPress={(event) => event.stopPropagation()}
            style={[styles.infoTooltip, { bottom: insets.bottom + 74 + 10 + 18 }]}
          >
            <View style={styles.infoTooltipArrow} />
            <View style={styles.infoTooltipIcon}>
              <MaterialCommunityIcons name="information-outline" size={18} color={themeColors.primary} />
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
  infoBackdrop: {
    backgroundColor: 'rgba(11, 18, 32, 0.2)',
    flex: 1,
  },
  infoTooltip: {
    alignSelf: 'center',
    backgroundColor: themeColors.foreground,
    borderColor: themeColors.primary,
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
    backgroundColor: themeColors.foreground,
    bottom: -7,
    height: 14,
    justifyContent: 'center',
    left: '50%',
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 14,
  },
  infoTooltipIcon: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
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
    color: themeColors.surface,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  infoTooltipText: {
    color: themeColors.border,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
  },
});
