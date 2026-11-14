import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarCheck,
  Car,
  ClipboardCheck,
  Fence,
  Gauge,
  LayoutDashboard,
  MapPin,
  PhilippinePeso,
  ShieldCheck,
  History,
  Wrench,
  Activity,
  CircleAlert,
} from "lucide-react";

export type ManagementPortal = "admin" | "staff";

export type ManagementModuleId =
  | "errors"
  | "dashboard"
  | "bookings"
  | "history"
  | "geofences"
  | "verification"
  | "vehicles"
  | "maintenance"
  | "fleetTracker"
  | "reports"
  | "personnel"
  | "deliveryPricing"
  | "research"
  | "modelExplorer"
  | "driveMonitoring"
  | "drivingAnalysis";

type ManagementSection =
  | "Overview"
  | "Rental Operations"
  | "Fleet Operations"
  | "Insights"
  | "Model Development"
  | "Administration";

export type ManagementModule = {
  id: ManagementModuleId;
  label: string;
  section: ManagementSection;
  icon: LucideIcon;
  permission?: string;
  adminOnly?: boolean;
  path: string;
};

export const managementModules: readonly ManagementModule[] = [
  { id: "errors", label: "Activity Log", section: "Administration", icon: CircleAlert, adminOnly: true, path: "errors" },
  {
    id: "dashboard",
    label: "Dashboard",
    section: "Overview",
    icon: LayoutDashboard,
    permission: "view dashboard",
    path: "",
  },
  {
    id: "bookings",
    label: "Booking",
    section: "Rental Operations",
    icon: CalendarCheck,
    permission: "manage bookings",
    path: "booking",
  },
  {
    id: "history",
    label: "History",
    section: "Rental Operations",
    icon: History,
    permission: "manage bookings",
    path: "history",
  },
  {
    id: "geofences",
    label: "Geofence Library",
    section: "Rental Operations",
    icon: Fence,
    permission: "manage geofences",
    path: "geofences",
  },
  {
    id: "verification",
    label: "Self-Drive Verification",
    section: "Rental Operations",
    icon: ClipboardCheck,
    permission: "review documents",
    path: "verification-queue",
  },
  {
    id: "vehicles",
    label: "Vehicle",
    section: "Fleet Operations",
    icon: Car,
    permission: "manage vehicles",
    path: "vehicle",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    section: "Fleet Operations",
    icon: Wrench,
    permission: "manage maintenance",
    path: "maintenance",
  },
  {
    id: "fleetTracker",
    label: "Fleet Monitoring",
    section: "Fleet Operations",
    icon: MapPin,
    permission: "view fleet tracker",
    path: "fleet",
  },
  { id: "drivingAnalysis", label: "Driving Analysis", section: "Insights", icon: Gauge, permission: "view fleet tracker", path: "driving-analysis" },
  {
    id: "reports",
    label: "Reports and Analytics",
    section: "Insights",
    icon: BarChart3,
    permission: "view reports",
    path: "report",
  },
  {
    id: "personnel",
    label: "Personnel",
    section: "Administration",
    icon: ShieldCheck,
    path: "personnel",
  },
  { id: "research", label: "Data Collection", section: "Model Development", icon: Activity, adminOnly: true, path: "research" },
  { id: "modelExplorer", label: "Model Explorer", section: "Model Development", icon: Activity, adminOnly: true, path: "model-explorer" },
  { id: "driveMonitoring", label: "Drive Monitoring", section: "Model Development", icon: Activity, adminOnly: true, path: "drive-monitoring" },
  { id: "deliveryPricing", label: "Fee Pricing", section: "Administration", icon: PhilippinePeso, adminOnly: true, path: "delivery-pricing" },
] as const;

export const managementSections: readonly ManagementSection[] = [
  "Overview",
  "Rental Operations",
  "Fleet Operations",
  "Insights",
  "Model Development",
  "Administration",
];

export function managementPath(portal: ManagementPortal, moduleId: ManagementModuleId) {
  const managementItem = managementModules.find((item) => item.id === moduleId);

  if (!managementItem || (portal === "staff" && managementItem.adminOnly)) return null;

  return managementItem.path ? `/${portal}/${managementItem.path}` : `/${portal}`;
}

export function managementModuleForPath(pathname: string, portal: ManagementPortal) {
  return managementModules.find((module) => {
    const path = managementPath(portal, module.id);

    if (!path) return false;

    return module.id === "dashboard" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function managementModulesForPortal(portal: ManagementPortal, permissions: ReadonlySet<string> | null) {
  return managementModules.filter((module) => {
    if (portal === "admin") return true;
    if (module.id === "personnel") return true;
    if (module.adminOnly || !module.permission) return false;

    return permissions?.has(module.permission) ?? false;
  });
}
