import {
  Car,
  ClipboardList,
  CreditCard,
  Navigation,
  RefreshCcw,
  type LucideIcon,
} from 'lucide-react-native';

import type { BookingStatus } from '@/types/booking';

import type { ActionButtonVariant } from './ActionButton';

export type BookingActionKey =
  | 'view_details'
  | 'payment_info'
  | 'pay_balance'
  | 'open_telematics'
  | 'book_again'
  | 'book_another_vehicle';

export type BookingAction = {
  key: BookingActionKey;
  label: string;
  icon: LucideIcon;
  variant: ActionButtonVariant;
};

const detailAction: BookingAction = {
  key: 'view_details',
  label: 'View Details',
  icon: ClipboardList,
  variant: 'primary',
};

const actionsByStatus = {
  Pending: [detailAction],
  Confirmed: [
    detailAction,
    {
      key: 'open_telematics',
      label: 'View Telematics',
      icon: Navigation,
      variant: 'soft',
    },
    {
      key: 'payment_info',
      label: 'Payment Info',
      icon: CreditCard,
      variant: 'soft',
    },
  ],
  Active: [
    detailAction,
    {
      key: 'open_telematics',
      label: 'Open Telematics',
      icon: Navigation,
      variant: 'primary',
    },
  ],
  Ongoing: [
    detailAction,
    {
      key: 'open_telematics',
      label: 'Open Telematics',
      icon: Navigation,
      variant: 'primary',
    },
  ],
  Returned: [
    detailAction,
    {
      key: 'pay_balance',
      label: 'Review & Pay Balance',
      icon: CreditCard,
      variant: 'soft',
    },
  ],
  Completed: [
    detailAction,
    {
      key: 'book_again',
      label: 'Book Again',
      icon: RefreshCcw,
      variant: 'soft',
    },
  ],
  Rejected: [
    detailAction,
    {
      key: 'book_another_vehicle',
      label: 'Book Another Vehicle',
      icon: Car,
      variant: 'soft',
    },
  ],
  Cancelled: [
    detailAction,
    {
      key: 'book_another_vehicle',
      label: 'Book Another Vehicle',
      icon: Car,
      variant: 'soft',
    },
  ],
} satisfies Record<BookingStatus, BookingAction[]>;

export function getBookingActions(status: BookingStatus, options?: { includeDetails?: boolean; isSelfDrive?: boolean }) {
  const includeDetails = options?.includeDetails ?? true;
  const isSelfDrive = options?.isSelfDrive ?? false;
  const actions = actionsByStatus[status].filter(
    (action) => isSelfDrive || action.key !== 'open_telematics',
  );

  if (includeDetails) {
    return actions;
  }

  return actions.filter((action) => action.key !== 'view_details');
}
