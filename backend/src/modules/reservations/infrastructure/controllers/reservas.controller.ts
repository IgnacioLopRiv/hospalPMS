import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EstadoHabitacion,
  EstadoReserva,
  MetodoPago,
  Prisma,
  TipoDocumento,
  TipoOperacion,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import {
  ReservaDto,
  ReservaSedeQueryDto,
  TIME_PATTERN,
} from '../dto/reserva.dto';

type Transaction = Prisma.TransactionClient;

const ACTIVE_STATES: EstadoReserva[] = [
  EstadoReserva.CONFIRMADA,
  EstadoReserva.EN_CURSO,
];

@Controller('reservas')
export class ReservasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async findAll(@Query() query: ReservaSedeQueryDto) {
    const reservas = await this.prisma.reserva.findMany({
      where: { habitacion: { sedeId: query.sedeId } },
      orderBy: { fechaCheckIn: 'asc' },
    });
    return reservas.map((reservation) => this.toFrontend(reservation));
  }

  @Post()
  async create(@Body() input: ReservaDto) {
    if (
      input.id_huesped === undefined ||
      input.id_habitacion === undefined ||
      !input.fecha_llegada ||
      !input.fecha_salida
    ) {
      throw new BadRequestException(
        'Completa huésped, habitación y fechas de la reserva.',
      );
    }
    this.validateDateRange(input.fecha_llegada, input.fecha_salida);

    const [huesped, habitacion] = await Promise.all([
      this.prisma.huesped.findUnique({ where: { id: input.id_huesped } }),
      this.prisma.habitacion.findUnique({
        where: { id: input.id_habitacion },
        include: { tipologia: true, sede: true },
      }),
    ]);
    if (!huesped)
      throw new NotFoundException(`No existe el huésped ${input.id_huesped}.`);
    if (!habitacion)
      throw new NotFoundException(
        `No existe la habitación ${input.id_habitacion}.`,
      );
    if (huesped.sedeId !== habitacion.sedeId) {
      throw new BadRequestException(
        'El huésped y la habitación deben pertenecer a la misma sede.',
      );
    }
    this.validateRoomAllowed(habitacion);
    this.validateCapacity(habitacion, input.cantidad_personas);

    const expectedState = this.toDatabaseState(input.estado_reserva);
    if (expectedState === EstadoReserva.CANCELADA) {
      throw new BadRequestException(
        'No se puede crear una reserva en estado CANCELADA.',
      );
    }
    await this.assertNoOverlap(
      input.id_habitacion,
      input.fecha_llegada,
      input.fecha_salida,
      expectedState,
    );

    let createdPaymentId: number | null = null;
    const reservation = await this.prisma.$transaction(async (transaction) => {
      await this.assertNoOverlapInTransaction(
        transaction,
        input.id_habitacion!,
        input.fecha_llegada!,
        input.fecha_salida!,
        expectedState,
      );

      const saved = await transaction.reserva.create({
        data: this.toDatabase(
          input,
          false,
          habitacion.sede.horaCheckOut ?? undefined,
        ) as Prisma.ReservaUncheckedCreateInput,
      });

      const codigo = `HP-${String(saved.id).padStart(6, '0')}`;
      const withCode = await transaction.reserva.update({
        where: { id: saved.id },
        data: { codigo },
      });

      createdPaymentId = await this.recordPayment(
        transaction,
        withCode.id,
        input,
        0,
      );
      if (withCode.estado === EstadoReserva.EN_CURSO) {
        await this.issueCheckInReceipt(transaction, withCode);
      }
      return withCode;
    });

    this.eventEmitter.emit('reserva.creada', { reservaId: reservation.id });
    if (createdPaymentId) {
      this.eventEmitter.emit('pago.registrado', {
        reservaId: reservation.id,
        pagoId: createdPaymentId,
      });
    }

    return this.toFrontend(reservation);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ReservaSedeQueryDto,
    @Body() input: ReservaDto,
  ) {
    try {
      const existing = await this.prisma.reserva.findFirst({
        where: { id, habitacion: { sedeId: query.sedeId } },
        include: { habitacion: true, huesped: true },
      });
      if (!existing)
        throw new NotFoundException(`No existe la reserva ${id} en esta sede.`);

      const nextFechaLlegada =
        input.fecha_llegada ?? this.toDateKey(existing.fechaCheckIn);
      const nextFechaSalida =
        input.fecha_salida ?? this.toDateKey(existing.fechaCheckOut);
      this.validateDateRange(nextFechaLlegada, nextFechaSalida);

      const targetHuespedId = input.id_huesped ?? existing.huespedId;
      const targetHabitacionId = input.id_habitacion ?? existing.habitacionId;

      const [huesped, habitacion] = await Promise.all([
        this.prisma.huesped.findUnique({ where: { id: targetHuespedId } }),
        this.prisma.habitacion.findUnique({
          where: { id: targetHabitacionId },
          include: { tipologia: true, sede: true },
        }),
      ]);
      if (!huesped)
        throw new NotFoundException(`No existe el huésped ${targetHuespedId}.`);
      if (!habitacion)
        throw new NotFoundException(
          `No existe la habitación ${targetHabitacionId}.`,
        );
      if (
        huesped.sedeId !== habitacion.sedeId ||
        habitacion.sedeId !== query.sedeId
      ) {
        throw new BadRequestException(
          'El huésped y la habitación deben pertenecer a la sede activa.',
        );
      }

      if (
        targetHabitacionId !== existing.habitacionId ||
        input.fecha_llegada !== undefined ||
        input.fecha_salida !== undefined ||
        input.estado_reserva !== undefined
      ) {
        this.validateRoomAllowed(habitacion);
      }
      if (
        input.cantidad_personas !== undefined ||
        targetHabitacionId !== existing.habitacionId
      ) {
        this.validateCapacity(
          habitacion,
          input.cantidad_personas ?? existing.cantidadPersonas,
        );
      }

      const nextState =
        input.estado_reserva !== undefined
          ? this.toDatabaseState(input.estado_reserva)
          : existing.estado;
      this.validateStateTransition(existing.estado, nextState);

      if (
        nextState !== EstadoReserva.CANCELADA &&
        nextState !== EstadoReserva.FINALIZADA
      ) {
        await this.assertNoOverlap(
          targetHabitacionId,
          nextFechaLlegada,
          nextFechaSalida,
          nextState,
          id,
        );
      }

      let createdPaymentId: number | null = null;
      let didCheckout = false;
      let didCancel = false;

      const reservation = await this.prisma.$transaction(
        async (transaction) => {
          const previous = await transaction.reserva.findUnique({
            where: { id },
          });
          if (!previous)
            throw new NotFoundException(`No existe la reserva ${id}.`);

          if (
            nextState !== EstadoReserva.CANCELADA &&
            nextState !== EstadoReserva.FINALIZADA
          ) {
            await this.assertNoOverlapInTransaction(
              transaction,
              targetHabitacionId,
              nextFechaLlegada,
              nextFechaSalida,
              nextState,
              id,
            );
          }

          const saved = await transaction.reserva.update({
            where: { id },
            data: this.toDatabase(
              input,
              true,
              habitacion.sede.horaCheckOut ?? undefined,
            ),
          });

          if (
            saved.estado === EstadoReserva.CANCELADA &&
            previous.estado !== EstadoReserva.CANCELADA
          ) {
            didCancel = true;
            await this.releaseRoomOnCancel(transaction, saved.habitacionId);
          }

          createdPaymentId = await this.recordPayment(
            transaction,
            id,
            input,
            previous.montoPagado ?? 0,
          );
          if (
            previous.estado !== EstadoReserva.EN_CURSO &&
            saved.estado === EstadoReserva.EN_CURSO
          ) {
            await this.issueCheckInReceipt(transaction, saved);
          }

          if (
            previous.estado !== EstadoReserva.FINALIZADA &&
            saved.estado === EstadoReserva.FINALIZADA
          ) {
            didCheckout = true;
          }

          return saved;
        },
      );

      if (didCancel) {
        this.eventEmitter.emit('reserva.cancelada', {
          reservaId: reservation.id,
        });
      }

      if (createdPaymentId) {
        this.eventEmitter.emit('pago.registrado', {
          reservaId: reservation.id,
          pagoId: createdPaymentId,
        });
      }

      if (didCheckout) {
        this.eventEmitter.emit('reserva.checkout', {
          reservaId: reservation.id,
        });
      }

      return this.toFrontend(reservation);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe la reserva ${id} en esta sede.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ReservaSedeQueryDto,
  ) {
    const existing = await this.prisma.reserva.findFirst({
      where: { id, habitacion: { sedeId: query.sedeId } },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(`No existe la reserva ${id} en esta sede.`);
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.pago.deleteMany({ where: { reservaId: id } });
        await transaction.documentoFacturacion.deleteMany({
          where: { reservaId: id },
        });
        await transaction.reserva.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe la reserva ${id} en esta sede.`);
      }
      throw error;
    }
  }

  @Get(':id/pagos')
  async listPayments(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ReservaSedeQueryDto,
  ) {
    const existing = await this.prisma.reserva.findFirst({
      where: { id, habitacion: { sedeId: query.sedeId } },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(`No existe la reserva ${id} en esta sede.`);
    return this.prisma.pago.findMany({
      where: { reservaId: id },
      orderBy: { fechaPago: 'asc' },
    });
  }

  private validateDateRange(arrivalDate: string, departureDate: string): void {
    if (arrivalDate >= departureDate) {
      throw new BadRequestException(
        'La fecha de salida debe ser posterior a la fecha de llegada.',
      );
    }
  }

  private validateCapacity(
    habitacion: {
      cantidadPersonas: number;
      tipologia?: { capacidadMax: number } | null;
    },
    cantidadPersonas?: number | null,
  ): void {
    const requested = cantidadPersonas ?? 1;
    const capacity = Math.min(
      habitacion.cantidadPersonas || Number.POSITIVE_INFINITY,
      habitacion.tipologia?.capacidadMax ?? Number.POSITIVE_INFINITY,
    );
    if (requested > capacity) {
      throw new BadRequestException(
        `La cantidad de personas (${requested}) supera la capacidad de la habitación (${capacity}).`,
      );
    }
  }

  private validateRoomAllowed(habitacion: {
    estado: EstadoHabitacion;
    numero: string;
  }): void {
    if (habitacion.estado === EstadoHabitacion.MANTENIMIENTO) {
      throw new ConflictException(
        `La habitación ${habitacion.numero} está en mantenimiento y no puede reservarse.`,
      );
    }
  }

  private validateStateTransition(
    current: EstadoReserva,
    next: EstadoReserva,
  ): void {
    const allowed: Record<EstadoReserva, EstadoReserva[]> = {
      [EstadoReserva.CONFIRMADA]: [
        EstadoReserva.CONFIRMADA,
        EstadoReserva.EN_CURSO,
        EstadoReserva.CANCELADA,
      ],
      [EstadoReserva.EN_CURSO]: [
        EstadoReserva.EN_CURSO,
        EstadoReserva.FINALIZADA,
        EstadoReserva.CANCELADA,
      ],
      [EstadoReserva.FINALIZADA]: [EstadoReserva.FINALIZADA],
      [EstadoReserva.CANCELADA]: [EstadoReserva.CANCELADA],
    };
    if (!allowed[current].includes(next)) {
      throw new BadRequestException(
        `La reserva no puede pasar de ${current} a ${next}.`,
      );
    }
  }

  private async assertNoOverlap(
    habitacionId: number,
    arrivalDate: string,
    departureDate: string,
    nextState: EstadoReserva,
    excludeReservationId?: number,
  ): Promise<void> {
    await this.assertNoOverlapWithClient(
      this.prisma,
      habitacionId,
      arrivalDate,
      departureDate,
      nextState,
      excludeReservationId,
    );
  }

  private async assertNoOverlapInTransaction(
    transaction: Transaction,
    habitacionId: number,
    arrivalDate: string,
    departureDate: string,
    nextState: EstadoReserva,
    excludeReservationId?: number,
  ): Promise<void> {
    await this.assertNoOverlapWithClient(
      transaction,
      habitacionId,
      arrivalDate,
      departureDate,
      nextState,
      excludeReservationId,
    );
  }

  private async assertNoOverlapWithClient(
    client: PrismaService | Transaction,
    habitacionId: number,
    arrivalDate: string,
    departureDate: string,
    nextState: EstadoReserva,
    excludeReservationId?: number,
  ): Promise<void> {
    if (!ACTIVE_STATES.includes(nextState)) return;

    const overlapping = await client.reserva.findFirst({
      where: {
        habitacionId,
        estado: { in: ACTIVE_STATES },
        ...(excludeReservationId !== undefined
          ? { id: { not: excludeReservationId } }
          : {}),
        fechaCheckIn: { lt: new Date(`${departureDate}T00:00:00`) },
        fechaCheckOut: { gt: new Date(`${arrivalDate}T00:00:00`) },
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new ConflictException(
        'La habitación ya tiene una reserva activa que se solapa con estas fechas.',
      );
    }
  }

  private async releaseRoomOnCancel(
    transaction: Transaction,
    habitacionId: number,
  ): Promise<void> {
    await transaction.habitacion.updateMany({
      where: {
        id: habitacionId,
        estado: { in: [EstadoHabitacion.RESERVADA, EstadoHabitacion.OCUPADA] },
      },
      data: { estado: EstadoHabitacion.DISPONIBLE, huespedActual: null },
    });
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toDatabaseState(
    estado?: ReservaDto['estado_reserva'],
  ): EstadoReserva {
    switch (estado) {
      case 'HOSPEDADO':
      case 'CHECK-IN HOY':
      case 'CHECK-OUT HOY':
        return EstadoReserva.EN_CURSO;
      case 'FINALIZADA':
        return EstadoReserva.FINALIZADA;
      case 'CANCELADA':
        return EstadoReserva.CANCELADA;
      default:
        return EstadoReserva.CONFIRMADA;
    }
  }

  private async recordPayment(
    transaction: Prisma.TransactionClient,
    reservationId: number,
    input: ReservaDto,
    previousAmount: number,
  ): Promise<number | null> {
    const newAmount = input.monto_pagado;
    const metodoPago =
      input.metodo_pago === 'transferencia'
        ? MetodoPago.TRANSFERENCIA
        : input.metodo_pago === 'efectivo'
          ? MetodoPago.EFECTIVO
          : undefined;
    const amount = (newAmount ?? previousAmount) - previousAmount;
    if (!metodoPago || amount <= 0) return null;

    const pago = await transaction.pago.create({
      data: {
        reservaId: reservationId,
        monto: amount,
        metodoPago,
        tipoOperacion: input.pago_completo
          ? TipoOperacion.PAGO_FINAL
          : TipoOperacion.ABONO,
      },
    });

    const referencia = `PAY-${String(pago.id).padStart(6, '0')}`;
    await transaction.pago.update({
      where: { id: pago.id },
      data: { referencia },
    });

    return pago.id;
  }

  private async issueCheckInReceipt(
    transaction: Prisma.TransactionClient,
    reservation: { id: number; precioTotal: number | null },
  ): Promise<void> {
    const existing = await transaction.documentoFacturacion.findFirst({
      where: { reservaId: reservation.id, tipoDocumento: TipoDocumento.BOLETA },
    });
    if (existing) return;
    const montoTotal = reservation.precioTotal ?? 0;
    const montoNeto = Math.round(montoTotal / 1.19);
    await transaction.documentoFacturacion.create({
      data: {
        reservaId: reservation.id,
        tipoDocumento: TipoDocumento.BOLETA,
        montoNeto,
        montoIva: montoTotal - montoNeto,
        montoTotal,
        fechaEmision: new Date(),
      },
    });
  }

  private toDatabase(
    input: ReservaDto,
    partial = false,
    defaultCheckoutTime?: string,
  ): Prisma.ReservaUncheckedCreateInput | Prisma.ReservaUncheckedUpdateInput {
    const state =
      input.estado_reserva !== undefined
        ? this.toDatabaseState(input.estado_reserva)
        : partial
          ? undefined
          : EstadoReserva.CONFIRMADA;
    const paymentMethod =
      input.metodo_pago === 'transferencia'
        ? MetodoPago.TRANSFERENCIA
        : input.metodo_pago === 'efectivo'
          ? MetodoPago.EFECTIVO
          : undefined;
    const defaultHoraSalida =
      defaultCheckoutTime && TIME_PATTERN.test(defaultCheckoutTime)
        ? defaultCheckoutTime
        : undefined;
    return {
      ...(input.id_huesped !== undefined
        ? { huespedId: input.id_huesped }
        : {}),
      ...(input.id_habitacion !== undefined
        ? { habitacionId: input.id_habitacion }
        : {}),
      ...(input.fecha_llegada !== undefined
        ? { fechaCheckIn: new Date(`${input.fecha_llegada}T00:00:00`) }
        : {}),
      ...(input.fecha_salida !== undefined
        ? { fechaCheckOut: new Date(`${input.fecha_salida}T00:00:00`) }
        : {}),
      ...(input.hora_llegada !== undefined
        ? { horaLlegada: input.hora_llegada }
        : {}),
      ...(input.hora_salida !== undefined
        ? { horaSalida: input.hora_salida }
        : partial
          ? {}
          : defaultHoraSalida
            ? { horaSalida: defaultHoraSalida }
            : {}),
      ...(input.cantidad_personas !== undefined
        ? { cantidadPersonas: input.cantidad_personas }
        : {}),
      ...(state !== undefined ? { estado: state } : {}),
      ...(input.precio_total !== undefined
        ? { precioTotal: input.precio_total }
        : {}),
      ...(input.porcentaje_abono !== undefined
        ? { porcentajeAbono: input.porcentaje_abono }
        : {}),
      ...(input.monto_pagado !== undefined
        ? { montoPagado: input.monto_pagado }
        : {}),
      ...(paymentMethod !== undefined ? { metodoPago: paymentMethod } : {}),
      ...(input.pago_completo !== undefined
        ? { pagoCompleto: input.pago_completo }
        : {}),
    };
  }

  private toFrontend(reservation: {
    id: number;
    huespedId: number;
    habitacionId: number;
    fechaCheckIn: Date;
    fechaCheckOut: Date;
    horaLlegada?: string | null;
    horaSalida?: string | null;
    cantidadPersonas?: number;
    precioTotal?: number | null;
    porcentajeAbono?: number | null;
    montoPagado?: number | null;
    metodoPago?: MetodoPago | null;
    pagoCompleto?: boolean;
    estado: EstadoReserva;
  }) {
    const estadoReserva =
      reservation.estado === EstadoReserva.EN_CURSO
        ? 'HOSPEDADO'
        : reservation.estado === EstadoReserva.FINALIZADA
          ? 'FINALIZADA'
          : reservation.estado === EstadoReserva.CANCELADA
            ? 'CANCELADA'
            : 'CONFIRMADA';
    return {
      id_reserva: reservation.id,
      id_huesped: reservation.huespedId,
      id_habitacion: reservation.habitacionId,
      fecha_llegada: this.toDateKey(reservation.fechaCheckIn),
      fecha_salida: this.toDateKey(reservation.fechaCheckOut),
      hora_llegada: reservation.horaLlegada ?? undefined,
      hora_salida: reservation.horaSalida ?? '12:00',
      cantidad_personas: reservation.cantidadPersonas ?? 1,
      estado_reserva: estadoReserva,
      precio_total: reservation.precioTotal ?? undefined,
      porcentaje_abono: reservation.porcentajeAbono ?? undefined,
      monto_pagado: reservation.montoPagado ?? undefined,
      metodo_pago:
        reservation.metodoPago === MetodoPago.TRANSFERENCIA
          ? 'transferencia'
          : reservation.metodoPago === MetodoPago.EFECTIVO
            ? 'efectivo'
            : undefined,
      pago_completo: reservation.pagoCompleto ?? false,
    };
  }
}
