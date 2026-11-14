import { apiPost } from "@/services/http";

export async function requestEmail(email: string, currentPassword: string) { await apiPost("/admin/owner-profile/email", { email, current_password: currentPassword }); }
export async function confirmEmail(code: string) { await apiPost("/admin/owner-profile/email/confirm", { code }); }
export async function changePassword(currentPassword: string, password: string, confirmation: string) { await apiPost("/admin/owner-profile/password", { current_password: currentPassword, password, password_confirmation: confirmation }); }
