import { of } from 'rxjs';
import { InventarioRepository } from '../inventario.repository';

export function createEmptyInventarioRepositoryStub(): InventarioRepository {
  return {
    listSupplies: () => of([]),
    createSupply: () => of({
      id: 1,
      sedeId: 1,
      nombre: '',
      descripcion: '',
      costoCompra: 0,
      stockActual: 0,
      stockMinimo: 0,
      activo: true,
    }),
    updateSupply: (id) => of({
      id,
      sedeId: 1,
      nombre: '',
      descripcion: '',
      costoCompra: 0,
      stockActual: 0,
      stockMinimo: 0,
      activo: true,
    }),
    deleteSupply: () => of(undefined),
    listRoomAssignments: () => of([]),
    createRoomAssignment: (data) => of({ ...data, id: 1, fechaAsignacion: new Date().toISOString() }),
    updateRoomAssignment: (id, data) => of({
      id,
      insumoId: 1,
      habitacionId: 1,
      cantidad: data.cantidad ?? 1,
      estado: data.estado ?? 'ACTIVO',
      fechaAsignacion: new Date().toISOString(),
    }),
  };
}