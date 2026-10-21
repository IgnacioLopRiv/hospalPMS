import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AuthUser,
  Permission,
  ROLE_PERMISSIONS,
  StoredUser,
} from '../domain/auth.roles';

export type LoginErrorCode = 'empty' | 'format' | 'email' | 'password';

export interface LoginResult {
  ok: boolean;
  error?: LoginErrorCode;
  message?: string;
}

interface RecoveryEntry {
  token: string;
  expiresAt: number;
}

const LOGIN_MESSAGES: Record<LoginErrorCode, string> = {
  empty: 'Ingresa tu correo y contraseña.',
  format: 'El formato del correo no es válido.',
  email: 'El correo no está registrado.',
  password: 'La contraseña es incorrecta.',
};

const CURRENT_USER_STORAGE_KEY = 'hospal.currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/funcionarios`;
  private loaded = false;

  // Recovery tokens stored in memory only (Map: email → entry)
  private readonly recoveryTokens = new Map<string, RecoveryEntry>();

  // ── Public signals ────────────────────────────────────────────────────────
  /** Usuario con sesión activa. Persistido en localStorage para sobrevivir a recargas de página. */
  readonly currentUser = signal<AuthUser | null>(this.readSavedCurrentUser());

  /** Lista reactiva de todos los funcionarios cargados desde el backend. */
  readonly users = signal<StoredUser[]>([]);

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly canEditSede = computed(() => this.can('editSede'));
  readonly canViewReports = computed(() => this.can('viewReports'));
  readonly canManageUsers = computed(() => this.can('manageUsers'));

  constructor() {
    this.ensureUsers();
  }

  // ── Permissions ───────────────────────────────────────────────────────────
  can(permission: Permission): boolean {
    const user = this.currentUser();
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
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
      const publicUser = await firstValueFrom(
        this.http.post<AuthUser>(`${this.apiUrl}/login`, {
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      );
      this.currentUser.set(publicUser);
      this.saveCurrentUser(publicUser);
      await this.ensureUsers();
      return { ok: true };
    } catch (error: any) {
      const status = error?.status;
      if (status === 404) {
        return { ok: false, error: 'email', message: LOGIN_MESSAGES.email };
      }
      if (status === 400) {
        return { ok: false, error: 'password', message: LOGIN_MESSAGES.password };
      }
      return {
        ok: false,
        message: error?.error?.message || 'Error de conexión con el servidor.',
      };
    }
  }

  logout(): void {
    this.currentUser.set(null);
    this.saveCurrentUser(null);
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
  deleteUser(id: number): { ok: boolean; message?: string } {
    const current = this.currentUser();
    if (current && current.id === id) {
      return { ok: false, message: 'No puedes eliminar al usuario con sesión activa.' };
    }

    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== id));
      },
      error: (err) => {
        console.error('Error al eliminar funcionario en el backend:', err);
      },
    });

    this.users.update((list) => list.filter((u) => u.id !== id));
    return { ok: true };
  }

  // ── Password recovery (in-memory tokens) ─────────────────────────────────
  async requestPasswordRecovery(email: string): Promise<{ ok: boolean; message: string }> {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return { ok: false, message: 'Ingresa el correo electrónico.' };
    }

    if (!this.isValidEmail(trimmedEmail)) {
      return { ok: false, message: 'El formato del correo no es válido.' };
    }

    await this.ensureUsers();
    const user = this.findUser(trimmedEmail);

    if (!user) {
      return { ok: false, message: 'El correo no está registrado.' };
    }

    const token = crypto.randomUUID();
    this.recoveryTokens.set(trimmedEmail, {
      token,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    this.openRecoveryEmail(user.email, token);

    return {
      ok: true,
      message: `Se envió un correo de recuperación a ${user.email}. Revisa tu bandeja o el cliente de correo que se acaba de abrir.`,
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ ok: boolean; message: string }> {
    if (!token) {
      return { ok: false, message: 'El enlace de recuperación no es válido.' };
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      return { ok: false, message: 'Ingresa y confirma la nueva contraseña.' };
    }

    if (newPassword !== confirmPassword) {
      return { ok: false, message: 'Las contraseñas no coinciden.' };
    }

    if (newPassword.trim().length < 8) {
      return { ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
    }

    // Find the token in memory
    let foundEmail: string | null = null;
    let foundEntry: RecoveryEntry | null = null;

    for (const [email, entry] of this.recoveryTokens.entries()) {
      if (entry.token === token) {
        foundEmail = email;
        foundEntry = entry;
        break;
      }
    }

    if (!foundEmail || !foundEntry) {
      return { ok: false, message: 'El enlace de recuperación no es válido.' };
    }

    if (foundEntry.expiresAt < Date.now()) {
      this.recoveryTokens.delete(foundEmail);
      return {
        ok: false,
        message: 'El enlace de recuperación expiró. Solicita uno nuevo.',
      };
    }

    await this.ensureUsers();
    const user = this.findUser(foundEmail);
    if (!user) {
      return { ok: false, message: 'No se encontró la cuenta asociada al enlace.' };
    }

    this.updateUser(user.id, { password: newPassword.trim() });
    this.recoveryTokens.delete(foundEmail);

    return { ok: true, message: 'La contraseña se actualizó. Ya puedes ingresar.' };
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private async ensureUsers(): Promise<void> {
    try {
      const rows = await firstValueFrom(this.http.get<StoredUser[]>(this.apiUrl));
      this.users.set(rows);
      this.loaded = true;
    } catch (err) {
      console.warn('No se pudieron cargar los funcionarios desde el backend:', err);
    }
  }

  private readSavedCurrentUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as AuthUser;
      }
    } catch {
      // Ignorar error de almacenamiento
    }
    return null;
  }

  private saveCurrentUser(user: AuthUser | null): void {
    try {
      if (user) {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      }
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  private findUser(email: string): StoredUser | undefined {
    return this.users().find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  private toPublicUser(user: StoredUser): AuthUser {
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }

  private openRecoveryEmail(email: string, token: string): void {
    const resetUrl = `${window.location.origin}/restablecer?token=${encodeURIComponent(token)}`;
    const subject = encodeURIComponent('Recuperación de contraseña - Hospal PMS');
    const body = encodeURIComponent(
      `Hola,\n\nRecibimos una solicitud para restablecer tu contraseña de Hospal PMS.\n\nAbre este enlace para crear una nueva (válido 15 minutos):\n${resetUrl}\n\nSi no fuiste tú, ignora este mensaje.`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
