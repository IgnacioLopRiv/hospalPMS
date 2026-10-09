import { Habitacion, EstadoHabitacion } from '../entities/habitacion.entity';

/**
 * Puerto de repositorio para Habitacion (dominio → infraestructura)
 */
export abstract class HabitacionRepository {
  abstract findBySedeId(sedeId: number): Promise<Habitacion[]>;
  abstract findById(id: number): Promise<Habitacion | null>;
  abstract create(data: {
    sedeId: number;
    tipologiaId: number;
    numero: string;
    cantidadPersonas: number;
    estado?: EstadoHabitacion;
  }): Promise<Habitacion>;
  abstract update(
    id: number,
    data: Partial<{
      numero: string;
      tipologiaId: number;
      cantidadPersonas: number;
      estado: EstadoHabitacion;
    }>,
  ): Promise<Habitacion>;
  abstract delete(id: number): Promise<void>;
  abstract updateEstado(id: number, estado: EstadoHabitacion): Promise<Habitacion>;
}
