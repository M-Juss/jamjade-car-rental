import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabBarSurface } from '@/components/navigation/FloatingTabBarSurface';
import { mobileLayout } from '@/constants/layout';

export type RcResearchTab = 'collect' | 'recordings';

export function RcResearchTabs({ selectedTab, onTabChange, onLogout, isLoggingOut, disabled = false }: {
  selectedTab: RcResearchTab;
  onTabChange: (tab: RcResearchTab) => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const select = (tab: RcResearchTab) => {
    if (disabled || isLoggingOut) return;
    onTabChange(tab);
  };

  if (keyboardVisible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.safeArea, {
      paddingBottom: insets.bottom + mobileLayout.floatingGap,
      paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right),
    }]}>
      <FloatingTabBarSurface items={[
        { key: 'recordings', label: 'Recordings', icon: 'database-outline', selected: selectedTab === 'recordings',
          disabled: disabled || isLoggingOut, onPress: () => select('recordings') },
        { key: 'collect', label: 'Collect', icon: 'flask-outline', featured: true, selected: selectedTab === 'collect',
          disabled: disabled || isLoggingOut, onPress: () => select('collect') },
        { key: 'logout', label: isLoggingOut ? 'Logging out…' : 'Logout', icon: 'logout',
          accessibilityLabel: 'Log out', accessibilityHint: 'Opens a confirmation before signing out',
          disabled: disabled || isLoggingOut, busy: isLoggingOut,
          onPress: () => { if (!disabled && !isLoggingOut) onLogout(); } },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { alignItems: 'center', bottom: 0, left: 0, right: 0, position: 'absolute' },
});
