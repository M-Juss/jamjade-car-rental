import { ApiError, GENERIC_ERROR_MESSAGE, apiGet, buildApiUrl } from "@/services/http";
import type { DashboardResponse, ReportRange, ReportsResponse } from "./types";

export async function getDashboard() {
  const response = await apiGet<DashboardResponse>("/admin/dashboard");

  return response.data;
}

export async function getReports(range: ReportRange) {
  const response = await apiGet<ReportsResponse>(`/admin/reports?range=${range}`);

  return response.data;
}

function responseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);

  return match?.[1] ?? fallback;
}

export async function downloadReport(format: "pdf" | "excel", range: ReportRange) {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(`/admin/reports/${format}?range=${range}`), {
      credentials: "include",
      headers: {
        Accept: format === "pdf" ? "application/pdf" : "text/csv",
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
  const fallback = format === "pdf" ? "jamjade-report.pdf" : "jamjade-report.csv";

  link.href = url;
  link.download = responseFilename(response, fallback);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
