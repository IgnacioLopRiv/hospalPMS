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
    tamanoM2?: number | null;
    disposicionMuebles?: string | null;
    descripcion?: string | null;
    huespedActual?: string | null;
    aseoIniciado?: Date | null;
  }): Promise<Habitacion>;
  abstract update(
    id: number,
    data: Partial<{
      numero: string;
      tipologiaId: number;
      cantidadPersonas: number;
      estado: EstadoHabitacion;
      tamanoM2: number | null;
      disposicionMuebles: string | null;
      descripcion: string | null;
      huespedActual: string | null;
      aseoIniciado: Date | null;
    }>,
  ): Promise<Habitacion>;
  /** Soft delete: marca la habitación como inactiva. */
  abstract delete(id: number): Promise<void>;
  /** Reservas confirmadas o en curso asignadas a la habitación. */
  abstract countActiveReservations(id: number): Promise<number>;
  abstract updateEstado(
    id: number,
    estado: EstadoHabitacion,
  ): Promise<Habitacion>;
}
