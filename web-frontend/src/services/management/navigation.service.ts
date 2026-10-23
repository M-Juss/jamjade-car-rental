import { apiGet } from "@/services/http";

export type ManagementNavigationCounts = {
  bookings: number | null;
  verification: number | null;
};

export const MANAGEMENT_COUNTS_CHANGED = "management-counts-changed";

export function refreshManagementCounts() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MANAGEMENT_COUNTS_CHANGED));
}

export async function getManagementNavigationCounts() {
  return (await apiGet<ManagementNavigationCounts>("/admin/navigation-counts")).data;
}
