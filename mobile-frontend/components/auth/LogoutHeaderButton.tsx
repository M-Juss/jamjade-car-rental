import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { LogoutConfirmationDialog } from '@/components/auth/LogoutConfirmationDialog';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';

export function LogoutHeaderButton() {
  const router = useRouter();
  const { signOut, status, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutInProgress = useRef(false);

  if (status !== 'authenticated') return null;

  const close = () => {
    if (!logoutInProgress.current) setVisible(false);
  };

  const confirm = async () => {
    if (logoutInProgress.current) return;
    logoutInProgress.current = true;
    setIsLoggingOut(true);

    try {
      await signOut();
    } finally {
      logoutInProgress.current = false;
      setIsLoggingOut(false);
      setVisible(false);
      router.replace('/login');
    }
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Log out"
        accessibilityHint="Opens a confirmation before signing out"
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoggingOut, busy: isLoggingOut }}
        disabled={isLoggingOut}
        onPress={() => setVisible(true)}
        className="h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface active:opacity-70">
        {isLoggingOut ? (
          <ActivityIndicator color={themeColors.foreground} size="small" />
        ) : (
          <LogOut accessible={false} color={themeColors.foreground} size={20} strokeWidth={2} />
        )}
      </Pressable>
      <LogoutConfirmationDialog
        accountLabel={user?.roles?.includes('driver') ? 'driver' : 'customer'}
        isLoading={isLoggingOut}
        onCancel={close}
        onConfirm={() => void confirm().catch(() => undefined)}
        visible={visible}
      />
    </>
  );
}
