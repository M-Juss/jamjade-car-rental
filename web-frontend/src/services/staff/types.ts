export type StaffModule = {
  key: string;
  label: string;
  description: string;
  permission: string;
  adminPath: string | null;
  ownerPath: string | null;
  assignable: boolean;
  ownerOnly: boolean;
};

export type StaffRole = {
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

export type StaffUser = {
  id: number;
  staffId: string;
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

export type StaffManagementSummary = {
  total: number;
  active: number;
  inactive: number;
  roles: number;
};

export type StaffManagementResponse = {
  summary: StaffManagementSummary;
  users: StaffUser[];
  roles: StaffRole[];
  modules: StaffModule[];
};

export type StaffRolePayload = {
  name: string;
  modules: string[];
};

export type StaffUserPayload = {
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
