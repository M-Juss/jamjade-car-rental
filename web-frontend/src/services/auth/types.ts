export type UserRole = "admin" | "staff" | "customer";

export type BackendRole = UserRole | { name?: UserRole | string };

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  roles?: BackendRole[];
  permissions?: string[];
};

export type LoginPayload = {
  email: string;
  password: string;
  remember?: boolean;
};

export type AuthResponse = {
  user: AuthenticatedUser;
};
