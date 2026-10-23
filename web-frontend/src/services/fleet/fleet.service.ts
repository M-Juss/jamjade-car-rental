import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { apiGet } from "@/services/http";
import { fleetQuerySchema, type FleetQuery } from "@/validations/fleet/schemas";

import type { FleetRental, FleetRentalsPage } from "./types";

export async function getFleetRentals(filters: FleetQuery, signal?: AbortSignal): Promise<FleetRentalsPage> {
  const values = fleetQuerySchema.parse({ ...filters, per_page: TABLE_PAGE_SIZE });
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const response = await apiGet<FleetRental[]>(`/admin/fleet-tracker?${query}`, { signal });
  return {
    rentals: response.data,
    page: Number(response.meta?.current_page ?? 1),
    lastPage: Number(response.meta?.last_page ?? 1),
    total: Number(response.meta?.total ?? 0),
    totalOngoing: Number(response.meta?.total_ongoing ?? 0),
  };
}
