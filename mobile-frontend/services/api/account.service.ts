import { apiPut } from '@/services/http';
import type { ChangeAccountPasswordInput, UpdateAccountEmailInput } from '@/validation/account/schemas';

import type { MobileUser } from './types';

export async function updateAccountEmail(values: UpdateAccountEmailInput) {
  const response = await apiPut<MobileUser>('/mobile/account/email', {
    email: values.email,
    current_password: values.currentPassword,
  });
  return response.data;
}

export async function changeAccountPassword(values: ChangeAccountPasswordInput) {
  await apiPut<null>('/mobile/account/password', {
    current_password: values.currentPassword,
    password: values.password,
    password_confirmation: values.confirmPassword,
  });
}
