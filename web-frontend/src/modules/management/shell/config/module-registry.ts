import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarCheck,
  Car,
  ClipboardCheck,
  Fence,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  History,
  Wrench,
} from "lucide-react";

export type ManagementPortal = "admin" | "staff";

export type ManagementModuleId =
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
  | "deliveryPricing";

type ManagementSection =
  | "Overview"
  | "Rental Operations"
  | "Fleet Operations"
  | "Insights"
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
  { id: "deliveryPricing", label: "Delivery Pricing", section: "Administration", icon: Settings, adminOnly: true, path: "delivery-pricing" },
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
    icon: Settings,
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
    label: "Fleet Tracker",
    section: "Fleet Operations",
    icon: Car,
    permission: "view fleet tracker",
    path: "fleet",
  },
  {
    id: "reports",
    label: "Reports & Analytics",
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
    adminOnly: true,
    path: "personnel",
  },
] as const;

export const managementSections: readonly ManagementSection[] = [
  "Overview",
  "Rental Operations",
  "Fleet Operations",
  "Insights",
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
    if (module.adminOnly || !module.permission) return false;

    return permissions?.has(module.permission) ?? false;
  });
}
