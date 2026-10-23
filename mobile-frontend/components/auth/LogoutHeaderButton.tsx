import { LogOut } from 'lucide-react-native';
import { ActivityIndicator, Pressable } from 'react-native';

import { LogoutConfirmationDialog } from '@/components/auth/LogoutConfirmationDialog';
import { themeColors } from '@/constants/theme';
import { useLogoutConfirmation } from '@/hooks/use-logout-confirmation';
import { useAuth } from '@/providers/AuthProvider';
import { isResearchAdmin } from '@/lib/auth/mobile-access';

export function LogoutHeaderButton() {
  const { status, user } = useAuth();
  const { visible, isLoggingOut, open, close, confirm } = useLogoutConfirmation();

  if (status !== 'authenticated') return null;

  return (
    <>
      <Pressable
        accessibilityLabel="Log out"
        accessibilityHint="Opens a confirmation before signing out"
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoggingOut, busy: isLoggingOut }}
        disabled={isLoggingOut}
        onPress={open}
        className="h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface active:opacity-70">
        {isLoggingOut ? (
          <ActivityIndicator color={themeColors.foreground} size="small" />
        ) : (
          <LogOut accessible={false} color={themeColors.foreground} size={20} strokeWidth={2} />
        )}
      </Pressable>
      <LogoutConfirmationDialog
        accountLabel={isResearchAdmin(user) ? 'admin' : user?.roles?.includes('driver') ? 'driver' : 'customer'}
        isLoading={isLoggingOut}
        onCancel={close}
        onConfirm={confirm}
        visible={visible}
      />
    </>
  );
}
