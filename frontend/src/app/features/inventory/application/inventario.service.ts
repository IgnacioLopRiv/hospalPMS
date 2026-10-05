import { Injectable, computed, inject, signal } from '@angular/core';
import { SedeService } from '../../locations/application/sede.service';

export interface InsumoInventario {
  id_insumo: number;
  nombre_insumo: string;
  descripcion: string;
  costo_compra: number;
  stock_actual: number;
  stock_minimo: number;
  producto_activo: boolean;
  id_sede: number;
}

export interface AsignacionInventarioHabitacion {
  id_inventario_hab: number;
  cantidad: number;
  estado: string;
  fecha_asignacion: string;
  id_insumo: number;
  id_habitacion: number;
}

export type NuevoInsumo = Omit<InsumoInventario, 'id_insumo' | 'id_sede'>;

const INSUMOS_STORAGE_KEY = 'hospal.inventario.insumos';
const ASIGNACIONES_STORAGE_KEY = 'hospal.inventario.habitaciones';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private readonly sedeService = inject(SedeService);

  private readonly insumosRegistrados = signal<InsumoInventario[]>(this.readStored<InsumoInventario[]>(INSUMOS_STORAGE_KEY));
  private readonly asignacionesRegistradas = signal<AsignacionInventarioHabitacion[]>(
    this.readStored<AsignacionInventarioHabitacion[]>(ASIGNACIONES_STORAGE_KEY),
  );

  readonly insumos = computed(() => {
    const sedeId = this.sedeService.selectedSede()?.id;
    return sedeId === undefined
      ? []
      : this.insumosRegistrados().filter((insumo) => insumo.id_sede === sedeId);
  });

  readonly habitacionesAsignadas = computed(() => {
    const sede = this.sedeService.selectedSede();
    if (!sede) return [];
    const roomIds = new Set(sede.habitaciones.map((room) => room.id));
    const insumoIds = new Set(this.insumos().map((insumo) => insumo.id_insumo));
    return this.asignacionesRegistradas().filter(
      (asignacion) =>
        asignacion.estado === 'ACTIVO'
        && insumoIds.has(asignacion.id_insumo)
        && roomIds.has(asignacion.id_habitacion),
    );
  });

  addInsumo(data: NuevoInsumo): InsumoInventario {
    const sedeId = this.sedeService.selectedSede()?.id;
    if (sedeId === undefined) throw new Error('Selecciona una sede antes de agregar insumos.');
    this.validateInsumo(data);

    const nextId = this.insumosRegistrados().reduce((max, insumo) => Math.max(max, insumo.id_insumo), 0) + 1;
    const insumo: InsumoInventario = {
      ...data,
      nombre_insumo: data.nombre_insumo.trim(),
      descripcion: data.descripcion.trim(),
      id_insumo: nextId,
      id_sede: sedeId,
    };
    const nextInsumos = [...this.insumosRegistrados(), insumo];
    this.persist(INSUMOS_STORAGE_KEY, nextInsumos);
    this.insumosRegistrados.set(nextInsumos);
    return insumo;
  }

  updateInsumo(idInsumo: number, data: NuevoInsumo): InsumoInventario {
    const insumo = this.insumos().find((item) => item.id_insumo === idInsumo);
    if (!insumo) throw new Error('No se encontró el insumo seleccionado para esta sede.');
    this.validateInsumo(data);

    const stockAsignado = this.habitacionesAsignadas()
      .filter((asignacion) => asignacion.id_insumo === idInsumo && asignacion.estado === 'ACTIVO')
      .reduce((total, asignacion) => total + asignacion.cantidad, 0);
    if (data.stock_actual < stockAsignado) {
      throw new Error(`El stock total no puede ser menor que las ${stockAsignado} unidades asignadas a habitaciones.`);
    }

    const updated: InsumoInventario = {
      ...insumo,
      ...data,
      nombre_insumo: data.nombre_insumo.trim(),
      descripcion: data.descripcion.trim(),
    };
    const nextInsumos = this.insumosRegistrados().map((item) =>
      item.id_insumo === idInsumo && item.id_sede === insumo.id_sede ? updated : item,
    );
    this.persist(INSUMOS_STORAGE_KEY, nextInsumos);
    this.insumosRegistrados.set(nextInsumos);
    return updated;
  }

  deleteInsumo(idInsumo: number): void {
    const insumo = this.insumos().find((item) => item.id_insumo === idInsumo);
    if (!insumo) throw new Error('No se encontró el insumo seleccionado para esta sede.');

    const nextAsignaciones = this.asignacionesRegistradas().filter(
      (asignacion) => asignacion.id_insumo !== idInsumo,
    );
    const nextInsumos = this.insumosRegistrados().filter(
      (item) => item.id_insumo !== idInsumo || item.id_sede !== insumo.id_sede,
    );
    this.persist(ASIGNACIONES_STORAGE_KEY, nextAsignaciones);
    this.persist(INSUMOS_STORAGE_KEY, nextInsumos);
    this.asignacionesRegistradas.set(nextAsignaciones);
    this.insumosRegistrados.set(nextInsumos);
  }

  private validateInsumo(data: NuevoInsumo): void {
    if (!data.nombre_insumo.trim()) throw new Error('El nombre del insumo es obligatorio.');
    if (!Number.isFinite(data.costo_compra) || data.costo_compra < 0) throw new Error('El costo debe ser igual o mayor que cero.');
    if (!Number.isInteger(data.stock_actual) || data.stock_actual < 0) throw new Error('El stock total debe ser un número entero igual o mayor que cero.');
    if (!Number.isInteger(data.stock_minimo) || data.stock_minimo < 0) throw new Error('El stock mínimo debe ser un número entero igual o mayor que cero.');
  }

  assignToRoom(idInsumo: number, idHabitacion: number, cantidad: number): AsignacionInventarioHabitacion {
    const insumo = this.insumos().find((item) => item.id_insumo === idInsumo);
    if (!insumo) throw new Error('No se encontró el insumo seleccionado para esta sede.');
    const habitacion = this.sedeService.habitaciones().find((room) => room.id === idHabitacion);
    if (!habitacion) throw new Error('Selecciona una habitación válida.');
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un número entero mayor que cero.');
    if (!insumo.producto_activo) throw new Error('No se pueden asignar insumos inactivos.');

    const yaAsignado = this.habitacionesAsignadas()
      .filter((asignacion) => asignacion.id_insumo === idInsumo && asignacion.estado === 'ACTIVO')
      .reduce((total, asignacion) => total + asignacion.cantidad, 0);
    const disponible = insumo.stock_actual - yaAsignado;
    if (cantidad > disponible) throw new Error(`Solo hay ${disponible} unidades disponibles en bodega.`);

    const nextId = this.asignacionesRegistradas().reduce(
      (max, asignacion) => Math.max(max, asignacion.id_inventario_hab),
      0,
    ) + 1;
    const asignacion: AsignacionInventarioHabitacion = {
      id_inventario_hab: nextId,
      cantidad,
      estado: 'ACTIVO',
      fecha_asignacion: new Date().toISOString(),
      id_insumo: idInsumo,
      id_habitacion: idHabitacion,
    };
    const nextAsignaciones = [...this.asignacionesRegistradas(), asignacion];
    this.persist(ASIGNACIONES_STORAGE_KEY, nextAsignaciones);
    this.asignacionesRegistradas.set(nextAsignaciones);
    return asignacion;
  }

  releaseRoomAssignment(idAsignacion: number): void {
    const assignment = this.habitacionesAsignadas().find(
      (item) => item.id_inventario_hab === idAsignacion && item.estado === 'ACTIVO',
    );
    if (!assignment) throw new Error('No se encontró la asignación activa seleccionada.');

    const nextAssignments = this.asignacionesRegistradas().map((item) =>
      item.id_inventario_hab === idAsignacion
        ? { ...item, estado: 'DEVUELTO' }
        : item,
    );
    this.persist(ASIGNACIONES_STORAGE_KEY, nextAssignments);
    this.asignacionesRegistradas.set(nextAssignments);
  }

  private readStored<T>(key: string): T {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : [] as T;
  }

  private persist<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
