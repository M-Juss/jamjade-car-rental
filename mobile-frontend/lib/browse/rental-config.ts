import type { OptionalService } from '@/types/browse';

export const SHOP_LOCATION = 'Jamjade Rent A Car Services';

export const JAMJADE_GARAGE = 'Jamjade Garage';

export const TERMS_VERSION = '2026-06-13';

export const REQUIRED_DOCUMENTS = [
  "Driver's License",
  'Meralco Bill / Proof of Address',
  'Passport (if requested by admin)',
];

export function formatDeliveryTime(value?: string | null) {
  if (!value) {
    return '';
  }

  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return value;
  }

  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export const optionalServices: OptionalService[] = [
  {
    id: 'delivery',
    label: 'Delivery service',
    description: 'Vehicle delivery to your preferred pickup point.',
    price: 900,
  },
  {
    id: 'owners_driver',
    label: "Owner's driver",
    description: 'Jamjade-coordinated driver for your trip.',
    price: 1800,
  },
  {
    id: 'dashcam',
    label: 'Dashcam access',
    description: 'Dashcam-enabled trip recording access.',
    price: 250,
  },
  {
    id: 'child_seat',
    label: 'Child seat',
    description: 'Clean child safety seat installed before pickup.',
    price: 350,
  },
  {
    id: 'extra_cleaning',
    label: 'Extra cleaning',
    description: 'Post-trip detail cleaning for heavy-use rentals.',
    price: 500,
  },
  {
    id: 'outside_manila',
    label: 'Out-of-Manila trip',
    description: 'Required for trips outside Metro Manila coverage.',
    price: 1000,
  },
];
