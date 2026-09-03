import { Injectable, computed, signal } from '@angular/core';

import { ROOM_TYPES, RoomType, Sede, SedeHabitacion as Habitacion } from '../../../shared/domain/hostal.model';

export { ROOM_TYPES, RoomType } from '../../../shared/domain/hostal.model';
export type { Sede, SedeHabitacion as Habitacion } from '../../../shared/domain/hostal.model';

const INITIAL_SEDES: Sede[] = [
  { id: 1, nombre: 'Hotel Centro', ciudad: 'Santiago', habitaciones: [] },
  { id: 2, nombre: 'Hotel Playa', ciudad: 'Viña del Mar', habitaciones: [] },
  { id: 3, nombre: 'Hotel Montaña', ciudad: 'Pucón', habitaciones: [] },
];

@Injectable({ providedIn: 'root' })
export class SedeService {
  private nextHabitacionId = 1;

  readonly sedes = signal<Sede[]>(INITIAL_SEDES.map((sede) => ({ ...sede, habitaciones: [] })));
  readonly selectedSede = signal<Sede | null>(null);
  readonly habitaciones = computed(() => this.selectedSede()?.habitaciones ?? []);

  selectSede(sede: Sede): void {
    const current = this.sedes().find((item) => item.id === sede.id) ?? sede;
    this.selectedSede.set(current);
  }

  clearSede(): void {
    this.selectedSede.set(null);
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
    this.sedes.update((list) => list.map((sede) => (sede.id === updated.id ? updated : sede)));
  }

  createHabitacionId(): number {
    return this.nextHabitacionId++;
  }
}
