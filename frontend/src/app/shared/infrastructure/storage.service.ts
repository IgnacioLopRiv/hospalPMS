import { Injectable } from '@angular/core';

/**
 * Único punto de acceso al almacenamiento del navegador.
 * Si mañana el estado pasa al backend, solo cambia este servicio.
 * Los errores (modo privado, cuota llena, JSON corrupto) se ignoran: se trata como vacío.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  getString(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /** Guarda el valor; con `null` o cadena vacía elimina la clave. */
  setString(key: string, value: string | null): void {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  getJson<T>(key: string): T | null {
    const raw = this.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** Guarda el valor serializado; con `null` elimina la clave. */
  setJson(key: string, value: unknown): void {
    this.setString(key, value === null || value === undefined ? null : JSON.stringify(value));
  }

  remove(key: string): void {
    this.setString(key, null);
  }
}
