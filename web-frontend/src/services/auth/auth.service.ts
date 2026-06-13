import { apiGet, apiPost } from "@/services/http";
import type { AuthenticatedUser, AuthResponse, BackendRole, LoginPayload, UserRole } from "./types";

const ADMIN_PERMISSION_ROUTES = [
  { permission: "view dashboard", path: "/admin" },
  { permission: "view fleet tracker", path: "/admin/fleet" },
  { permission: "manage vehicles", path: "/admin/vehicle" },
  { permission: "manage bookings", path: "/admin/booking" },
  { permission: "review documents", path: "/admin/verification-queue" },
  { permission: "view reports", path: "/admin/report" },
];

function normalizeRole(role: BackendRole): string | null {
  if (typeof role === "string") return role;
  return role.name ?? null;
}

export function getUserRoleNames(user: AuthenticatedUser): UserRole[] {
  return (user.roles ?? [])
    .map(normalizeRole)
    .filter((role): role is UserRole => role === "owner" || role === "admin" || role === "staff" || role === "customer");
}

export function getDashboardPathForUser(user: AuthenticatedUser) {
  const roles = getUserRoleNames(user);

  if (roles.includes("owner")) return "/owner";

  const permissions = new Set(user.permissions ?? []);
  const firstAllowedRoute = ADMIN_PERMISSION_ROUTES.find((route) => permissions.has(route.permission));

  if (firstAllowedRoute) return firstAllowedRoute.path;
  if (roles.includes("admin") || roles.includes("staff")) return "/admin";

  return "/login";
}

export async function login(payload: LoginPayload) {
  const response = await apiPost<AuthResponse>("/admin/login", payload);

  return response.data;
}

export async function getAuthenticatedUser() {
  const response = await apiGet<AuthResponse>("/admin/me");

  return response.data;
}

export async function logout() {
  await apiPost<null>("/admin/logout");
}
