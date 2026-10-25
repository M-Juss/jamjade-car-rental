import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoutConfirmationDialog } from '@/components/auth/LogoutConfirmationDialog';
import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { useLogoutConfirmation } from '@/hooks/use-logout-confirmation';
import { useAuth } from '@/providers/AuthProvider';
import { checkRcResearchAccess } from '@/services/api/rc-research.service';
import { ApiError } from '@/services/http';

import { RcNativeCollectionPanel } from './RcNativeCollectionPanel';
import { RcDataPanel } from './RcDataPanel';
import { RcResearchTabs, type RcResearchTab } from './RcResearchTabs';

export function RcResearchScreen() {
  const { signOut } = useAuth();
  const [state, setState] = useState<'checking' | 'ready' | 'error'>('checking');
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState<RcResearchTab>('collect');
  const [recording, setRecording] = useState(false);
  const verified = useRef(false);
  const logout = useLogoutConfirmation();

  useFocusEffect(useCallback(() => {
    let active = true;
    let revision = 0;
    const check = async () => {
      const current = ++revision;
      if (!verified.current) setState('checking');
      try {
        await checkRcResearchAccess();
        if (active && current === revision) { verified.current = true; setState('ready'); }
      } catch (error) {
        if (!active || current !== revision) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await signOut();
        } else {
          setState(verified.current ? 'ready' : 'error');
        }
      }
    };
    void check();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => { active = false; subscription.remove(); };
  }, [retry, signOut]));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      {state === 'checking' ? <ActivityIndicator accessibilityLabel="Checking access" color={themeColors.primary} className="my-6" /> : null}
      {state === 'error' ? <View className="mx-screen gap-3 rounded-card border border-border bg-surface p-card">
        <Text accessibilityRole="alert" className="font-sans text-body text-secondary-foreground">Unable to connect.</Text>
        <ActionButton label="Retry" onPress={() => setRetry(value => value + 1)} />
      </View> : null}
      <View className="flex-1" style={{ display: state === 'ready' && tab === 'collect' ? 'flex' : 'none' }}>
        <RcNativeCollectionPanel active={state === 'ready' && tab === 'collect'} onRecordingChange={setRecording} />
      </View>
      <View className="flex-1" style={{ display: state === 'ready' && tab === 'data' ? 'flex' : 'none' }}>
        <RcDataPanel active={state === 'ready' && tab === 'data'} revision={0} />
      </View>
      <RcResearchTabs
        selectedTab={tab}
        onTabChange={setTab}
        onLogout={logout.open}
        isLoggingOut={logout.isLoggingOut}
      />
      <LogoutConfirmationDialog
        accountLabel="admin"
        warning={recording ? 'Recording will stop. Saved recordings stay on this phone.' : undefined}
        visible={logout.visible}
        isLoading={logout.isLoggingOut}
        onCancel={logout.close}
        onConfirm={logout.confirm}
      />
    </SafeAreaView>
  );
}
