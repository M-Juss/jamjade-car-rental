import type { FloatingTabConfig } from './navigation-tabs';

export const DRIVER_TABS: FloatingTabConfig[] = [
  {
    routeName: 'notifications',
    label: 'Notif',
    icon: 'bell-outline',
  },
  {
    routeName: 'services',
    label: 'Services',
    icon: 'briefcase-outline',
    featured: true,
  },
  {
    routeName: 'logout',
    label: 'Logout',
    icon: 'logout',
  },
];
