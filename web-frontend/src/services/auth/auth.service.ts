import { apiGet, apiPost } from "@/services/http";
import { managementModules, managementPath } from "@/modules/management/shell/config/module-registry";
import type { AuthenticatedUser, AuthResponse, BackendRole, LoginPayload, UserRole } from "./types";

function normalizeRole(role: BackendRole): string | null {
  if (typeof role === "string") return role;
  return role.name ?? null;
}

export function getUserRoleNames(user: AuthenticatedUser): UserRole[] {
  return (user.roles ?? [])
    .map(normalizeRole)
    .filter((role): role is UserRole => role === "admin" || role === "staff" || role === "customer");
}

export function getDashboardPathForUser(user: AuthenticatedUser) {
  const roles = getUserRoleNames(user);

  if (roles.includes("admin")) return "/admin";

  const permissions = new Set(user.permissions ?? []);
  const firstAllowedModule = managementModules.find(
    (module) => !module.adminOnly && module.permission && permissions.has(module.permission),
  );

  if (firstAllowedModule) return managementPath("staff", firstAllowedModule.id) ?? "/staff";
  if (roles.includes("staff")) return "/staff";

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
