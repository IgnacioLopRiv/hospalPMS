import { Injectable, computed, signal } from '@angular/core';
import {
  Sede,
  SedeHabitacion as Habitacion,
  SedeTipologia,
  EstadoHabitacion,
} from '../../../shared/domain/hostal.model';

export type { Sede, SedeHabitacion as Habitacion, SedeTipologia } from '../../../shared/domain/hostal.model';

const INITIAL_SEDES: Sede[] = [
  { id: 1, nombre: 'Hotel Centro', ciudad: 'Santiago', tipologias: [], habitaciones: [] },
  { id: 2, nombre: 'Hotel Playa', ciudad: 'Viña del Mar', tipologias: [], habitaciones: [] },
  { id: 3, nombre: 'Hotel Montaña', ciudad: 'Pucón', tipologias: [], habitaciones: [] },
];

const SEDES_STORAGE_KEY = 'hospal.sedes';
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
      tipologias: [],
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
      color: this.createUniqueTypologyColor(currentTipologias.map((tipologia) => tipologia.color ?? '')),
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

  updateTipologia(id: number, patch: Partial<Omit<SedeTipologia, 'id' | 'color'>>): void {
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

  /**
   * Actualiza el estado de una habitación por su número o ID
   */
  updateHabitacionEstado(
    numeroOrId: string | number,
    estado: EstadoHabitacion,
    extra?: { huesped?: string; aseoIniciado?: number }
  ): void {
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
      this.updateSede({
        ...current,
        habitaciones: nextHabitaciones,
      });
    }
  }

  marcarOcupada(numeroOrId: string | number, huesped?: string): void {
    this.updateHabitacionEstado(numeroOrId, 'ocupada', { huesped });
  }

  marcarEnAseo(numeroOrId: string | number): void {
    this.updateHabitacionEstado(numeroOrId, 'en aseo', { aseoIniciado: Date.now() });
  }

  marcarLibre(numeroOrId: string | number): void {
    this.updateHabitacionEstado(numeroOrId, 'libre');
  }

  /**
   * Revisa automáticamente habitaciones en aseo y las libera si ya transcurrió el tiempo de aseo.
   * @param maxMinutos Duración del aseo antes de volver a libre (por defecto 30 min)
   */
  autoLiberarAseo(maxMinutos = 30): void {
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
      this.updateSede({
        ...current,
        habitaciones: nextHabitaciones,
      });
    }
  }

  private readSavedSedes(): Sede[] {
    try {
      const raw = localStorage.getItem(SEDES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalizedSedes = (parsed as Sede[]).map((sede) => ({
            ...sede,
            tipologias: this.assignMissingTypologyColors(sede.tipologias ?? [])
          }));
          this.saveSedes(normalizedSedes);
          return normalizedSedes;
        }
      }
    } catch {
      // Usar sedes iniciales si falla lectura
    }
    const initialSedes = INITIAL_SEDES.map((sede) => ({
      ...sede,
      habitaciones: [],
      tipologias: this.assignMissingTypologyColors(sede.tipologias ?? [])
    }));
    this.saveSedes(initialSedes);
    return initialSedes;
  }

  private assignMissingTypologyColors(tipologias: SedeTipologia[]): SedeTipologia[] {
    const usedColors = new Set<string>();
    return tipologias.map((tipologia) => {
      const storedColor = tipologia.color?.toUpperCase();
      const color = storedColor && HEX_COLOR_PATTERN.test(storedColor) && !usedColors.has(storedColor)
        ? storedColor
        : this.createUniqueTypologyColor(Array.from(usedColors));
      usedColors.add(color);
      return { ...tipologia, color };
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