import type { FleetQuery } from "@/validations/fleet/schemas";

export type FleetTrackingStatus = NonNullable<FleetQuery["status"]>;

export type FleetRental = {
  id: number;
  bookingCode: string;
  customerName: string | null;
  operator: { id: number; name: string | null; email: string | null; phoneNumber: string | null } | null;
  emergencyContacts: { name: string; relationship: string; phoneNumber: string }[];
  geofenceActivity: { id: string; type: "geofence_enter" | "geofence_exit"; zoneName: string; notificationRequested: boolean; occurredAt: string | null }[];
  rentalType: "self_drive" | "owners_driver";
  rentalStartAt: string | null;
  rentalEndAt: string | null;
  vehicle: { id: number; name: string; brand: string | null; model: string | null; plateNumber: string | null } | null;
  activityCounts: { driving: number; trip: number; unreadNotifications: number };
  tracking: {
    status: FleetTrackingStatus;
    tripStatus: "started" | "paused" | "ended" | null;
    lastLocationAt: string | null;
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
      expiresAt: string;
    } | null;
  };
};

export type FleetRentalsPage = {
  rentals: FleetRental[];
  page: number;
  lastPage: number;
  total: number;
  totalOngoing: number;
};
