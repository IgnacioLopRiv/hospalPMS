import { Injectable, computed, signal } from '@angular/core';

import { ROOM_TYPES, RoomType, Sede, SedeHabitacion as Habitacion } from '../../../shared/domain/hostal.model';

export { ROOM_TYPES, RoomType } from '../../../shared/domain/hostal.model';
export type { Sede, SedeHabitacion as Habitacion } from '../../../shared/domain/hostal.model';

const INITIAL_SEDES: Sede[] = [
  { id: 1, nombre: 'Hotel Centro', ciudad: 'Santiago', habitaciones: [] },
  { id: 2, nombre: 'Hotel Playa', ciudad: 'Viña del Mar', habitaciones: [] },
  { id: 3, nombre: 'Hotel Montaña', ciudad: 'Pucón', habitaciones: [] },
];

const SEDES_STORAGE_KEY = 'hospal.sedes';
const SELECTED_SEDE_KEY = 'hospal.selectedSede';

@Injectable({ providedIn: 'root' })
export class SedeService {
  private nextHabitacionId = 1;

  readonly sedes = signal<Sede[]>(this.readSavedSedes());
  readonly selectedSede = signal<Sede | null>(this.readInitialSede());
  readonly habitaciones = computed(() => this.selectedSede()?.habitaciones ?? []);

  constructor() {
    this.syncNextHabitacionId();
  }

  selectSede(sede: Sede): void {
    const current = this.sedes().find((item) => item.id === sede.id) ?? sede;
    this.selectedSede.set(current);
    this.saveSelectedSede(current);
  }

  clearSede(): void {
    this.selectedSede.set(null);
    try {
      localStorage.removeItem(SELECTED_SEDE_KEY);
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  updateSelectedSede(patch: Pick<Sede, 'nombre' | 'habitaciones'>): void {
    const current = this.selectedSede();
    if (!current) {
      return;
    }

    const updated: Sede = {
      ...current,
      nombre: patch.nombre.trim(),
      habitaciones: patch.habitaciones.map((habitacion) => ({ ...habitacion })),
    };

    this.selectedSede.set(updated);
    this.sedes.update((list) => {
      const nextList = list.map((sede) => (sede.id === updated.id ? updated : sede));
      this.saveSedes(nextList);
      return nextList;
    });
    this.saveSelectedSede(updated);
    this.syncNextHabitacionId();
  }

  createHabitacionId(): number {
    return this.nextHabitacionId++;
  }

  private readSavedSedes(): Sede[] {
    try {
      const raw = localStorage.getItem(SEDES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Usar sedes iniciales si falla lectura
    }
    return INITIAL_SEDES.map((sede) => ({ ...sede, habitaciones: [] }));
  }

  private readInitialSede(): Sede | null {
    const allSedes = this.readSavedSedes();
    try {
      const raw = localStorage.getItem(SELECTED_SEDE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const match = allSedes.find((s) => s.id === parsed.id);
        if (match) {
          return match;
        }
      }
    } catch {
      // Fallback a primera sede
    }
    return allSedes[0] ?? null;
  }

  private saveSedes(sedes: Sede[]): void {
    try {
      localStorage.setItem(SEDES_STORAGE_KEY, JSON.stringify(sedes));
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  private saveSelectedSede(sede: Sede): void {
    try {
      localStorage.setItem(SELECTED_SEDE_KEY, JSON.stringify(sede));
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  private syncNextHabitacionId(): void {
    const allHabitaciones: Habitacion[] = [];
    for (const sede of this.sedes()) {
      if (sede.habitaciones && Array.isArray(sede.habitaciones)) {
        allHabitaciones.push(...sede.habitaciones);
      }
    }
    if (allHabitaciones.length === 0) {
      this.nextHabitacionId = 1;
      return;
    }
    const ids = allHabitaciones.map((h: Habitacion) => h.id);
    this.nextHabitacionId = Math.max(this.nextHabitacionId, Math.max(...ids) + 1);
  }
}
