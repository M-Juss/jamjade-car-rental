import { useFocusEffect } from '@react-navigation/native';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type CustomerTabBarVisibilityContextValue = {
  isTabBarHidden: boolean;
  handleTabScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  setTabBarHidden: (isHidden: boolean) => void;
};

const CustomerTabBarVisibilityContext =
  createContext<CustomerTabBarVisibilityContextValue | null>(null);

export function CustomerTabBarVisibilityProvider({ children }: PropsWithChildren) {
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);
  const previousOffsetY = useRef(0);

  const setTabBarHidden = useCallback((isHidden: boolean) => {
    setIsTabBarHidden(isHidden);
  }, []);

  const handleTabScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const scrollDelta = offsetY - previousOffsetY.current;

      if (offsetY < 20) {
        setTabBarHidden(false);
      } else if (scrollDelta > 10 && offsetY > 44) {
        setTabBarHidden(true);
      } else if (scrollDelta < -8) {
        setTabBarHidden(false);
      }

      previousOffsetY.current = Math.max(0, offsetY);
    },
    [setTabBarHidden],
  );

  const value = useMemo(
    () => ({
      handleTabScroll,
      isTabBarHidden,
      setTabBarHidden,
    }),
    [handleTabScroll, isTabBarHidden, setTabBarHidden],
  );

  return (
    <CustomerTabBarVisibilityContext.Provider value={value}>
      {children}
    </CustomerTabBarVisibilityContext.Provider>
  );
}

export function useCustomerTabBarVisibility() {
  const context = useContext(CustomerTabBarVisibilityContext);

  if (!context) {
    throw new Error('useCustomerTabBarVisibility must be used inside CustomerTabBarVisibilityProvider');
  }

  return context;
}

export function useAutoHideCustomerTabBar() {
  const { handleTabScroll, setTabBarHidden } = useCustomerTabBarVisibility();

  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(false);

      return () => setTabBarHidden(false);
    }, [setTabBarHidden]),
  );

  return handleTabScroll;
}
