import { InventarioHabitacion } from '../entities/inventario-habitacion.entity';

export abstract class InventarioHabitacionRepository {
  abstract findBySedeId(sedeId: number): Promise<InventarioHabitacion[]>;
  abstract findByInsumoId(insumoId: number): Promise<InventarioHabitacion[]>;
  abstract findByHabitacionId(habitacionId: number): Promise<InventarioHabitacion[]>;
  abstract findById(id: number): Promise<InventarioHabitacion | null>;
  abstract create(data: {
    insumoId: number;
    habitacionId: number;
    cantidad: number;
    estado: string;
  }): Promise<InventarioHabitacion>;
  abstract update(
    id: number,
    data: Partial<{ cantidad: number; estado: string }>,
  ): Promise<InventarioHabitacion>;
  abstract delete(id: number): Promise<void>;
  abstract deleteByInsumoId(insumoId: number): Promise<void>;
}
