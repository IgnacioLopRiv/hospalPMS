import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AuthUser,
  Permission,
  ROLE_PERMISSIONS,
  StoredUser,
  UsersFile,
} from '../domain/auth.roles';

export type LoginErrorCode = 'empty' | 'format' | 'email' | 'password';

export interface LoginResult {
  ok: boolean;
  error?: LoginErrorCode;
  message?: string;
}

interface RecoveryToken {
  email: string;
  token: string;
  expiresAt: number;
}

const SESSION_KEY = 'hospal.session';
const PASSWORD_OVERRIDES_KEY = 'hospal.passwordOverrides';
const RECOVERY_TOKENS_KEY = 'hospal.recoveryTokens';

const LOGIN_MESSAGES: Record<LoginErrorCode, string> = {
  empty: 'Ingresa tu correo y contraseña.',
  format: 'El formato del correo no es válido.',
  email: 'El correo no está registrado.',
  password: 'La contraseña es incorrecta.',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private users: StoredUser[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  readonly currentUser = signal<AuthUser | null>(this.readSession());
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly canEditSede = computed(() => this.can('editSede'));
  readonly canViewReports = computed(() => this.can('viewReports'));

  can(permission: Permission): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }

    return ROLE_PERMISSIONS[user.role].includes(permission);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { ok: false, error: 'empty', message: LOGIN_MESSAGES.empty };
    }

    if (!this.isValidEmail(trimmedEmail)) {
      return { ok: false, error: 'format', message: LOGIN_MESSAGES.format };
    }

    await this.ensureUsers();
    const user = this.findUser(trimmedEmail);

    if (!user) {
      return { ok: false, error: 'email', message: LOGIN_MESSAGES.email };
    }

    if (user.password !== trimmedPassword) {
      return { ok: false, error: 'password', message: LOGIN_MESSAGES.password };
    }

    this.setSession(this.toPublicUser(user));
    return { ok: true };
  }

  logout(): void {
    this.currentUser.set(null);
    localStorage.removeItem(SESSION_KEY);
  }

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
    const recovery: RecoveryToken = {
      email: user.email.toLowerCase(),
      token,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    this.saveRecoveryToken(recovery);
    this.openRecoveryEmail(user.email, token);

    return {
      ok: true,
      message: `Se envió un correo de recuperación a ${user.email}. Revisa tu bandeja o el cliente de correo que se acaba de abrir.`,
    };
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ ok: boolean; message: string }> {
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

    const recovery = this.readRecoveryTokens().find((item) => item.token === token);
    if (!recovery) {
      return { ok: false, message: 'El enlace de recuperación no es válido.' };
    }

    if (recovery.expiresAt < Date.now()) {
      this.removeRecoveryToken(token);
      return { ok: false, message: 'El enlace de recuperación expiró. Solicita uno nuevo.' };
    }

    await this.ensureUsers();
    const user = this.findUser(recovery.email);
    if (!user) {
      return { ok: false, message: 'No se encontró la cuenta asociada al enlace.' };
    }

    user.password = newPassword.trim();
    this.savePasswordOverride(user.email, user.password);
    this.removeRecoveryToken(token);

    return { ok: true, message: 'La contraseña se actualizó. Ya puedes ingresar.' };
  }

  private async ensureUsers(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (!this.loadPromise) {
      this.loadPromise = firstValueFrom(this.http.get<UsersFile>('assets/data/users.json')).then((file) => {
        const overrides = this.readPasswordOverrides();
        this.users = file.users.map((user) => ({
          ...user,
          password: overrides[user.email.toLowerCase()] ?? user.password,
        }));
        this.loaded = true;
      });
    }

    await this.loadPromise;
  }

  private findUser(email: string): StoredUser | undefined {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  private toPublicUser(user: StoredUser): AuthUser {
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }

  private setSession(user: AuthUser): void {
    this.currentUser.set(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  private readSession(): AuthUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private readPasswordOverrides(): Record<string, string> {
    try {
      const raw = localStorage.getItem(PASSWORD_OVERRIDES_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  private savePasswordOverride(email: string, password: string): void {
    const overrides = this.readPasswordOverrides();
    overrides[email.toLowerCase()] = password;
    localStorage.setItem(PASSWORD_OVERRIDES_KEY, JSON.stringify(overrides));
  }

  private readRecoveryTokens(): RecoveryToken[] {
    try {
      const raw = localStorage.getItem(RECOVERY_TOKENS_KEY);
      return raw ? (JSON.parse(raw) as RecoveryToken[]) : [];
    } catch {
      return [];
    }
  }

  private saveRecoveryToken(token: RecoveryToken): void {
    const tokens = this.readRecoveryTokens().filter((item) => item.email !== token.email);
    tokens.push(token);
    localStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify(tokens));
  }

  private removeRecoveryToken(token: string): void {
    const tokens = this.readRecoveryTokens().filter((item) => item.token !== token);
    localStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify(tokens));
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
