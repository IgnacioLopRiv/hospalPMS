import { Observable } from 'rxjs';
import { Reserva } from '../../../shared/domain/hostal.model';

export type CreateReserva = Omit<Reserva, 'id_reserva'>;
export type UpdateReserva = Partial<Omit<Reserva, 'id_reserva'>>;

export abstract class ReservasRepository {
  abstract listBySede(sedeId: number): Observable<Reserva[]>;
  abstract create(data: CreateReserva): Observable<Reserva>;
  abstract update(id: number, data: UpdateReserva, sedeId?: number): Observable<Reserva>;
  abstract remove(id: number, sedeId?: number): Observable<void>;
}