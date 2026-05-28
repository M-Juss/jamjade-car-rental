import type {
  CalibrationStep,
  FlaggedEvent,
  TelematicsBooking,
  TelematicsGeofence,
  TelematicsMapData,
  TelematicsVehicle,
} from '@/types/telematics';

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

function toLocalIso(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

export function createMockActiveBooking(now = new Date()): TelematicsBooking {
  const pickupDateTime = new Date(now.getTime() - 96 * 60 * 1000);
  const returnDateTime = new Date(now.getTime() + (5 * 60 + 24) * 60 * 1000 + 12 * 1000);

  return {
    id: 'JJ-0001',
    status: 'active',
    tripStatus: 'not_started',
    rentalType: 'Self-Drive',
    customerName: 'Juan Dela Cruz',
    pickupDateTime: toLocalIso(pickupDateTime),
    returnDateTime: toLocalIso(returnDateTime),
    pickupLocation: 'Jamjade Office',
    returnLocation: 'Jamjade Office',
    paymentStatus: 'Partially Paid',
  };
}

export const mockCompletedBooking: TelematicsBooking = {
  id: 'JJ-0001',
  status: 'completed',
  tripStatus: 'started',
  rentalType: 'Self-Drive',
  customerName: 'Juan Dela Cruz',
  pickupDateTime: '2026-05-28T08:00:00',
  returnDateTime: '2026-05-28T18:00:00',
  pickupLocation: 'Jamjade Office',
  returnLocation: 'Jamjade Office',
  paymentStatus: 'Paid',
};

export const mockTelematicsVehicle: TelematicsVehicle = {
  name: 'Toyota Vios 2022',
  brand: 'Toyota',
  modelYear: '2022',
  plateNumber: 'ABC 1234',
  transmission: 'Automatic',
  fuelType: 'Gasoline',
  seats: 5,
  color: 'White',
  startingOdometer: '24,500 km',
  fuelLevel: 'Full',
  condition: 'Good',
  image: image('photo-1549924231-f129b911e442'),
};

export const initialCalibrationSteps: CalibrationStep[] = [
  {
    id: 'gps-permission',
    label: 'GPS Permission',
    description: 'Location access is checked for live trip monitoring.',
    status: 'pending',
  },
  {
    id: 'accelerometer',
    label: 'Accelerometer',
    description: 'Slight forward and backward phone movement is detected.',
    status: 'pending',
  },
  {
    id: 'gyroscope',
    label: 'Gyroscope',
    description: 'Slow left, right, and steering-like rotation is detected.',
    status: 'pending',
  },
  {
    id: 'device-stability',
    label: 'Device Stability',
    description: 'The phone stays stable on a flat surface before the trip.',
    status: 'pending',
  },
];

export const calibrationTestSteps = [
  'Keep device still',
  'Check GPS',
  'Check accelerometer',
  'Check gyroscope',
  'Confirm device stability',
];

export const mockMapData: TelematicsMapData = {
  vehicleLocation: {
    label: 'Vehicle',
    area: 'Quezon Avenue',
    latitude: 14.6488,
    longitude: 121.0509,
  },
  pickupLocation: {
    label: 'Pickup',
    area: 'Jamjade Office',
    latitude: 14.3294,
    longitude: 120.9367,
  },
  returnLocation: {
    label: 'Return',
    area: 'Jamjade Office',
    latitude: 14.3294,
    longitude: 120.9367,
  },
  geofenceCenter: {
    label: 'Allowed Area',
    area: 'Metro Manila and Cavite corridor',
    latitude: 14.5086,
    longitude: 121.0194,
  },
  geofenceRadiusKm: 38,
  routeTrail: [
    { label: 'Trail 1', area: 'Cavite', latitude: 14.3294, longitude: 120.9367 },
    { label: 'Trail 2', area: 'Pasay', latitude: 14.5378, longitude: 121.0014 },
    { label: 'Trail 3', area: 'Quezon City', latitude: 14.6488, longitude: 121.0509 },
  ],
};

export const mockGeofenceStatus: TelematicsGeofence = {
  status: 'inside',
  lastCheckedTime: '2:48 PM',
  currentArea: 'Quezon City',
  distanceFromBoundary: '12.4 km inside boundary',
};

export const mockFlaggedEvents: FlaggedEvent[] = [
  {
    id: 1,
    type: 'Sudden Brake',
    time: '2:35 PM',
    location: 'Quezon City',
    severity: 'Medium',
    description: 'Sudden deceleration detected during active monitoring.',
  },
  {
    id: 2,
    type: 'Sharp Turn',
    time: '2:42 PM',
    location: 'Manila',
    severity: 'Low',
    description: 'Sharp turn detected from gyroscope movement.',
  },
  {
    id: 3,
    type: 'Geofence Exit',
    time: '3:10 PM',
    location: 'Outside allowed area',
    severity: 'High',
    description: 'Vehicle moved outside the allowed rental boundary.',
  },
];

export const emptyFlaggedEvents: FlaggedEvent[] = [];
