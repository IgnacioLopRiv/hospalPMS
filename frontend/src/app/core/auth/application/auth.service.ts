import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { getApiErrorMessage } from '../../../shared/domain/api-error-message';
import { StorageService } from '../../../shared/infrastructure/storage.service';
import {
  AuthUser,
  Permission,
  ROLE_HOME_ROUTE,
  ROLE_PERMISSIONS,
  StoredUser,
} from '../domain/auth.roles';

export type LoginErrorCode = 'empty' | 'format' | 'email' | 'password';

export interface LoginResult {
  ok: boolean;
  error?: LoginErrorCode;
  message?: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

const LOGIN_MESSAGES: Record<LoginErrorCode, string> = {
  empty: 'Ingresa tu correo y contraseña.',
  format: 'El formato del correo no es válido.',
  email: 'El correo no está registrado.',
  password: 'La contraseña es incorrecta.',
};

const CURRENT_USER_STORAGE_KEY = 'hospal.currentUser';
const ACCESS_TOKEN_STORAGE_KEY = 'hospal.accessToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly apiUrl = `${environment.apiUrl}/funcionarios`;
  private readonly authUrl = `${environment.apiUrl}/auth`;

  /** JWT de la sesión activa (RF-07). Lo adjunta authInterceptor en cada petición. */
  private accessToken: string | null = this.readStorage(ACCESS_TOKEN_STORAGE_KEY);

  // ── Public signals ────────────────────────────────────────────────────────
  /** Usuario con sesión activa. Persistido en localStorage para sobrevivir a recargas de página. */
  readonly currentUser = signal<AuthUser | null>(
    this.accessToken ? this.readSavedCurrentUser() : null,
  );

  /** Lista reactiva de todos los funcionarios cargados desde el backend. */
  readonly users = signal<StoredUser[]>([]);

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly canEditSede = computed(() => this.can('editSede'));
  readonly canViewReports = computed(() => this.can('viewReports'));
  readonly canManageUsers = computed(() => this.can('manageUsers'));
  readonly canUseFrontDesk = computed(() => this.can('frontDesk'));
  readonly canChangeSede = computed(() => this.can('changeSede'));
  readonly canViewRooms = computed(() => this.can('viewRooms'));
  readonly canViewInventory = computed(() => this.can('viewInventory'));

  constructor() {
    void this.ensureUsers();
  }

  /** Token de acceso actual, o null si no hay sesión. */
  token(): string | null {
    return this.accessToken;
  }

  // ── Permissions ───────────────────────────────────────────────────────────
  can(permission: Permission): boolean {
    const user = this.currentUser();
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
  }

  /** Página de inicio del usuario activo según su rol. */
  homeRoute(): string {
    const user = this.currentUser();
    return user ? ROLE_HOME_ROUTE[user.role] ?? '/recepcion' : '/home';
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<LoginResult> {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { ok: false, error: 'empty', message: LOGIN_MESSAGES.empty };
    }

    if (!this.isValidEmail(trimmedEmail)) {
      return { ok: false, error: 'format', message: LOGIN_MESSAGES.format };
    }

    try {
      const { accessToken, user } = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.authUrl}/login`, {
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      );
      const publicUser = this.toPublicUser(user as StoredUser);
      this.accessToken = accessToken;
      this.writeStorage(ACCESS_TOKEN_STORAGE_KEY, accessToken);
      this.currentUser.set(publicUser);
      this.saveCurrentUser(publicUser);
      await this.ensureUsers();
      return { ok: true };
    } catch (error: unknown) {
      const status = error instanceof HttpErrorResponse ? error.status : undefined;
      if (status === 404) {
        return { ok: false, error: 'email', message: LOGIN_MESSAGES.email };
      }
      if (status === 400) {
        return { ok: false, error: 'password', message: LOGIN_MESSAGES.password };
      }
      return {
        ok: false,
        message: getApiErrorMessage(error, 'Error de conexión con el servidor.'),
      };
    }
  }

  logout(): void {
    this.accessToken = null;
    this.writeStorage(ACCESS_TOKEN_STORAGE_KEY, null);
    this.currentUser.set(null);
    this.saveCurrentUser(null);
    this.users.set([]);
  }

  /** Actualiza el usuario activo en la sesión y sincroniza la lista en memoria. */
  updateCurrentUser(updatedUser: AuthUser): void {
    this.currentUser.set(updatedUser);
    this.saveCurrentUser(updatedUser);
    this.users.update((list) =>
      list.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)),
    );
  }

  // ── User CRUD ─────────────────────────────────────────────────────────────

  /** Garantiza que la lista de usuarios está cargada desde el backend. */
  async ensureUsersLoaded(): Promise<void> {
    await this.ensureUsers();
  }

  /**
   * Agrega un nuevo funcionario enviando la petición al backend.
   */
  async addUser(data: Omit<StoredUser, 'id'>): Promise<void> {
    try {
      const created = await firstValueFrom(
        this.http.post<StoredUser>(this.apiUrl, {
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          sedeId: data.sedeId,
        }),
      );
      this.users.update((list) => [...list, created]);
    } catch (error) {
      console.error('Error al crear funcionario en el backend:', error);
      throw error;
    }
  }

  /**
   * Edita los campos del funcionario en el backend. Si es el usuario activo, sincroniza la sesión.
   */
  async updateUser(id: number, patch: Partial<StoredUser>): Promise<void> {
    try {
      const updated = await firstValueFrom(
        this.http.patch<StoredUser>(`${this.apiUrl}/${id}`, patch),
      );
      this.users.update((list) => list.map((u) => (u.id === id ? { ...u, ...updated } : u)));

      const current = this.currentUser();
      if (current && current.id === id) {
        const publicUser = this.toPublicUser(updated);
        this.currentUser.set(publicUser);
        this.saveCurrentUser(publicUser);
      }
    } catch (error) {
      console.error('Error al actualizar funcionario en el backend:', error);
      throw error;
    }
  }

  /**
   * Elimina un funcionario en el backend. Retorna error si se intenta eliminar la sesión activa.
   */
  async deleteUser(id: number): Promise<{ ok: boolean; message?: string }> {
    const current = this.currentUser();
    if (current && current.id === id) {
      return { ok: false, message: 'No puedes eliminar al usuario con sesión activa.' };
    }

    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
      this.users.update((list) => list.filter((u) => u.id !== id));
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, message: getApiErrorMessage(error, 'No se pudo eliminar el usuario.') };
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  /** La lista de funcionarios solo la puede pedir un administrador con sesión. */
  private async ensureUsers(): Promise<void> {
    if (!this.accessToken || this.currentUser()?.role !== 'admin') return;
    try {
      const rows = await firstValueFrom(this.http.get<StoredUser[]>(this.apiUrl));
      this.users.set(rows);
    } catch (err) {
      console.warn('No se pudieron cargar los funcionarios desde el backend:', err);
    }
  }

  private readSavedCurrentUser(): AuthUser | null {
    return this.storage.getJson<AuthUser>(CURRENT_USER_STORAGE_KEY);
  }

  private saveCurrentUser(user: AuthUser | null): void {
    this.storage.setJson(CURRENT_USER_STORAGE_KEY, user);
  }

  private toPublicUser(user: StoredUser): AuthUser {
    const { id, name, email, role, sedeId } = user;
    return { id, name, email, role, sedeId };
  }

  private readStorage(key: string): string | null {
    return this.storage.getString(key);
  }

  private writeStorage(key: string, value: string | null): void {
    this.storage.setString(key, value);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
