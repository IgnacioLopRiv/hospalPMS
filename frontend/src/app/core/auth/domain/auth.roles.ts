/** admin = administración; staff = recepción; aseo = personal de limpieza (PERSONAL_LIMPIEZA en BD). */
export type UserRole = 'admin' | 'staff' | 'aseo';

export type Permission =
  | 'editSede'
  | 'viewReports'
  | 'manageUsers'
  /** Recepción, huéspedes y reservas. */
  | 'frontDesk'
  /** Elegir o cambiar la sede de trabajo. */
  | 'changeSede'
  | 'viewRooms'
  | 'viewInventory';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  sedeId?: number;
}

export interface StoredUser extends AuthUser {
  password: string;
}

export interface UsersFile {
  users: StoredUser[];
}

const STAFF_PERMISSIONS: Permission[] = ['frontDesk', 'changeSede', 'viewRooms', 'viewInventory'];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['editSede', 'viewReports', 'manageUsers', ...STAFF_PERMISSIONS],
  staff: STAFF_PERMISSIONS,
  /** Mismos atributos que staff dentro de sus páginas, pero solo ve habitaciones e inventario. */
  aseo: ['viewRooms', 'viewInventory'],
};

/** Página de inicio de cada rol (tras el login o al intentar entrar a una página sin permiso). */
export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  admin: '/sedes',
  staff: '/recepcion',
  aseo: '/habitaciones',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  staff: 'Personal',
  aseo: 'Personal de aseo',
};

/** Roles que trabajan en una sede asignada (se les pide sede al crearlos). */
export const ROLES_WITH_SEDE: UserRole[] = ['staff', 'aseo'];
