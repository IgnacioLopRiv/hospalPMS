import { InsumoInventario } from '../entities/insumo-inventario.entity';

export abstract class InsumoInventarioRepository {
  abstract findBySedeId(sedeId: number): Promise<InsumoInventario[]>;
  abstract findById(id: number): Promise<InsumoInventario | null>;
  abstract create(data: {
    sedeId: number;
    nombre: string;
    descripcion?: string | null;
    costoCompra: number;
    stockActual: number;
    stockMinimo: number;
    activo?: boolean;
  }): Promise<InsumoInventario>;
  abstract update(
    id: number,
    data: Partial<{
      nombre: string;
      descripcion: string | null;
      costoCompra: number;
      stockActual: number;
      stockMinimo: number;
      activo: boolean;
    }>,
  ): Promise<InsumoInventario>;
  abstract delete(id: number): Promise<void>;
}
