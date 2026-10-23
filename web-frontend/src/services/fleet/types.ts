import type { FleetQuery } from "@/validations/fleet/schemas";

export type FleetTrackingStatus = NonNullable<FleetQuery["status"]>;

export type FleetRental = {
  id: number;
  bookingCode: string;
  customerName: string | null;
  rentalType: "self_drive" | "owners_driver";
  rentalStartAt: string | null;
  rentalEndAt: string | null;
  vehicle: { id: number; name: string; plateNumber: string | null } | null;
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
