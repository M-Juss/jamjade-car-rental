export type AdminModule = {
  key: string;
  label: string;
  description: string;
  permission: string;
  adminPath: string | null;
  ownerPath: string | null;
  assignable: boolean;
  ownerOnly: boolean;
};

export type AdminRole = {
  id: number;
  name: string;
  label: string;
  guardName: string;
  modules: string[];
  permissions: string[];
  usersCount: number;
  isProtected: boolean;
  canAssign: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUser = {
  id: number;
  adminId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  isActive: boolean;
  status: "active" | "inactive";
  role: {
    id: number;
    name: string;
    label: string;
    modules: string[];
  } | null;
  roles: Array<{
    id: number;
    name: string;
    label: string;
  }>;
  permissions: string[];
  isProtected: boolean;
  canEdit: boolean;
  canDelete: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminManagementSummary = {
  total: number;
  active: number;
  inactive: number;
  roles: number;
};

export type AdminManagementResponse = {
  summary: AdminManagementSummary;
  users: AdminUser[];
  roles: AdminRole[];
  modules: AdminModule[];
};

export type AdminRolePayload = {
  name: string;
  modules: string[];
};

export type AdminUserPayload = {
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  phone_number?: string | null;
  role: string;
  is_active: boolean;
  password?: string;
  password_confirmation?: string;
};
