import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { EstadoHabitacion, EstadoReserva } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { ReservasController } from './reservas.controller';

// El paquete se publica como ESM y Jest (CommonJS) no puede cargarlo.
jest.mock('@nestjs/event-emitter', () => ({ EventEmitter2: class {} }));

/** Fecha relativa a "hoy" en la hora del hostal (igual que el controller). */
const dateKey = (offsetDays: number) => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};
const toDate = (key: string) => new Date(`${key}T00:00:00Z`);

interface StoredReservation {
  id: number;
  huespedId: number;
  habitacionId: number;
  fechaCheckIn: Date;
  fechaCheckOut: Date;
  estado: EstadoReserva;
  codigo: string | null;
}

type RangeFilter = { lt?: Date; gt?: Date };
interface ReservationWhere {
  huespedId?: number;
  habitacionId?: number;
  estado?: { in: EstadoReserva[] };
  id?: { not: number };
  fechaCheckIn?: RangeFilter;
  fechaCheckOut?: RangeFilter;
}

const matchesRange = (value: Date, filter?: RangeFilter) =>
  (!filter?.lt || value < filter.lt) && (!filter?.gt || value > filter.gt);

function buildController(existing: StoredReservation[]) {
  const findFirst = jest.fn(({ where }: { where: ReservationWhere }) =>
    Promise.resolve(
      existing.find(
        (reservation) =>
          (where.huespedId === undefined ||
            reservation.huespedId === where.huespedId) &&
          (where.habitacionId === undefined ||
            reservation.habitacionId === where.habitacionId) &&
          (!where.estado || where.estado.in.includes(reservation.estado)) &&
          (!where.id || reservation.id !== where.id.not) &&
          matchesRange(reservation.fechaCheckIn, where.fechaCheckIn) &&
          matchesRange(reservation.fechaCheckOut, where.fechaCheckOut),
      ) ?? null,
    ),
  );

  const created = { id: 99, codigo: 'HP-000099', estado: 'CONFIRMADA' };
  const transaction = {
    reserva: {
      findFirst,
      create: jest.fn().mockResolvedValue({ id: 99 }),
      update: jest.fn().mockResolvedValue({
        ...created,
        huespedId: 1,
        habitacionId: 10,
        fechaCheckIn: new Date(),
        fechaCheckOut: new Date(),
      }),
    },
    pago: { create: jest.fn() },
  };

  const prisma = {
    reserva: { findFirst },
    huesped: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve({ id: where.id, sedeId: 1, eliminadoEn: null }),
      ),
    },
    habitacion: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve({
          id: where.id,
          sedeId: 1,
          numero: String(where.id),
          estado: EstadoHabitacion.DISPONIBLE,
          activa: true,
          cantidadPersonas: 4,
          tipologia: { capacidadMax: 4 },
          sede: { horaCheckOut: '12:00' },
        }),
      ),
    },
    $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };

  const controller = new ReservasController(
    prisma as unknown as PrismaService,
    { emit: jest.fn() } as unknown as EventEmitter2,
  );
  return { controller, prisma };
}

const reservation = (
  overrides: Partial<StoredReservation>,
): StoredReservation => ({
  id: 1,
  huespedId: 1,
  habitacionId: 10,
  fechaCheckIn: toDate(dateKey(5)),
  fechaCheckOut: toDate(dateKey(8)),
  estado: EstadoReserva.CONFIRMADA,
  codigo: 'HP-000001',
  ...overrides,
});

describe('ReservasController – reglas de reserva', () => {
  it('rechaza fechas anteriores a hoy', async () => {
    const { controller } = buildController([]);
    await expect(
      controller.create({
        id_huesped: 1,
        id_habitacion: 10,
        fecha_llegada: dateKey(-1),
        fecha_salida: dateKey(2),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza llegada igual o posterior a la salida', async () => {
    const { controller } = buildController([]);
    await expect(
      controller.create({
        id_huesped: 1,
        id_habitacion: 10,
        fecha_llegada: dateKey(3),
        fecha_salida: dateKey(3),
      }),
    ).rejects.toThrow('posterior a la fecha de llegada');
  });

  it('rechaza reservas solapadas del mismo huésped en otra habitación', async () => {
    const { controller } = buildController([reservation({})]);
    await expect(
      controller.create({
        id_huesped: 1,
        id_habitacion: 20,
        fecha_llegada: dateKey(6),
        fecha_salida: dateKey(10),
      }),
    ).rejects.toThrow('El huésped ya tiene una reserva activa');
  });

  it('permite al mismo huésped reservar en fechas distintas', async () => {
    const { controller } = buildController([reservation({})]);
    await expect(
      controller.create({
        id_huesped: 1,
        id_habitacion: 20,
        fecha_llegada: dateKey(8),
        fecha_salida: dateKey(10),
      }),
    ).resolves.toBeDefined();
  });

  it('rechaza otra reserva de la habitación dentro del margen posterior a la salida', async () => {
    const { controller } = buildController([reservation({})]);
    await expect(
      controller.create({
        id_huesped: 2,
        id_habitacion: 10,
        fecha_llegada: dateKey(9),
        fecha_salida: dateKey(12),
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza una reserva cuyo margen cae sobre otra reserva posterior', async () => {
    const { controller } = buildController([reservation({})]);
    await expect(
      controller.create({
        id_huesped: 2,
        id_habitacion: 10,
        fecha_llegada: dateKey(1),
        fecha_salida: dateKey(4),
      }),
    ).rejects.toThrow('días libres después de cada salida');
  });

  it('permite reservar la habitación pasado el margen', async () => {
    const { controller } = buildController([reservation({})]);
    await expect(
      controller.create({
        id_huesped: 2,
        id_habitacion: 10,
        fecha_llegada: dateKey(10),
        fecha_salida: dateKey(12),
      }),
    ).resolves.toBeDefined();
  });

  it('libera el margen cuando la reserva está finalizada o cancelada', async () => {
    const { controller } = buildController([
      reservation({ estado: EstadoReserva.CANCELADA }),
    ]);
    await expect(
      controller.create({
        id_huesped: 2,
        id_habitacion: 10,
        fecha_llegada: dateKey(8),
        fecha_salida: dateKey(9),
      }),
    ).resolves.toBeDefined();
  });

  it('no permite reservar habitaciones eliminadas', async () => {
    const { controller, prisma } = buildController([]);
    prisma.habitacion.findUnique.mockResolvedValueOnce({
      id: 10,
      sedeId: 1,
      numero: '10',
      estado: EstadoHabitacion.DISPONIBLE,
      activa: false,
      cantidadPersonas: 2,
      tipologia: { capacidadMax: 2 },
      sede: { horaCheckOut: '12:00' },
    });
    await expect(
      controller.create({
        id_huesped: 1,
        id_habitacion: 10,
        fecha_llegada: dateKey(1),
        fecha_salida: dateKey(2),
      }),
    ).rejects.toThrow('fue eliminada');
  });

  it('usa la capacidad de la tipología aunque la habitación tenga cantidadPersonas = 1', async () => {
    const { controller, prisma } = buildController([]);
    const room = {
      id: 10,
      sedeId: 1,
      numero: '10',
      estado: EstadoHabitacion.DISPONIBLE,
      activa: true,
      cantidadPersonas: 1,
      tipologia: { capacidadMax: 4 },
      sede: { horaCheckOut: '12:00' },
    };
    prisma.habitacion.findUnique.mockResolvedValueOnce(room);
    await expect(
      controller.create({
        id_huesped: 1,
        id_habitacion: 10,
        fecha_llegada: dateKey(1),
        fecha_salida: dateKey(2),
        cantidad_personas: 3,
      }),
    ).resolves.toBeDefined();

    prisma.habitacion.findUnique.mockResolvedValueOnce(room);
    await expect(
      controller.create({
        id_huesped: 1,
        id_habitacion: 10,
        fecha_llegada: dateKey(20),
        fecha_salida: dateKey(21),
        cantidad_personas: 5,
      }),
    ).rejects.toThrow('supera la capacidad de la habitación (4)');
  });

  it('acepta llegar hoy de noche en Chile aunque en UTC ya sea el día siguiente', async () => {
    // 2026-11-11 02:39 UTC = 2026-11-10 23:39 en Chile (UTC-3).
    jest.useFakeTimers({ now: new Date('2026-11-11T02:39:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const { controller } = buildController([]);
      await expect(
        controller.create({
          id_huesped: 1,
          id_habitacion: 10,
          fecha_llegada: '2026-11-10',
          fecha_salida: '2026-11-11',
        }),
      ).resolves.toBeDefined();
      await expect(
        controller.create({
          id_huesped: 2,
          id_habitacion: 20,
          fecha_llegada: '2026-11-09',
          fecha_salida: '2026-11-10',
        }),
      ).rejects.toThrow('no puede ser anterior a hoy (2026-11-10)');
    } finally {
      jest.useRealTimers();
    }
  });
});
