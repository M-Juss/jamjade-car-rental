import { apiGet } from "@/services/http";

export type TechnicalDashboardData = {
  asOf: string;
  recordings: number;
  verifiedRecordings: number;
  pendingRecordings: number;
  activeMonitoringTrips: number;
};

export async function getTechnicalDashboard() {
  return (await apiGet<TechnicalDashboardData>("/admin/technical-dashboard")).data;
}
