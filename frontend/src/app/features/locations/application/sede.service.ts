import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Sede,
  SedeHabitacion as Habitacion,
  SedeTipologia,
  EstadoHabitacion,
} from '../../../shared/domain/hostal.model';
import { LocationsRepository } from '../domain/locations.repository';

export type { Sede, SedeHabitacion as Habitacion, SedeTipologia, EstadoHabitacion } from '../../../shared/domain/hostal.model';

const SELECTED_SEDE_KEY = 'hospal.selectedSede';
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function colorHue(color: string): number {
  const red = parseInt(color.slice(1, 3), 16) / 255;
  const green = parseInt(color.slice(3, 5), 16) / 255;
  const blue = parseInt(color.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;

  if (difference === 0) return 0;
  if (maximum === red) return ((green - blue) / difference + (green < blue ? 6 : 0)) * 60;
  if (maximum === green) return ((blue - red) / difference + 2) * 60;
  return ((red - green) / difference + 4) * 60;
}

function hueToHex(hue: number): string {
  const saturation = 0.7;
  const lightness = 0.43;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = lightness - chroma / 2;
  const [red, green, blue] = hue < 60 ? [chroma, secondary, 0]
    : hue < 120 ? [secondary, chroma, 0]
      : hue < 180 ? [0, chroma, secondary]
        : hue < 240 ? [0, secondary, chroma]
          : hue < 300 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

@Injectable({ providedIn: 'root' })
export class SedeService {
  private readonly repository = inject(LocationsRepository);
  private nextHabitacionId = 1;

  readonly sedes = signal<Sede[]>([]);
  readonly selectedSede = signal<Sede | null>(null);
  readonly loadError = signal('');
  readonly ready: Promise<void>;
  readonly habitaciones = computed(() => this.selectedSede()?.habitaciones ?? []);
  readonly tipologias = computed(() => this.selectedSede()?.tipologias ?? []);

  constructor() {
    this.ready = this.loadSedes().catch((error: unknown) => {
      this.loadError.set(error instanceof Error ? error.message : 'No se pudieron cargar las sedes.');
    });
  }

  private async loadSedes(): Promise<void> {
    const sedes = await firstValueFrom(this.repository.listSedes());
    const normalized = sedes.map((sede) => ({
        ...sede,
        habitaciones: (sede.habitaciones ?? []).map((room) => ({
          ...room,
          estado: room.estado || 'libre' as EstadoHabitacion,
        })),
        tipologias: this.assignMissingTypologyColors(sede.tipologias ?? []),
      }));
    this.sedes.set(normalized);
    const selectedId = this.readSelectedSedeId();
    const selected = normalized.find((sede) => sede.id === selectedId) ?? normalized[0] ?? null;
    this.selectedSede.set(selected);
    if (selected) this.saveSelectedSede(selected);
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
  async createSede(data: { nombre: string; ciudad: string }): Promise<Sede> {
    const created = await firstValueFrom(this.repository.createSede({
      nombre: data.nombre.trim(),
      ciudad: data.ciudad.trim(),
    }));
    const nuevaSede: Sede = { ...created, tipologias: [], habitaciones: [] };
    this.sedes.update((list) => [...list, nuevaSede]);
    return nuevaSede;
  }

  /**
   * U (Actualizar datos generales): Modifica nombre y ciudad de una sede
   */
  async updateSedeInfo(id: number, data: { nombre: string; ciudad: string }): Promise<void> {
    await firstValueFrom(this.repository.updateSede(id, {
      nombre: data.nombre.trim(),
      ciudad: data.ciudad.trim(),
    }));
    this.sedes.update((list) => list.map((sede) =>
      sede.id === id ? { ...sede, nombre: data.nombre.trim(), ciudad: data.ciudad.trim() } : sede
    ));

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
  async deleteSede(id: number): Promise<void> {
    await firstValueFrom(this.repository.deleteSede(id));
    this.sedes.update((list) => list.filter((sede) => sede.id !== id));

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

  async addTipologia(data: Omit<SedeTipologia, 'id'>): Promise<SedeTipologia> {
    const selected = this.selectedSede();
    if (!selected) {
      throw new Error('No hay sede seleccionada');
    }

    const currentTipologias = selected.tipologias ?? [];
    const response = await firstValueFrom(this.repository.createTypology(selected.id, {
      ...data,
      nombre: data.nombre.trim(),
      capacidad: Number(data.capacidad) || 1,
      color: this.createUniqueTypologyColor(currentTipologias.map((typology) => typology.color ?? '')),
      precioBase: data.precioBase !== undefined ? Number(data.precioBase) : undefined,
      descripcion: data.descripcion?.trim() || '',
    }));
    const nuevaTipologia: SedeTipologia = this.assignMissingTypologyColors([response])[0];

    const updatedTipologias = [...currentTipologias, nuevaTipologia];
    const updatedSede: Sede = {
      ...selected,
      tipologias: updatedTipologias,
    };

    this.setUpdatedSede(updatedSede);
    return nuevaTipologia;
  }

  async updateTipologia(id: number, patch: Partial<Omit<SedeTipologia, 'id'>>): Promise<void> {
    const selected = this.selectedSede();
    if (!selected) return;

    const oldTipologia = (selected.tipologias ?? []).find((t) => t.id === id);
    const response = await firstValueFrom(this.repository.updateTypology(id, {
      ...(patch.nombre !== undefined ? { nombre: patch.nombre.trim() } : {}),
      ...(patch.capacidad !== undefined ? { capacidad: Number(patch.capacidad) || 1 } : {}),
      ...(patch.precioBase !== undefined ? { precioBase: Number(patch.precioBase) } : {}),
      ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    }));
    const updatedTipologias = (selected.tipologias ?? []).map((t) =>
      t.id === id
        ? {
            ...t,
            ...response,
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

    this.setUpdatedSede(updatedSede);
  }

  async deleteTipologia(id: number): Promise<{ ok: boolean; message?: string }> {
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

    try {
      await firstValueFrom(this.repository.deleteTypology(id));
    } catch {
      return { ok: false, message: 'No se pudo eliminar la tipología; puede tener habitaciones asociadas.' };
    }
    this.setUpdatedSede(updatedSede);
    return { ok: true };
  }

  private setUpdatedSede(updated: Sede): void {
    this.selectedSede.set(updated);
    this.sedes.update((list) => {
      return list.map((sede) => (sede.id === updated.id ? updated : sede));
    });
    this.saveSelectedSede(updated);
  }

  async updateSelectedSede(patch: Pick<Sede, 'nombre' | 'habitaciones'>): Promise<void> {
    const current = this.selectedSede();
    if (!current) {
      return;
    }

    if (patch.nombre.trim() !== current.nombre) {
      await firstValueFrom(this.repository.updateSede(current.id, { nombre: patch.nombre.trim(), ciudad: current.ciudad }));
    }
    const existingById = new Map(current.habitaciones.map((room) => [room.id, room]));
    const persistedRooms: Habitacion[] = [];
    for (const room of patch.habitaciones) {
      const data = {
        numero: room.numero.trim(),
        tipo: room.tipo,
        tipologiaId: room.tipologiaId ?? current.tipologias?.find((typology) => typology.nombre === room.tipo)?.id ?? 0,
        tamanoM2: room.tamanoM2,
        disposicionMuebles: room.disposicionMuebles,
        descripcion: room.descripcion ?? '',
        estado: room.estado ?? 'libre' as EstadoHabitacion,
        huespedActual: room.huespedActual,
        aseoIniciado: room.aseoIniciado,
        inventario: room.inventario,
      };
      const existing = existingById.get(room.id);
      const saved = existing
        ? await firstValueFrom(this.repository.updateRoom(room.id, data))
        : await firstValueFrom(this.repository.createRoom(current.id, data));
      persistedRooms.push(saved as Habitacion);
    }
    const retainedIds = new Set(current.habitaciones.filter((room) =>
      patch.habitaciones.some((candidate) => candidate.id === room.id)
    ).map((room) => room.id));
    for (const room of current.habitaciones) {
      if (!retainedIds.has(room.id)) await firstValueFrom(this.repository.deleteRoom(room.id));
    }

    const updated: Sede = {
      ...current,
      nombre: patch.nombre.trim(),
      habitaciones: persistedRooms,
    };

    this.setUpdatedSede(updated);
    this.syncNextHabitacionId();
  }

  createHabitacionId(): number {
    return this.nextHabitacionId++;
  }

  /**
   * Actualiza el estado de una habitación por su número o ID
   */
  async updateHabitacionEstado(
    numeroOrId: string | number,
    estado: EstadoHabitacion,
    extra?: { huesped?: string; aseoIniciado?: number }
  ): Promise<void> {
    const current = this.selectedSede();
    if (!current) return;

    const strTarget = String(numeroOrId).trim();
    let updatedAny = false;

    const nextHabitaciones = current.habitaciones.map((h) => {
      if (String(h.numero).trim() === strTarget || String(h.id) === strTarget) {
        updatedAny = true;
        return {
          ...h,
          estado,
          huespedActual: estado === 'ocupada' ? (extra?.huesped || h.huespedActual || 'Huésped activo') : undefined,
          aseoIniciado: estado === 'en aseo' ? (extra?.aseoIniciado ?? Date.now()) : undefined,
        };
      }
      return h;
    });

    if (updatedAny) {
      const updatedRoom = nextHabitaciones.find((room) =>
        String(room.numero).trim() === strTarget || String(room.id) === strTarget
      );
      if (!updatedRoom) return;
      const saved = await firstValueFrom(this.repository.updateRoom(updatedRoom.id, {
        numero: updatedRoom.numero,
        tipologiaId: updatedRoom.tipologiaId,
        estado: updatedRoom.estado,
        huespedActual: updatedRoom.huespedActual,
        aseoIniciado: updatedRoom.aseoIniciado,
      }));
      this.setUpdatedSede({ ...current, habitaciones: nextHabitaciones.map((room) => room.id === saved.id ? saved : room) });
    }
  }

  marcarOcupada(numeroOrId: string | number, huesped?: string): Promise<void> {
    return this.updateHabitacionEstado(numeroOrId, 'ocupada', { huesped });
  }

  marcarEnAseo(numeroOrId: string | number): Promise<void> {
    return this.updateHabitacionEstado(numeroOrId, 'en aseo', { aseoIniciado: Date.now() });
  }

  marcarLibre(numeroOrId: string | number): Promise<void> {
    return this.updateHabitacionEstado(numeroOrId, 'libre');
  }

  /**
   * Revisa automáticamente habitaciones en aseo y las libera si ya transcurrió el tiempo de aseo.
   * @param maxMinutos Duración del aseo antes de volver a libre (por defecto 30 min)
   */
  async autoLiberarAseo(maxMinutos = 30): Promise<void> {
    const current = this.selectedSede();
    if (!current) return;

    const ahora = Date.now();
    const tiempoLimiteMs = maxMinutos * 60 * 1000;
    let huboCambios = false;

    const nextHabitaciones = current.habitaciones.map((h) => {
      if (h.estado === 'en aseo' && h.aseoIniciado) {
        if (ahora - h.aseoIniciado >= tiempoLimiteMs) {
          huboCambios = true;
          return {
            ...h,
            estado: 'libre' as EstadoHabitacion,
            aseoIniciado: undefined,
          };
        }
      }
      return h;
    });

    if (huboCambios) {
      await this.updateSelectedSede({ nombre: current.nombre, habitaciones: nextHabitaciones });
    }
  }

  private assignMissingTypologyColors(tipologias: SedeTipologia[]): SedeTipologia[] {
    const usedColors = new Set<string>();
    return tipologias.map((typology) => {
      const storedColor = typology.color?.toUpperCase();
      const color = storedColor && HEX_COLOR_PATTERN.test(storedColor) && !usedColors.has(storedColor)
        ? storedColor
        : this.createUniqueTypologyColor(Array.from(usedColors));
      usedColors.add(color);
      return { ...typology, color };
    });
  }

  private createUniqueTypologyColor(usedColors: string[]): string {
    const normalizedColors = new Set(usedColors.map((color) => color.toUpperCase()));
    const usedHues = Array.from(normalizedColors)
      .filter((color) => HEX_COLOR_PATTERN.test(color))
      .map(colorHue);

    for (let attempt = 0; attempt < 1000; attempt++) {
      const hue = Math.random() * 360;
      const color = hueToHex(hue).toUpperCase();
      const huesAreDistinct = usedHues.length >= 22 ||
        usedHues.every((usedHue) => {
          const difference = Math.abs(hue - usedHue);
          return Math.min(difference, 360 - difference) >= 14;
        });
      if (!normalizedColors.has(color) && huesAreDistinct) return color;
    }
    throw new Error('No se pudo generar un color único para la tipología.');
  }

  private readSelectedSedeId(): number | null {
    try {
      const raw = localStorage.getItem(SELECTED_SEDE_KEY);
      if (raw) return Number(JSON.parse(raw)?.id) || null;
    } catch {
      return null;
    }
    return null;
  }

  private saveSelectedSede(sede: Sede): void {
    try {
      localStorage.setItem(SELECTED_SEDE_KEY, JSON.stringify({ id: sede.id }));
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