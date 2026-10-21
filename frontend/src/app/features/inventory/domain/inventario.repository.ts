import { Observable } from 'rxjs';

export interface Insumo {
  id: number;
  sedeId: number;
  nombre: string;
  descripcion: string | null;
  costoCompra: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
}

export type CreateInsumo = Omit<Insumo, 'id'>;

export interface AsignacionInventario {
  id: number;
  insumoId: number;
  habitacionId: number;
  cantidad: number;
  estado: string;
  fechaAsignacion: string;
}

export type CreateAsignacionInventario = Omit<AsignacionInventario, 'id' | 'fechaAsignacion'>;

export abstract class InventarioRepository {
  abstract listSupplies(sedeId: number): Observable<Insumo[]>;
  abstract createSupply(data: CreateInsumo): Observable<Insumo>;
  abstract updateSupply(id: number, data: Partial<CreateInsumo>): Observable<Insumo>;
  abstract deleteSupply(id: number): Observable<void>;
  abstract listRoomAssignments(sedeId: number): Observable<AsignacionInventario[]>;
  abstract createRoomAssignment(data: CreateAsignacionInventario): Observable<AsignacionInventario>;
  abstract updateRoomAssignment(id: number, data: Partial<Pick<AsignacionInventario, 'cantidad' | 'estado'>>): Observable<AsignacionInventario>;
}