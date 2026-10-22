import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AsignacionInventario,
  CreateAsignacionInventario,
  CreateInsumo,
  Insumo,
  InventarioRepository,
} from '../domain/inventario.repository';

interface InsumoApiDto {
  id_insumo: number;
  nombre_insumo: string;
  descripcion: string;
  costo_compra: number;
  stock_actual: number;
  stock_minimo: number;
  producto_activo: boolean;
  id_sede: number;
}

interface AsignacionApiDto {
  id_inventario_hab: number;
  id_insumo: number;
  id_habitacion: number;
  cantidad: number;
  estado: string;
  fecha_asignacion: string;
}

@Injectable()
export class InventarioHttpRepository extends InventarioRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listSupplies(sedeId: number): Observable<Insumo[]> {
    return this.http.get<InsumoApiDto[]>(`${this.apiUrl}/sedes/${sedeId}/insumos`)
      .pipe(map((rows) => rows.map((row) => this.toSupply(row))));
  }

  createSupply(data: CreateInsumo): Observable<Insumo> {
    return this.http.post<InsumoApiDto>(`${this.apiUrl}/sedes/${data.sedeId}/insumos`, this.toSupplyRequest(data))
      .pipe(map((row) => this.toSupply(row)));
  }

  updateSupply(id: number, data: Partial<CreateInsumo>): Observable<Insumo> {
    return this.http.patch<InsumoApiDto>(`${this.apiUrl}/insumos/${id}`, this.toSupplyRequest(data))
      .pipe(map((row) => this.toSupply(row)));
  }

  deleteSupply(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/insumos/${id}`).pipe(map(() => undefined));
  }

  listRoomAssignments(sedeId: number): Observable<AsignacionInventario[]> {
    return this.http.get<AsignacionApiDto[]>(`${this.apiUrl}/inventario-habitaciones`, { params: { sedeId } })
      .pipe(map((rows) => rows.map((row) => this.toAssignment(row))));
  }

  createRoomAssignment(data: CreateAsignacionInventario): Observable<AsignacionInventario> {
    return this.http.post<AsignacionApiDto>(`${this.apiUrl}/inventario-habitaciones`, {
      id_insumo: data.insumoId,
      id_habitacion: data.habitacionId,
      cantidad: data.cantidad,
      estado: data.estado,
    }).pipe(map((row) => this.toAssignment(row)));
  }

  updateRoomAssignment(
    id: number,
    data: Partial<Pick<AsignacionInventario, 'cantidad' | 'estado'>>,
  ): Observable<AsignacionInventario> {
    return this.http.patch<AsignacionApiDto>(`${this.apiUrl}/inventario-habitaciones/${id}`, data)
      .pipe(map((row) => this.toAssignment(row)));
  }

  private toSupply(row: InsumoApiDto): Insumo {
    return {
      id: row.id_insumo,
      sedeId: row.id_sede,
      nombre: row.nombre_insumo,
      descripcion: row.descripcion,
      costoCompra: row.costo_compra,
      stockActual: row.stock_actual,
      stockMinimo: row.stock_minimo,
      activo: row.producto_activo,
    };
  }

  private toSupplyRequest(data: Partial<CreateInsumo>) {
    return {
      ...(data.nombre !== undefined ? { nombre_insumo: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.costoCompra !== undefined ? { costo_compra: data.costoCompra } : {}),
      ...(data.stockActual !== undefined ? { stock_actual: data.stockActual } : {}),
      ...(data.stockMinimo !== undefined ? { stock_minimo: data.stockMinimo } : {}),
      ...(data.activo !== undefined ? { producto_activo: data.activo } : {}),
    };
  }

  private toAssignment(row: AsignacionApiDto): AsignacionInventario {
    return {
      id: row.id_inventario_hab,
      insumoId: row.id_insumo,
      habitacionId: row.id_habitacion,
      cantidad: row.cantidad,
      estado: row.estado,
      fechaAsignacion: row.fecha_asignacion,
    };
  }
}