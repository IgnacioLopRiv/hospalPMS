import { of } from 'rxjs';
import { Reserva } from '../../../../shared/domain/hostal.model';
import { CreateHuesped, Huesped, HuespedRepository } from '../huesped.repository';
import { CreateReserva, ReservasRepository, UpdateReserva } from '../../../reservations/domain/reservas.repository';

export function createHostalRepositoryStubs(): {
  huespedRepository: HuespedRepository;
  reservasRepository: ReservasRepository;
} {
  let huespedes: Huesped[] = [];
  let reservas: Reserva[] = [];

  const huespedRepository: HuespedRepository = {
    list: (sedeId?: number) => of(sedeId ? huespedes.filter((row) => row.sedeId === sedeId) : huespedes),
    create: (data: CreateHuesped) => {
      const saved = { ...data, id: Math.max(0, ...huespedes.map((row) => row.id)) + 1 };
      huespedes = [...huespedes, saved];
      return of(saved);
    },
    update: (id, data, sedeId) => {
      huespedes = huespedes.map((row) =>
        row.id === id && (sedeId === undefined || row.sedeId === sedeId) ? { ...row, ...data } : row
      );
      return of(huespedes.find((row) => row.id === id)!);
    },
    remove: (id, sedeId) => {
      const deletedIds = new Set(reservas.filter((row) => row.id_huesped === id).map((row) => row.id_reserva));
      huespedes = huespedes.filter((row) => !(row.id === id && (sedeId === undefined || row.sedeId === sedeId)));
      reservas = reservas.filter((row) => !deletedIds.has(row.id_reserva));
      return of(undefined);
    },
  };

  const reservasRepository: ReservasRepository = {
    listBySede: () => of(reservas),
    create: (data: CreateReserva) => {
      const saved: Reserva = { ...data, id_reserva: Math.max(0, ...reservas.map((row) => row.id_reserva)) + 1 };
      reservas = [...reservas, saved];
      return of(saved);
    },
    update: (id: number, data: UpdateReserva, _sedeId?: number) => {
      reservas = reservas.map((row) => row.id_reserva === id ? { ...row, ...data } : row);
      return of(reservas.find((row) => row.id_reserva === id)!);
    },
    remove: (id, _sedeId) => {
      reservas = reservas.filter((row) => row.id_reserva !== id);
      return of(undefined);
    },
  };

  return { huespedRepository, reservasRepository };
}