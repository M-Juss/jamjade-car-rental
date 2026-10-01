import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { FloatingBottomTabBar } from '@/components/navigation/FloatingBottomTabBar';
import { type CustomerTabConfig } from '@/constants/customer-tabs';

type CustomerBottomTabBarProps = BottomTabBarProps & {
  tabs: CustomerTabConfig[];
};

export function CustomerBottomTabBar({ tabs, ...props }: CustomerBottomTabBarProps) {
  return <FloatingBottomTabBar {...props} tabs={tabs} />;
}
