import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getCurrentUser,
  getProfile,
  login,
  logout,
  register,
  restoreSession,
  updateAccountEmail,
  type MobileLoginPayload,
  type MobileRegisterPayload,
  type MobileUser,
} from '@/services/api';
import {
  hydrateCustomerFromProfile,
  hydrateCustomerFromUser,
  resetCustomer,
  updateRegisteredEmail,
} from '@/lib/customer/customer-store';
import type { UpdateAccountEmailInput } from '@/validation/account/schemas';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

type AuthContextValue = {
  status: AuthStatus;
  user: MobileUser | null;
  refreshProfile: () => Promise<MobileUser>;
  signIn: (payload: MobileLoginPayload) => Promise<MobileUser>;
  signUp: (payload: MobileRegisterPayload) => Promise<MobileUser>;
  signOut: (options?: { revokeRemoteToken?: boolean }) => Promise<void>;
  changeEmail: (values: UpdateAccountEmailInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<MobileUser | null>(null);

  const refreshProfile = useCallback(async () => {
    const profile = await getProfile();

    hydrateCustomerFromProfile(profile);
    setUser(profile.user);

    return profile.user;
  }, []);

  const applyUser = useCallback(
    async (nextUser: MobileUser) => {
      if (nextUser.roles?.includes('driver')) {
        setUser(nextUser);
        setStatus('authenticated');
        resetCustomer();

        return nextUser;
      }

      let authenticatedUser = nextUser;

      try {
        authenticatedUser = await refreshProfile();
      } catch {
        hydrateCustomerFromUser(nextUser);
        setUser(nextUser);
      }

      setStatus('authenticated');

      return authenticatedUser;
    },
    [refreshProfile],
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const token = await restoreSession();

        if (!token) {
          if (isMounted) {
            setStatus('guest');
          }
          return;
        }

        const nextUser = await getCurrentUser();

        if (isMounted) {
          await applyUser(nextUser);
        }
      } catch {
        await logout({ revokeRemoteToken: false });

        if (isMounted) {
          setUser(null);
          setStatus('guest');
          resetCustomer();
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      refreshProfile,
      signIn: async (payload) => {
        const session = await login(payload);
        return await applyUser(session.user);
      },
      signUp: async (payload) => {
        const session = await register(payload);
        return await applyUser(session.user);
      },
      changeEmail: async (values) => {
        const updatedUser = await updateAccountEmail(values);
        setUser(updatedUser);
        updateRegisteredEmail(updatedUser.email);
      },
      signOut: async (options) => {
        try {
          await logout(options);
        } finally {
          setUser(null);
          setStatus('guest');
          resetCustomer();
        }
      },
    }),
    [applyUser, refreshProfile, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
