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

  /**
   * C (Crear): Agrega una nueva sede al listado
   */
  createSede(data: { nombre: string; ciudad: string }): Sede {
    const nextId = this.sedes().length > 0 
      ? Math.max(...this.sedes().map((s) => s.id)) + 1 
      : 1;

    const nuevaSede: Sede = {
      id: nextId,
      nombre: data.nombre.trim(),
      ciudad: data.ciudad.trim(),
      habitaciones: [],
    };

    this.sedes.update((list) => {
      const nextList = [...list, nuevaSede];
      this.saveSedes(nextList);
      return nextList;
    });

    return nuevaSede;
  }

  /**
   * U (Actualizar datos generales): Modifica nombre y ciudad de una sede
   */
  updateSedeInfo(id: number, data: { nombre: string; ciudad: string }): void {
    this.sedes.update((list) => {
      const nextList = list.map((sede) =>
        sede.id === id
          ? { ...sede, nombre: data.nombre.trim(), ciudad: data.ciudad.trim() }
          : sede
      );
      this.saveSedes(nextList);
      return nextList;
    });

    // Si la sede editada es la seleccionada, actualizarla
    const selected = this.selectedSede();
    if (selected && selected.id === id) {
      const updated = { ...selected, nombre: data.nombre.trim(), ciudad: data.ciudad.trim() };
      this.selectedSede.set(updated);
      this.saveSelectedSede(updated);
    }
  }

  /**
   * D (Eliminar): Elimina una sede por su ID
   */
  deleteSede(id: number): void {
    this.sedes.update((list) => {
      const nextList = list.filter((sede) => sede.id !== id);
      this.saveSedes(nextList);
      return nextList;
    });

    // Si se eliminó la sede activa, limpiar o reasignar
    const selected = this.selectedSede();
    if (selected && selected.id === id) {
      const remaining = this.sedes();
      if (remaining.length > 0) {
        this.selectSede(remaining[0]);
      } else {
        this.clearSede();
      }
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
      // Fallback
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