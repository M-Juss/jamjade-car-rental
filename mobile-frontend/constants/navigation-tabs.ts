import type { ComponentProps } from 'react';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type AppTabIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type FloatingTabConfig = {
  routeName: string;
  label: string;
  icon: AppTabIcon;
  featured?: boolean;
  disabled?: boolean;
  disabledAccessibilityLabel?: string;
};
