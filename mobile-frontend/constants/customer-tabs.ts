import type { FloatingTabConfig } from './navigation-tabs';

export type CustomerTabRouteName = 'index' | 'bookings' | 'telematics' | 'notifications' | 'profile';
export type CustomerTabIcon = FloatingTabConfig['icon'];

export type CustomerTabConfig = FloatingTabConfig & {
  routeName: CustomerTabRouteName;
  description: string;
  requiresActiveBooking?: boolean;
};

export const CUSTOMER_TABS: CustomerTabConfig[] = [
  {
    routeName: 'index',
    label: 'Browse',
    description: 'Main customer rental flow',
    icon: 'car-sports',
  },
  {
    routeName: 'bookings',
    label: 'Booking',
    description: 'Booking tracking and rental records',
    icon: 'calendar-clock',
  },
  {
    routeName: 'telematics',
    label: 'Telematics',
    description: 'Active trip monitoring only',
    icon: 'steering',
    featured: true,
    requiresActiveBooking: true,
  },
  {
    routeName: 'notifications',
    label: 'Notif',
    description: 'Booking, payment, vehicle, trip, and service updates',
    icon: 'bell-outline',
  },
  {
    routeName: 'profile',
    label: 'Profile',
    description: 'Customer information, documents, and settings',
    icon: 'account-circle-outline',
  },
];
