import { Injectable, computed, signal } from '@angular/core';
import {
  ROOM_TYPES,
  RoomType,
  Sede,
  SedeHabitacion as Habitacion,
  SedeTipologia,
} from '../../../shared/domain/hostal.model';

export { ROOM_TYPES, RoomType } from '../../../shared/domain/hostal.model';
export type { Sede, SedeHabitacion as Habitacion, SedeTipologia } from '../../../shared/domain/hostal.model';

const DEFAULT_TIPOLOGIAS: Record<number, SedeTipologia[]> = {
  1: [
    { id: 1, nombre: 'Individual Estándar', capacidad: 1, precioBase: 35000, descripcion: 'Cama individual para 1 persona con baño privado' },
    { id: 2, nombre: 'Doble Superior', capacidad: 2, precioBase: 55000, descripcion: 'Cama matrimonial o 2 camas individuales' },
    { id: 3, nombre: 'Suite Ejecutiva', capacidad: 2, precioBase: 85000, descripcion: 'Suite espaciosa con escritorio y vista panorámica' },
    { id: 4, nombre: 'Familiar Confort', capacidad: 4, precioBase: 95000, descripcion: 'Cama matrimonial y 2 camas individuales' },
  ],
  2: [
    { id: 1, nombre: 'Doble Vista al Mar', capacidad: 2, precioBase: 65000, descripcion: 'Balcón y vista directa a la playa' },
    { id: 2, nombre: 'Familiar Playa', capacidad: 4, precioBase: 110000, descripcion: 'Espacio para toda la familia frente al mar' },
    { id: 3, nombre: 'Suite Costera', capacidad: 2, precioBase: 120000, descripcion: 'Jacuzzi y terraza con vista a la bahía' },
  ],
  3: [
    { id: 1, nombre: 'Cabaña Rústica', capacidad: 2, precioBase: 50000, descripcion: 'Acogedora habitación con chimenea' },
    { id: 2, nombre: 'Familiar Montaña', capacidad: 5, precioBase: 90000, descripcion: 'Cabaña amplia de dos ambientes' },
    { id: 3, nombre: 'Suite Andina', capacidad: 2, precioBase: 80000, descripcion: 'Habitación premium con vista al volcán' },
  ],
};

const INITIAL_SEDES: Sede[] = [
  { id: 1, nombre: 'Hotel Centro', ciudad: 'Santiago', tipologias: DEFAULT_TIPOLOGIAS[1], habitaciones: [] },
  { id: 2, nombre: 'Hotel Playa', ciudad: 'Viña del Mar', tipologias: DEFAULT_TIPOLOGIAS[2], habitaciones: [] },
  { id: 3, nombre: 'Hotel Montaña', ciudad: 'Pucón', tipologias: DEFAULT_TIPOLOGIAS[3], habitaciones: [] },
];

const SEDES_STORAGE_KEY = 'hospal.sedes';
const SELECTED_SEDE_KEY = 'hospal.selectedSede';

@Injectable({ providedIn: 'root' })
export class SedeService {
  private nextHabitacionId = 1;

  readonly sedes = signal<Sede[]>(this.readSavedSedes());
  readonly selectedSede = signal<Sede | null>(this.readInitialSede());
  readonly habitaciones = computed(() => this.selectedSede()?.habitaciones ?? []);
  readonly tipologias = computed(() => this.selectedSede()?.tipologias ?? []);

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
      tipologias: [
        { id: 1, nombre: 'Individual', capacidad: 1, precioBase: 30000, descripcion: 'Habitación individual' },
        { id: 2, nombre: 'Doble', capacidad: 2, precioBase: 50000, descripcion: 'Habitación doble' },
        { id: 3, nombre: 'Suite', capacidad: 2, precioBase: 80000, descripcion: 'Suite superior' },
      ],
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

  // ── Gestión CRUD de Tipologías por Sede ───────────────────────────────────

  addTipologia(data: Omit<SedeTipologia, 'id'>): SedeTipologia {
    const selected = this.selectedSede();
    if (!selected) {
      throw new Error('No hay sede seleccionada');
    }

    const currentTipologias = selected.tipologias ?? [];
    const nextId = currentTipologias.length > 0 
      ? Math.max(...currentTipologias.map((t) => t.id)) + 1 
      : 1;

    const nuevaTipologia: SedeTipologia = {
      id: nextId,
      nombre: data.nombre.trim(),
      capacidad: Number(data.capacidad) || 1,
      precioBase: data.precioBase !== undefined ? Number(data.precioBase) : undefined,
      descripcion: data.descripcion?.trim() || '',
    };

    const updatedTipologias = [...currentTipologias, nuevaTipologia];
    const updatedSede: Sede = {
      ...selected,
      tipologias: updatedTipologias,
    };

    this.updateSede(updatedSede);
    return nuevaTipologia;
  }

  updateTipologia(id: number, patch: Partial<Omit<SedeTipologia, 'id'>>): void {
    const selected = this.selectedSede();
    if (!selected) return;

    const oldTipologia = (selected.tipologias ?? []).find((t) => t.id === id);
    const updatedTipologias = (selected.tipologias ?? []).map((t) =>
      t.id === id
        ? {
            ...t,
            ...(patch.nombre !== undefined ? { nombre: patch.nombre.trim() } : {}),
            ...(patch.capacidad !== undefined ? { capacidad: Number(patch.capacidad) || 1 } : {}),
            ...(patch.precioBase !== undefined ? { precioBase: Number(patch.precioBase) } : {}),
            ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion.trim() } : {}),
          }
        : t
    );

    // Si cambió el nombre, sincronizar el texto 'tipo' en las habitaciones asociadas
    let updatedHabitaciones = selected.habitaciones;
    if (patch.nombre && oldTipologia && oldTipologia.nombre !== patch.nombre.trim()) {
      const newName = patch.nombre.trim();
      updatedHabitaciones = selected.habitaciones.map((h) =>
        h.tipologiaId === id || h.tipo === oldTipologia.nombre
          ? { ...h, tipo: newName, tipologiaId: id }
          : h
      );
    }

    const updatedSede: Sede = {
      ...selected,
      tipologias: updatedTipologias,
      habitaciones: updatedHabitaciones,
    };

    this.updateSede(updatedSede);
  }

  deleteTipologia(id: number): { ok: boolean; message?: string } {
    const selected = this.selectedSede();
    if (!selected) {
      return { ok: false, message: 'No hay sede seleccionada.' };
    }

    const target = (selected.tipologias ?? []).find((t) => t.id === id);
    if (!target) {
      return { ok: false, message: 'La tipología no existe.' };
    }

    // Comprobar si hay habitaciones en la sede utilizando esta tipología
    const roomsInUse = (selected.habitaciones ?? []).filter(
      (h) => h.tipologiaId === id || h.tipo.toLowerCase() === target.nombre.toLowerCase()
    );

    if (roomsInUse.length > 0) {
      return {
        ok: false,
        message: `No se puede eliminar "${target.nombre}" porque está asignada a ${roomsInUse.length} habitación(es) (#${roomsInUse.map((r) => r.numero).join(', #')}).`,
      };
    }

    const updatedTipologias = (selected.tipologias ?? []).filter((t) => t.id !== id);
    const updatedSede: Sede = {
      ...selected,
      tipologias: updatedTipologias,
    };

    this.updateSede(updatedSede);
    return { ok: true };
  }

  private updateSede(updated: Sede): void {
    this.selectedSede.set(updated);
    this.sedes.update((list) => {
      const nextList = list.map((sede) => (sede.id === updated.id ? updated : sede));
      this.saveSedes(nextList);
      return nextList;
    });
    this.saveSelectedSede(updated);
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
          return parsed.map((sede: Sede) => ({
            ...sede,
            tipologias: sede.tipologias && sede.tipologias.length > 0
              ? sede.tipologias
              : (DEFAULT_TIPOLOGIAS[sede.id] ?? [
                  { id: 1, nombre: 'Individual', capacidad: 1, precioBase: 30000 },
                  { id: 2, nombre: 'Doble', capacidad: 2, precioBase: 50000 },
                  { id: 3, nombre: 'Suite', capacidad: 2, precioBase: 80000 },
                ]),
          }));
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