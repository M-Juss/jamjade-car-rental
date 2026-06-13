export type TelematicsBookingStatus = 'pending' | 'active' | 'ongoing' | 'completed';

export type TripStatus = 'not_started' | 'started' | 'paused';

export type CalibrationStatus = 'pending' | 'checking' | 'passed' | 'failed';

export type CalibrationStep = {
  id: string;
  label: string;
  description: string;
  status: CalibrationStatus;
};

export type GeofenceStatus = 'inside' | 'near_boundary' | 'outside' | 'gps_unavailable';

export type FlaggedEventSeverity = 'Low' | 'Medium' | 'High';

export type FlaggedEvent = {
  id: number;
  type: string;
  time: string;
  location: string;
  severity: FlaggedEventSeverity;
  description: string;
};

export type PenaltyLog = {
  id: string;
  time: string;
  description: string;
  charge: number;
};

export type TelematicsBooking = {
  id: string;
  status: TelematicsBookingStatus;
  tripStatus: TripStatus;
  rentalType: 'Self-Drive' | "Owner's Driver";
  customerName: string;
  pickupDateTime: string;
  returnDateTime: string;
  pickupLocation: string;
  returnLocation: string;
  paymentStatus: 'Partially Paid' | 'Paid' | 'Unpaid';
};

export type TelematicsVehicle = {
  name: string;
  brand: string;
  modelYear: string;
  transmission: string;
  fuelType: string;
  seats: number;
  color: string;
  startingOdometer: string;
  fuelLevel: string;
  condition: string;
  image: string;
};

export type TelematicsMapPoint = {
  label: string;
  area: string;
  latitude: number;
  longitude: number;
};

export type TelematicsMapData = {
  vehicleLocation: TelematicsMapPoint;
  pickupLocation: TelematicsMapPoint;
  returnLocation: TelematicsMapPoint;
  geofenceCenter: TelematicsMapPoint;
  geofenceRadiusKm: number;
  routeTrail: TelematicsMapPoint[];
};

export type TelematicsGeofence = {
  status: GeofenceStatus;
  lastCheckedTime: string;
  currentArea: string;
  distanceFromBoundary: string;
};
