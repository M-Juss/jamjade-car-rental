export type VehicleStatus = "Active" | "Paused" | "Idle" | "Geofence Alert" | "GPS Lost";
export type GeofenceState = "Inside" | "Outside" | "Boundary";
export type AlertType = "None" | "Geofence" | "Driving Incident" | "GPS" | "Overspeed";
export type VehicleType = "SUV" | "Sedan" | "Van" | "Pickup";
export type LogEventType =
  | "Start trip"
  | "Pause"
  | "Resume"
  | "Harsh brake"
  | "Sudden acceleration"
  | "Sharp turn"
  | "Geofence exit"
  | "GPS lost";

export type DrivingLog = {
  id: string;
  type: LogEventType;
  timestamp: string;
  note: string;
  severity: "low" | "medium" | "high";
};

export type IncidentItem = {
  id: string;
  label: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
};

export type FleetVehicle = {
  id: string;
  bookingId: string;
  plateNumber: string;
  carName: string;
  customerName: string;
  customerPhone: string;
  vehicleType: VehicleType;
  status: VehicleStatus;
  alertType: AlertType;
  geofenceState: GeofenceState;
  speedKph: number;
  lastUpdate: string;
  rentalStart: string;
  rentalEnd: string;
  tripStatus: "In progress" | "Paused" | "Idle" | "Signal lost";
  lat: number;
  lng: number;
  batteryPercent: number;
  gpsSignalPercent: number;
  currentZone: string;
  allowedZone: string;
  distanceFromBoundaryKm: number;
  geofenceSeverity: "Low" | "Medium" | "High";
  behavior: {
    harshBraking: number;
    suddenAcceleration: number;
    sharpTurns: number;
    idleMinutes: number;
    safetyScore: number;
  };
  drivingLogs: DrivingLog[];
  incidents: IncidentItem[];
};

const now = "May 17, 2026 11:42 AM";

export const fleetVehicles: FleetVehicle[] = [
  {
    id: "VH-1001",
    bookingId: "BK-30291",
    plateNumber: "NAN-2487",
    carName: "Toyota Fortuner",
    customerName: "Ariana Santos",
    customerPhone: "+63 917 332 1044",
    vehicleType: "SUV",
    status: "Active",
    alertType: "None",
    geofenceState: "Inside",
    speedKph: 61,
    lastUpdate: "20 sec ago",
    rentalStart: "May 17, 2026 08:10 AM",
    rentalEnd: "May 19, 2026 08:10 AM",
    tripStatus: "In progress",
    lat: 14.6012,
    lng: 121.0365,
    batteryPercent: 88,
    gpsSignalPercent: 96,
    currentZone: "Makati Core",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 5.2,
    geofenceSeverity: "Low",
    behavior: { harshBraking: 1, suddenAcceleration: 2, sharpTurns: 1, idleMinutes: 12, safetyScore: 92 },
    drivingLogs: [
      { id: "L1", type: "Start trip", timestamp: "08:10 AM", note: "Trip started from JamJade Hub", severity: "low" },
      { id: "L2", type: "Sudden acceleration", timestamp: "09:02 AM", note: "Accel spike at EDSA", severity: "medium" },
      { id: "L3", type: "Resume", timestamp: "10:18 AM", note: "Resumed after quick stop", severity: "low" },
    ],
    incidents: [{ id: "I1", label: "Mild overspeed detected", timestamp: "09:05 AM", severity: "low" }],
  },
  {
    id: "VH-1002",
    bookingId: "BK-30292",
    plateNumber: "NBC-1190",
    carName: "Honda City",
    customerName: "Mark Valdez",
    customerPhone: "+63 917 731 8830",
    vehicleType: "Sedan",
    status: "Idle",
    alertType: "None",
    geofenceState: "Inside",
    speedKph: 0,
    lastUpdate: "1 min ago",
    rentalStart: "May 17, 2026 07:40 AM",
    rentalEnd: "May 18, 2026 07:40 AM",
    tripStatus: "Idle",
    lat: 14.5547,
    lng: 121.0244,
    batteryPercent: 79,
    gpsSignalPercent: 92,
    currentZone: "BGC North",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 6.1,
    geofenceSeverity: "Low",
    behavior: { harshBraking: 0, suddenAcceleration: 1, sharpTurns: 0, idleMinutes: 34, safetyScore: 95 },
    drivingLogs: [
      { id: "L4", type: "Start trip", timestamp: "07:40 AM", note: "Vehicle released", severity: "low" },
      { id: "L5", type: "Pause", timestamp: "10:40 AM", note: "Parked near BGC High Street", severity: "low" },
    ],
    incidents: [],
  },
  {
    id: "VH-1003",
    bookingId: "BK-30293",
    plateNumber: "NDQ-5781",
    carName: "Mitsubishi Montero",
    customerName: "Leanne Cruz",
    customerPhone: "+63 998 773 0045",
    vehicleType: "SUV",
    status: "Paused",
    alertType: "Driving Incident",
    geofenceState: "Boundary",
    speedKph: 7,
    lastUpdate: "35 sec ago",
    rentalStart: "May 17, 2026 06:55 AM",
    rentalEnd: "May 20, 2026 06:55 AM",
    tripStatus: "Paused",
    lat: 14.5665,
    lng: 121.0699,
    batteryPercent: 65,
    gpsSignalPercent: 86,
    currentZone: "Pasig Arc",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 0.4,
    geofenceSeverity: "Medium",
    behavior: { harshBraking: 4, suddenAcceleration: 3, sharpTurns: 2, idleMinutes: 19, safetyScore: 73 },
    drivingLogs: [
      { id: "L6", type: "Start trip", timestamp: "06:55 AM", note: "Trip initiated", severity: "low" },
      { id: "L7", type: "Harsh brake", timestamp: "09:51 AM", note: "Hard brake event", severity: "high" },
      { id: "L8", type: "Pause", timestamp: "10:23 AM", note: "Vehicle temporarily stopped", severity: "low" },
    ],
    incidents: [{ id: "I2", label: "Harsh brake flagged", timestamp: "09:51 AM", severity: "high" }],
  },
  {
    id: "VH-1004",
    bookingId: "BK-30294",
    plateNumber: "NQE-4402",
    carName: "Toyota Innova",
    customerName: "Jose David",
    customerPhone: "+63 927 110 2901",
    vehicleType: "Van",
    status: "Geofence Alert",
    alertType: "Geofence",
    geofenceState: "Outside",
    speedKph: 54,
    lastUpdate: "10 sec ago",
    rentalStart: "May 17, 2026 07:20 AM",
    rentalEnd: "May 18, 2026 11:20 PM",
    tripStatus: "In progress",
    lat: 14.7114,
    lng: 121.0857,
    batteryPercent: 70,
    gpsSignalPercent: 90,
    currentZone: "Quezon Fringe",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 2.8,
    geofenceSeverity: "High",
    behavior: { harshBraking: 2, suddenAcceleration: 4, sharpTurns: 3, idleMinutes: 6, safetyScore: 64 },
    drivingLogs: [
      { id: "L9", type: "Start trip", timestamp: "07:20 AM", note: "Pickup from QC", severity: "low" },
      { id: "L10", type: "Geofence exit", timestamp: "11:18 AM", note: "Exited allowed NCR zone", severity: "high" },
    ],
    incidents: [
      { id: "I3", label: "Geofence breach", timestamp: "11:18 AM", severity: "high" },
      { id: "I4", label: "Overspeed spike", timestamp: "11:24 AM", severity: "medium" },
    ],
  },
  {
    id: "VH-1005",
    bookingId: "BK-30295",
    plateNumber: "NAT-6722",
    carName: "Ford Ranger",
    customerName: "Paolo Ignacio",
    customerPhone: "+63 917 922 1049",
    vehicleType: "Pickup",
    status: "GPS Lost",
    alertType: "GPS",
    geofenceState: "Boundary",
    speedKph: 0,
    lastUpdate: "8 min ago",
    rentalStart: "May 17, 2026 05:35 AM",
    rentalEnd: "May 17, 2026 11:35 PM",
    tripStatus: "Signal lost",
    lat: 14.6401,
    lng: 121.0354,
    batteryPercent: 41,
    gpsSignalPercent: 12,
    currentZone: "Unknown",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 1.1,
    geofenceSeverity: "Medium",
    behavior: { harshBraking: 1, suddenAcceleration: 1, sharpTurns: 1, idleMinutes: 52, safetyScore: 58 },
    drivingLogs: [
      { id: "L11", type: "Start trip", timestamp: "05:35 AM", note: "Trip started", severity: "low" },
      { id: "L12", type: "GPS lost", timestamp: "11:34 AM", note: "No telemetry for 8 minutes", severity: "high" },
    ],
    incidents: [{ id: "I5", label: "GPS signal loss", timestamp: "11:34 AM", severity: "high" }],
  },
  {
    id: "VH-1006",
    bookingId: "BK-30296",
    plateNumber: "NEA-8813",
    carName: "Nissan Navara",
    customerName: "Bianca Flores",
    customerPhone: "+63 977 255 0091",
    vehicleType: "Pickup",
    status: "Active",
    alertType: "None",
    geofenceState: "Inside",
    speedKph: 48,
    lastUpdate: "25 sec ago",
    rentalStart: "May 17, 2026 08:50 AM",
    rentalEnd: "May 19, 2026 08:50 AM",
    tripStatus: "In progress",
    lat: 14.5312,
    lng: 121.0481,
    batteryPercent: 91,
    gpsSignalPercent: 97,
    currentZone: "Paranaque East",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 4.6,
    geofenceSeverity: "Low",
    behavior: { harshBraking: 0, suddenAcceleration: 1, sharpTurns: 1, idleMinutes: 8, safetyScore: 97 },
    drivingLogs: [
      { id: "L13", type: "Start trip", timestamp: "08:50 AM", note: "Departed from depot", severity: "low" },
      { id: "L14", type: "Sharp turn", timestamp: "10:05 AM", note: "Sharp turn at service road", severity: "medium" },
    ],
    incidents: [],
  },
  {
    id: "VH-1007",
    bookingId: "BK-30297",
    plateNumber: "NFE-1205",
    carName: "Hyundai Staria",
    customerName: "Nico Yap",
    customerPhone: "+63 915 724 9000",
    vehicleType: "Van",
    status: "Active",
    alertType: "Overspeed",
    geofenceState: "Inside",
    speedKph: 89,
    lastUpdate: "15 sec ago",
    rentalStart: "May 17, 2026 09:10 AM",
    rentalEnd: "May 19, 2026 09:10 AM",
    tripStatus: "In progress",
    lat: 14.5202,
    lng: 121.0033,
    batteryPercent: 76,
    gpsSignalPercent: 94,
    currentZone: "Pasay Link",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 3.9,
    geofenceSeverity: "Low",
    behavior: { harshBraking: 3, suddenAcceleration: 2, sharpTurns: 2, idleMinutes: 5, safetyScore: 76 },
    drivingLogs: [
      { id: "L15", type: "Start trip", timestamp: "09:10 AM", note: "Corporate pickup", severity: "low" },
      { id: "L16", type: "Sudden acceleration", timestamp: "11:08 AM", note: "Acceleration spike", severity: "medium" },
    ],
    incidents: [{ id: "I6", label: "Overspeed 89 kph", timestamp: "11:30 AM", severity: "medium" }],
  },
  {
    id: "VH-1008",
    bookingId: "BK-30298",
    plateNumber: "NLC-9098",
    carName: "Toyota Vios",
    customerName: "Rica Manalo",
    customerPhone: "+63 927 880 1166",
    vehicleType: "Sedan",
    status: "Paused",
    alertType: "None",
    geofenceState: "Inside",
    speedKph: 0,
    lastUpdate: "2 min ago",
    rentalStart: "May 17, 2026 07:00 AM",
    rentalEnd: "May 18, 2026 07:00 PM",
    tripStatus: "Paused",
    lat: 14.5814,
    lng: 121.0117,
    batteryPercent: 82,
    gpsSignalPercent: 88,
    currentZone: "Mandaluyong Mid",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 4.9,
    geofenceSeverity: "Low",
    behavior: { harshBraking: 1, suddenAcceleration: 1, sharpTurns: 0, idleMinutes: 27, safetyScore: 89 },
    drivingLogs: [
      { id: "L17", type: "Start trip", timestamp: "07:00 AM", note: "Started from office", severity: "low" },
      { id: "L18", type: "Pause", timestamp: "11:10 AM", note: "Fuel stop", severity: "low" },
    ],
    incidents: [],
  },
  {
    id: "VH-1009",
    bookingId: "BK-30299",
    plateNumber: "NPT-2009",
    carName: "Isuzu Mu-X",
    customerName: "Harvey Lim",
    customerPhone: "+63 939 880 1180",
    vehicleType: "SUV",
    status: "Idle",
    alertType: "Driving Incident",
    geofenceState: "Inside",
    speedKph: 0,
    lastUpdate: "1 min ago",
    rentalStart: "May 17, 2026 06:45 AM",
    rentalEnd: "May 17, 2026 10:45 PM",
    tripStatus: "Idle",
    lat: 14.5898,
    lng: 120.9909,
    batteryPercent: 68,
    gpsSignalPercent: 84,
    currentZone: "Manila Bay Arc",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 7.2,
    geofenceSeverity: "Low",
    behavior: { harshBraking: 5, suddenAcceleration: 3, sharpTurns: 4, idleMinutes: 45, safetyScore: 61 },
    drivingLogs: [
      { id: "L19", type: "Start trip", timestamp: "06:45 AM", note: "Airport pickup", severity: "low" },
      { id: "L20", type: "Harsh brake", timestamp: "10:20 AM", note: "Emergency stop", severity: "high" },
      { id: "L21", type: "Sharp turn", timestamp: "10:41 AM", note: "Sharp curve event", severity: "medium" },
    ],
    incidents: [{ id: "I7", label: "Multiple hard braking events", timestamp: "10:20 AM", severity: "high" }],
  },
  {
    id: "VH-1010",
    bookingId: "BK-30300",
    plateNumber: "NSB-5503",
    carName: "Suzuki Ertiga",
    customerName: "Gina Perez",
    customerPhone: "+63 977 123 2033",
    vehicleType: "Van",
    status: "Active",
    alertType: "None",
    geofenceState: "Inside",
    speedKph: 38,
    lastUpdate: "40 sec ago",
    rentalStart: "May 17, 2026 09:35 AM",
    rentalEnd: "May 18, 2026 09:35 PM",
    tripStatus: "In progress",
    lat: 14.5533,
    lng: 121.0612,
    batteryPercent: 90,
    gpsSignalPercent: 98,
    currentZone: "Ortigas Loop",
    allowedZone: "NCR Metro Zone",
    distanceFromBoundaryKm: 5.8,
    geofenceSeverity: "Low",
    behavior: { harshBraking: 0, suddenAcceleration: 1, sharpTurns: 1, idleMinutes: 9, safetyScore: 96 },
    drivingLogs: [
      { id: "L22", type: "Start trip", timestamp: "09:35 AM", note: "Family rental route", severity: "low" },
      { id: "L23", type: "Resume", timestamp: "10:54 AM", note: "Resumed from parking", severity: "low" },
    ],
    incidents: [],
  },
];

export const lastSyncedLabel = now;

export const filterOptions = {
  status: ["All", "Active", "Paused", "Idle", "Geofence Alert", "GPS Lost"],
  geofence: ["All", "Inside", "Outside", "Boundary"],
  alertType: ["All", "None", "Geofence", "Driving Incident", "GPS", "Overspeed"],
  vehicleType: ["All", "SUV", "Sedan", "Van", "Pickup"],
} as const;
