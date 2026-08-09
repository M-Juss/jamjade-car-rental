import type { VehicleFormValues } from "@/validations/vehicle/schemas";

export type VehicleStatus = "available" | "rented" | "maintenance" | "unavailable";

export type VehicleRecord = {
  id: string;
  name: string;
  brand: string;
  model?: string | null;
  pricePerDay: number;
  price: number;
  seats: number;
  transmission: string;
  fuelType: string;
  fuel: string;
  color?: string | null;
  status: VehicleStatus | string;
  statusLabel?: string;
  description?: string | null;
  isMostBooked?: boolean;
  images: string[];
  imageRecords?: Array<{
    id: number;
    url: string | null;
    imagePath: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  image?: string | null;
  features: string[];
  createdAt?: string | null;
};

export type CreateVehicleRequestPayload = VehicleFormValues;
