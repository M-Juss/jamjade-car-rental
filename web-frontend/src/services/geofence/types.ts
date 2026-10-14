import type { GeofenceCoordinate } from "@/services/booking/types";

export type GeofenceRecord = {
  id: string;
  name: string;
  geometryType: "circle" | "polygon";
  centerLatitude: number | null;
  centerLongitude: number | null;
  radiusMeters: number | null;
  polygonCoordinates: GeofenceCoordinate[] | null;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  rentalSnapshotCount: number;
  createdBy?: { id: string; name: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
