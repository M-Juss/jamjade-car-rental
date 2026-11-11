import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import type { PersonnelAccountFormValues } from "@/validations/personnel/schemas";
import type { PersonnelFilter, PersonnelResponse, PersonnelUser } from "./types";

export async function getPersonnel(params: {
  role: PersonnelFilter;
  search: string;
  status: string;
  page: number;
}) {
  const query = new URLSearchParams({
    role: params.role,
    status: params.status,
    page: String(params.page),
    per_page: String(TABLE_PAGE_SIZE),
  });
  if (params.search) query.set("search", params.search);
  const response = await apiGet<PersonnelResponse>(`/admin/personnel?${query}`);
  return response.data;
}

function accountPayload(values: PersonnelAccountFormValues) {
  return {
    first_name: values.firstName.trim().replace(/\s+/gu, " "),
    last_name: values.lastName.trim().replace(/\s+/gu, " "),
    email: values.email.trim().toLowerCase(),
    phone_number: values.phoneNumber.trim() || null,
    role: values.role,
    is_active: values.status === "active",
    ...(values.password ? {
      password: values.password,
      password_confirmation: values.passwordConfirmation,
    } : {}),
  };
}

export async function createPersonnel(values: PersonnelAccountFormValues) {
  const response = await apiPost<{ user: PersonnelUser }>("/admin/personnel/users", accountPayload(values));
  return response.data.user;
}

export async function updatePersonnel(id: number, values: PersonnelAccountFormValues) {
  const response = await apiPut<{ user: PersonnelUser }>(`/admin/personnel/users/${id}`, accountPayload(values));
  return response.data.user;
}

export async function deletePersonnel(id: number) {
  await apiDelete<null>(`/admin/personnel/users/${id}`);
}

export async function getAdmins() {
  return (await apiGet<{ accounts: PersonnelUser[] }>("/admin/admins")).data.accounts;
}

export async function createAdmin(values: PersonnelAccountFormValues) {
  return (await apiPost<{ user: PersonnelUser }>("/admin/admins/users", accountPayload(values))).data.user;
}

export async function revokeAdmin(id: number) {
  await apiPost(`/admin/admins/${id}/revoke`, {});
}
