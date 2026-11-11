import { ApiError, GENERIC_ERROR_MESSAGE, apiGet, buildApiUrl } from "@/services/http";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import type { DashboardResponse, ReportData, ReportSelection } from "./types";

export async function getDashboard(start: string, end: string) {
  const query = new URLSearchParams({ start, end });
  const response = await apiGet<DashboardResponse>(`/admin/dashboard?${query.toString()}`);

  return response.data;
}

function reportQuery(selection: ReportSelection, includePage = true) {
  const query = new URLSearchParams({ period: selection.period, date: selection.date, section: selection.section });
  if (selection.search) query.set("search", selection.search);
  if (selection.vehicleId) query.set("vehicle_id", String(selection.vehicleId));
  if (selection.rentalType) query.set("rental_type", selection.rentalType);
  if (includePage) {
    query.set("page", String(selection.page ?? 1));
    query.set("per_page", String(TABLE_PAGE_SIZE));
  }
  return query.toString();
}

export async function getReports(selection: ReportSelection) {
  const response = await apiGet<ReportData>(`/admin/reports?${reportQuery(selection)}`);
  return response.data;
}

function responseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);

  return match?.[1] ?? fallback;
}

export async function downloadReport(selection: ReportSelection) {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(`/admin/reports/csv?${reportQuery(selection, false)}`), {
      credentials: "include",
      headers: {
        Accept: "text/csv",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
  } catch {
    throw new ApiError(GENERIC_ERROR_MESSAGE, 0);
  }

  if (!response.ok) {
    throw new ApiError(GENERIC_ERROR_MESSAGE, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fallback = "jamjade-report.csv";

  link.href = url;
  link.download = responseFilename(response, fallback);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
