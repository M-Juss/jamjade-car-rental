import { apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import type {
  StaffManagementResponse,
  StaffRole,
  StaffRolePayload,
  StaffUser,
  StaffUserPayload,
} from "./types";

export async function getStaffManagement() {
  const response = await apiGet<StaffManagementResponse>("/staff/management");

  return response.data;
}

export async function createStaffRole(payload: StaffRolePayload) {
  const response = await apiPost<{ role: StaffRole }>("/staff/management/roles", payload);

  return response.data.role;
}

export async function updateStaffRole(roleId: number, payload: StaffRolePayload) {
  const response = await apiPut<{ role: StaffRole }>(`/staff/management/roles/${roleId}`, payload);

  return response.data.role;
}

export async function deleteStaffRole(roleId: number) {
  await apiDelete<null>(`/staff/management/roles/${roleId}`);
}

export async function createStaffUser(payload: StaffUserPayload) {
  const response = await apiPost<{ user: StaffUser }>("/staff/management/users", payload);

  return response.data.user;
}

export async function updateStaffUser(userId: number, payload: StaffUserPayload) {
  const response = await apiPut<{ user: StaffUser }>(`/staff/management/users/${userId}`, payload);

  return response.data.user;
}

export async function deleteStaffUser(userId: number) {
  await apiDelete<null>(`/staff/management/users/${userId}`);
}