import type { GeofenceCoordinate } from "@/services/booking/types";

export type GeofenceRecord = {
  id: string;
  name: string;
  geometryType: "circle" | "polygon";
  centerLatitude: number | null;
  centerLongitude: number | null;
  radiusMeters: number | null;
  polygonCoordinates: GeofenceCoordinate[] | null;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  assignedBookingCount: number;
  createdBy?: { id: string; name: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
