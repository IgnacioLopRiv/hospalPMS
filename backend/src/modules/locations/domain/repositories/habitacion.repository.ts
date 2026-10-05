import { Habitacion, EstadoHabitacion } from '../entities/habitacion.entity';

/**
 * Puerto de repositorio para Habitacion (dominio → infraestructura)
 */
export abstract class HabitacionRepository {
  abstract findBySedeId(sedeId: number): Promise<Habitacion[]>;
  abstract findById(id: number): Promise<Habitacion | null>;
  abstract create(data: {
    sedeId: number;
    numero: string;
    tipologiaId?: number;
    tamanoM2?: number;
    disposicionMuebles?: string;
    descripcion?: string;
  }): Promise<Habitacion>;
  abstract update(
    id: number,
    data: Partial<{
      numero: string;
      tipologiaId: number | null;
      tamanoM2: number | null;
      disposicionMuebles: string;
      descripcion: string;
      estado: EstadoHabitacion;
    }>,
  ): Promise<Habitacion>;
  abstract delete(id: number): Promise<void>;
  abstract updateEstado(id: number, estado: EstadoHabitacion): Promise<Habitacion>;
}
