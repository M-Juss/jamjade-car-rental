import { apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import type {
  AdminManagementResponse,
  AdminRole,
  AdminRolePayload,
  AdminUser,
  AdminUserPayload,
} from "./types";

export async function getAdminManagement() {
  const response = await apiGet<AdminManagementResponse>("/admin/management");

  return response.data;
}

export async function createAdminRole(payload: AdminRolePayload) {
  const response = await apiPost<{ role: AdminRole }>("/admin/management/roles", payload);

  return response.data.role;
}

export async function updateAdminRole(roleId: number, payload: AdminRolePayload) {
  const response = await apiPut<{ role: AdminRole }>(`/admin/management/roles/${roleId}`, payload);

  return response.data.role;
}

export async function deleteAdminRole(roleId: number) {
  await apiDelete<null>(`/admin/management/roles/${roleId}`);
}

export async function createAdminUser(payload: AdminUserPayload) {
  const response = await apiPost<{ user: AdminUser }>("/admin/management/users", payload);

  return response.data.user;
}

export async function updateAdminUser(userId: number, payload: AdminUserPayload) {
  const response = await apiPut<{ user: AdminUser }>(`/admin/management/users/${userId}`, payload);

  return response.data.user;
}

export async function deleteAdminUser(userId: number) {
  await apiDelete<null>(`/admin/management/users/${userId}`);
}
