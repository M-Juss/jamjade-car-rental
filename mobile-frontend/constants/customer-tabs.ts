import type { ComponentProps } from 'react';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type CustomerTabRouteName = 'index' | 'bookings' | 'telematics' | 'notifications' | 'profile';
export type CustomerTabIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type CustomerTabConfig = {
  routeName: CustomerTabRouteName;
  label: string;
  description: string;
  icon: CustomerTabIcon;
  featured?: boolean;
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
