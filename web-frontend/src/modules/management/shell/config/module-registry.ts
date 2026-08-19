import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarCheck,
  Car,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Video,
  Wrench,
} from "lucide-react";

export type ManagementPortal = "owner" | "admin";

export type ManagementModuleId =
  | "dashboard"
  | "bookings"
  | "verification"
  | "vehicles"
  | "maintenance"
  | "fleetTracker"
  | "videoAuditing"
  | "reports"
  | "staff";

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
  ownerOnly?: boolean;
  path: string;
};

export const managementModules: readonly ManagementModule[] = [
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
    id: "verification",
    label: "ID Verification",
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
    id: "videoAuditing",
    label: "Video Auditing",
    section: "Fleet Operations",
    icon: Video,
    permission: "view video auditing",
    path: "video-auditing",
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
    id: "staff",
    label: "Staff",
    section: "Administration",
    icon: ShieldCheck,
    ownerOnly: true,
    path: "staff",
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

  if (!managementItem || (portal === "admin" && managementItem.ownerOnly)) return null;

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
    if (portal === "owner") return true;
    if (module.ownerOnly || !module.permission) return false;

    return permissions?.has(module.permission) ?? false;
  });
}
