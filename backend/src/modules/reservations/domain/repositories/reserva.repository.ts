import { Reserva, EstadoReserva } from '../entities/reserva.entity';

/**
 * Puerto de repositorio para Reserva (dominio → infraestructura)
 */
export abstract class ReservaRepository {
  abstract findAll(): Promise<Reserva[]>;
  abstract findById(id: number): Promise<Reserva | null>;
  abstract findByHuespedId(huespedId: number): Promise<Reserva[]>;
  abstract findByHabitacionId(habitacionId: number): Promise<Reserva[]>;
  abstract create(data: {
    huespedId: number;
    habitacionId: number;
    fechaCheckIn: Date;
    fechaCheckOut: Date;
    estado?: EstadoReserva;
  }): Promise<Reserva>;
  abstract update(
    id: number,
    data: Partial<{
      fechaCheckIn: Date;
      fechaCheckOut: Date;
      estado: EstadoReserva;
    }>,
  ): Promise<Reserva>;
  abstract delete(id: number): Promise<void>;
}
