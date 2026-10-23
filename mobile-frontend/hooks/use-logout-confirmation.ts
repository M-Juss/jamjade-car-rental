import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

export function useLogoutConfirmation() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [visible, setVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutInProgress = useRef(false);

  const open = () => {
    if (!logoutInProgress.current) setVisible(true);
  };

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

  return {
    visible,
    isLoggingOut,
    open,
    close,
    confirm: () => void confirm().catch(() => undefined),
  };
}
