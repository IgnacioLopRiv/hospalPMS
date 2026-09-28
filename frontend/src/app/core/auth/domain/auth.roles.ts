export type UserRole = 'admin' | 'staff';

export type Permission = 'editSede' | 'viewReports' | 'manageUsers';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** ID de la sede asignada. Solo relevante para usuarios con rol 'staff'. */
  sedeId?: number;
}

export interface StoredUser extends AuthUser {
  password: string;
}

export interface UsersFile {
  users: StoredUser[];
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['editSede', 'viewReports', 'manageUsers'],
  staff: [],
};
