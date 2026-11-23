"use client";

import Dashboard from "@/modules/management/dashboard/DashboardModule";
import { TechnicalDashboard } from "@/modules/management/dashboard/TechnicalDashboard";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";

export default function AdminDashboard() {
  const { user } = useManagementSession();
  return user?.permissions?.includes("view research") ? <TechnicalDashboard /> : <Dashboard />;
}
