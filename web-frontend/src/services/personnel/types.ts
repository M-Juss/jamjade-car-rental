export type PersonnelCategory = "staff" | "driver";
export type PersonnelFilter = "all" | PersonnelCategory;

export type PersonnelRole = {
  name: PersonnelCategory;
  label: string;
};

export type PersonnelUser = {
  id: number;
  personnelId: string;
  category: PersonnelCategory;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  isActive: boolean;
  status: "active" | "inactive";
  role: PersonnelRole;
  lastLoginAt?: string | null;
};

export type PersonnelResponse = {
  summary: { total: number; active: number; staff: number; drivers: number };
  users: PersonnelUser[];
  roles: PersonnelRole[];
  pagination: { currentPage: number; lastPage: number; total: number };
};
