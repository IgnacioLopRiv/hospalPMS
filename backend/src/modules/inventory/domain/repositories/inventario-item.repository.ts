import { InventarioItem } from '../entities/inventario-item.entity';

/**
 * Puerto de repositorio para InventarioItem (dominio → infraestructura)
 */
export abstract class InventarioItemRepository {
  abstract findByHabitacionId(habitacionId: number): Promise<InventarioItem[]>;
  abstract findById(id: number): Promise<InventarioItem | null>;
  abstract create(data: {
    habitacionId: number;
    nombre: string;
    cantidad: number;
    observaciones?: string;
  }): Promise<InventarioItem>;
  abstract update(
    id: number,
    data: Partial<{
      nombre: string;
      cantidad: number;
      observaciones: string;
    }>,
  ): Promise<InventarioItem>;
  abstract delete(id: number): Promise<void>;
}
