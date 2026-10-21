import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SedeService } from '../../locations/application/sede.service';
import { InventarioRepository } from '../domain/inventario.repository';

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

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private readonly sedeService = inject(SedeService);
  private readonly repository = inject(InventarioRepository);

  private readonly insumosRegistrados = signal<InsumoInventario[]>([]);
  private readonly asignacionesRegistradas = signal<AsignacionInventarioHabitacion[]>([]);
  private loadedSedeId: number | null = null;
  private loadingSede: { id: number; promise: Promise<void> } | null = null;
  readonly ready: Promise<void>;

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

  constructor() {
    this.ready = this.sedeService.ready.then(() => this.loadForSelectedSede());
    effect(() => {
      const sedeId = this.sedeService.selectedSede()?.id;
      if (sedeId !== undefined && sedeId !== this.loadedSedeId) {
        void this.loadForSede(sedeId).catch(() => undefined);
      }
      if (sedeId === undefined) {
        this.loadedSedeId = null;
        this.insumosRegistrados.set([]);
        this.asignacionesRegistradas.set([]);
      }
    });
  }

  private loadForSelectedSede(): Promise<void> {
    const sedeId = this.sedeService.selectedSede()?.id;
    return sedeId === undefined ? Promise.resolve() : this.loadForSede(sedeId);
  }

  private loadForSede(sedeId: number): Promise<void> {
    if (this.loadedSedeId === sedeId) return Promise.resolve();
    if (this.loadingSede?.id === sedeId) return this.loadingSede.promise;
    const promise = Promise.all([
      firstValueFrom(this.repository.listSupplies(sedeId)),
      firstValueFrom(this.repository.listRoomAssignments(sedeId)),
    ]).then(([supplies, assignments]) => {
      if (this.sedeService.selectedSede()?.id !== sedeId) return;
      this.insumosRegistrados.set(supplies.map((item) => this.fromRepositorySupply(item)));
      this.asignacionesRegistradas.set(assignments.map((item) => this.fromRepositoryAssignment(item)));
      this.loadedSedeId = sedeId;
    }).finally(() => {
      if (this.loadingSede?.id === sedeId) this.loadingSede = null;
    });
    this.loadingSede = { id: sedeId, promise };
    return promise;
  }

  async addInsumo(data: NuevoInsumo): Promise<InsumoInventario> {
    const sedeId = this.sedeService.selectedSede()?.id;
    if (sedeId === undefined) throw new Error('Selecciona una sede antes de agregar insumos.');
    this.validateInsumo(data);

    const saved = await firstValueFrom(this.repository.createSupply({
      sedeId,
      nombre: data.nombre_insumo.trim(),
      descripcion: data.descripcion.trim(),
      costoCompra: data.costo_compra,
      stockActual: data.stock_actual,
      stockMinimo: data.stock_minimo,
      activo: data.producto_activo,
    }));
    const insumo = this.fromRepositorySupply(saved);
    const nextInsumos = [...this.insumosRegistrados(), insumo];
    this.insumosRegistrados.set(nextInsumos);
    return insumo;
  }

  async updateInsumo(idInsumo: number, data: NuevoInsumo): Promise<InsumoInventario> {
    const insumo = this.insumos().find((item) => item.id_insumo === idInsumo);
    if (!insumo) throw new Error('No se encontró el insumo seleccionado para esta sede.');
    this.validateInsumo(data);

    const stockAsignado = this.habitacionesAsignadas()
      .filter((asignacion) => asignacion.id_insumo === idInsumo && asignacion.estado === 'ACTIVO')
      .reduce((total, asignacion) => total + asignacion.cantidad, 0);
    if (data.stock_actual < stockAsignado) {
      throw new Error(`El stock total no puede ser menor que las ${stockAsignado} unidades asignadas a habitaciones.`);
    }

    const response = await firstValueFrom(this.repository.updateSupply(idInsumo, {
      nombre: data.nombre_insumo.trim(),
      descripcion: data.descripcion.trim(),
      costoCompra: data.costo_compra,
      stockActual: data.stock_actual,
      stockMinimo: data.stock_minimo,
      activo: data.producto_activo,
    }));
    const updated = this.fromRepositorySupply(response);
    const nextInsumos = this.insumosRegistrados().map((item) =>
      item.id_insumo === idInsumo && item.id_sede === insumo.id_sede ? updated : item,
    );
    this.insumosRegistrados.set(nextInsumos);
    return updated;
  }

  async deleteInsumo(idInsumo: number): Promise<void> {
    const insumo = this.insumos().find((item) => item.id_insumo === idInsumo);
    if (!insumo) throw new Error('No se encontró el insumo seleccionado para esta sede.');

    await firstValueFrom(this.repository.deleteSupply(idInsumo));
    const nextAsignaciones = this.asignacionesRegistradas().filter((assignment) => assignment.id_insumo !== idInsumo);
    const nextInsumos = this.insumosRegistrados().filter(
      (item) => item.id_insumo !== idInsumo || item.id_sede !== insumo.id_sede,
    );
    this.asignacionesRegistradas.set(nextAsignaciones);
    this.insumosRegistrados.set(nextInsumos);
  }

  private validateInsumo(data: NuevoInsumo): void {
    if (!data.nombre_insumo.trim()) throw new Error('El nombre del insumo es obligatorio.');
    if (!Number.isFinite(data.costo_compra) || data.costo_compra < 0) throw new Error('El costo debe ser igual o mayor que cero.');
    if (!Number.isInteger(data.stock_actual) || data.stock_actual < 0) throw new Error('El stock total debe ser un número entero igual o mayor que cero.');
    if (!Number.isInteger(data.stock_minimo) || data.stock_minimo < 0) throw new Error('El stock mínimo debe ser un número entero igual o mayor que cero.');
  }

  async assignToRoom(idInsumo: number, idHabitacion: number, cantidad: number): Promise<AsignacionInventarioHabitacion> {
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

    const saved = await firstValueFrom(this.repository.createRoomAssignment({
      insumoId: idInsumo,
      habitacionId: idHabitacion,
      cantidad,
      estado: 'ACTIVO',
    }));
    const asignacion = this.fromRepositoryAssignment(saved);
    const nextAsignaciones = [...this.asignacionesRegistradas(), asignacion];
    this.asignacionesRegistradas.set(nextAsignaciones);
    return asignacion;
  }

  async releaseRoomAssignment(idAsignacion: number): Promise<void> {
    const assignment = this.habitacionesAsignadas().find(
      (item) => item.id_inventario_hab === idAsignacion && item.estado === 'ACTIVO',
    );
    if (!assignment) throw new Error('No se encontró la asignación activa seleccionada.');

    const saved = await firstValueFrom(this.repository.updateRoomAssignment(idAsignacion, { estado: 'DEVUELTO' }));
    const updated = this.fromRepositoryAssignment(saved);
    const nextAssignments = this.asignacionesRegistradas().map((item) => item.id_inventario_hab === idAsignacion ? updated : item);
    this.asignacionesRegistradas.set(nextAssignments);
  }

  private fromRepositorySupply(item: import('../domain/inventario.repository').Insumo): InsumoInventario {
    return {
      id_insumo: item.id,
      id_sede: item.sedeId,
      nombre_insumo: item.nombre,
      descripcion: item.descripcion ?? '',
      costo_compra: item.costoCompra,
      stock_actual: item.stockActual,
      stock_minimo: item.stockMinimo,
      producto_activo: item.activo,
    };
  }

  private fromRepositoryAssignment(item: import('../domain/inventario.repository').AsignacionInventario): AsignacionInventarioHabitacion {
    return {
      id_inventario_hab: item.id,
      id_insumo: item.insumoId,
      id_habitacion: item.habitacionId,
      cantidad: item.cantidad,
      estado: item.estado,
      fecha_asignacion: item.fechaAsignacion,
    };
  }
}
