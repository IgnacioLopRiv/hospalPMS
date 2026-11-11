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

/**
 * Días después de la salida de una reserva activa en los que nadie más puede
 * reservar la habitación, para que esa misma reserva pueda extender su estadía.
 * El margen se libera cuando la reserva finaliza o se cancela.
 */
export const CHECKOUT_MARGIN_DAYS = 2;

/** Zona horaria del hostal para decidir qué día es "hoy" (el contenedor puede estar en UTC). */
const HOTEL_TIME_ZONE = process.env.HOTEL_TIMEZONE || 'America/Santiago';

interface AvailabilityCheck {
  habitacionId: number;
  huespedId: number;
  arrivalDate: string;
  departureDate: string;
  nextState: EstadoReserva;
  excludeReservationId?: number;
}

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
    this.validateNotInPast(input.fecha_llegada, 'llegada');
    this.validateNotInPast(input.fecha_salida, 'salida');

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
    this.validateGuestActive(huesped);
    this.validateRoomAllowed(habitacion);
    this.validateCapacity(habitacion, input.cantidad_personas);

    const expectedState = this.toDatabaseState(input.estado_reserva);
    if (expectedState === EstadoReserva.CANCELADA) {
      throw new BadRequestException(
        'No se puede crear una reserva en estado CANCELADA.',
      );
    }
    const availability: AvailabilityCheck = {
      habitacionId: input.id_habitacion,
      huespedId: input.id_huesped,
      arrivalDate: input.fecha_llegada,
      departureDate: input.fecha_salida,
      nextState: expectedState,
    };
    await this.assertAvailability(this.prisma, availability);

    let createdPaymentId: number | null = null;
    const reservation = await this.prisma.$transaction(async (transaction) => {
      await this.assertAvailability(transaction, availability);

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
      if (nextFechaLlegada !== this.toDateKey(existing.fechaCheckIn)) {
        this.validateNotInPast(nextFechaLlegada, 'llegada');
      }
      if (nextFechaSalida !== this.toDateKey(existing.fechaCheckOut)) {
        this.validateNotInPast(nextFechaSalida, 'salida');
      }

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
      if (targetHuespedId !== existing.huespedId) {
        this.validateGuestActive(huesped);
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

      const availability: AvailabilityCheck = {
        habitacionId: targetHabitacionId,
        huespedId: targetHuespedId,
        arrivalDate: nextFechaLlegada,
        departureDate: nextFechaSalida,
        nextState,
        excludeReservationId: id,
      };
      await this.assertAvailability(this.prisma, availability);

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

          await this.assertAvailability(transaction, availability);

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

  /**
   * La capacidad la define la tipología (es lo que se configura en el front);
   * habitacion.cantidadPersonas solo se usa si la habitación no tiene tipología.
   */
  private validateCapacity(
    habitacion: {
      cantidadPersonas: number;
      tipologia?: { capacidadMax: number } | null;
    },
    cantidadPersonas?: number | null,
  ): void {
    const requested = cantidadPersonas ?? 1;
    const capacity =
      habitacion.tipologia?.capacidadMax ??
      (habitacion.cantidadPersonas || Number.POSITIVE_INFINITY);
    if (requested > capacity) {
      throw new BadRequestException(
        `La cantidad de personas (${requested}) supera la capacidad de la habitación (${capacity}).`,
      );
    }
  }

  private validateRoomAllowed(habitacion: {
    estado: EstadoHabitacion;
    numero: string;
    activa: boolean;
  }): void {
    if (!habitacion.activa) {
      throw new ConflictException(
        `La habitación ${habitacion.numero} fue eliminada y no puede reservarse.`,
      );
    }
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

  /** Las fechas no pueden ser anteriores al día en que se crea/edita la reserva. */
  private validateNotInPast(date: string, label: 'llegada' | 'salida'): void {
    const today = this.todayKey();
    if (date < today) {
      throw new BadRequestException(
        `La fecha de ${label} (${date}) no puede ser anterior a hoy (${today}).`,
      );
    }
  }

  private validateGuestActive(huesped: { eliminadoEn: Date | null }): void {
    if (huesped.eliminadoEn) {
      throw new BadRequestException(
        'El huésped fue eliminado y no puede recibir reservas.',
      );
    }
  }

  /**
   * Valida, para una reserva activa:
   * - que el huésped no tenga otra reserva activa en las mismas fechas;
   * - que la habitación no tenga otra reserva activa que se solape, incluyendo
   *   el margen de CHECKOUT_MARGIN_DAYS después de la salida de cada reserva.
   */
  private async assertAvailability(
    client: PrismaService | Transaction,
    check: AvailabilityCheck,
  ): Promise<void> {
    if (!ACTIVE_STATES.includes(check.nextState)) return;

    const arrival = this.fromDateKey(check.arrivalDate);
    const departure = this.fromDateKey(check.departureDate);
    const excludeSelf =
      check.excludeReservationId !== undefined
        ? { id: { not: check.excludeReservationId } }
        : {};

    const guestOverlap = await client.reserva.findFirst({
      where: {
        huespedId: check.huespedId,
        estado: { in: ACTIVE_STATES },
        ...excludeSelf,
        fechaCheckIn: { lt: departure },
        fechaCheckOut: { gt: arrival },
      },
      select: { codigo: true, fechaCheckIn: true, fechaCheckOut: true },
    });
    if (guestOverlap) {
      throw new ConflictException(
        `El huésped ya tiene una reserva activa${guestOverlap.codigo ? ` (${guestOverlap.codigo})` : ''} ` +
          `del ${this.toDateKey(guestOverlap.fechaCheckIn)} al ${this.toDateKey(guestOverlap.fechaCheckOut)} que coincide con estas fechas.`,
      );
    }

    // Con margen: [llegada, salida + margen) de ambas reservas no debe cruzarse.
    const roomConflict = await client.reserva.findFirst({
      where: {
        habitacionId: check.habitacionId,
        estado: { in: ACTIVE_STATES },
        ...excludeSelf,
        fechaCheckIn: {
          lt: this.addDays(departure, CHECKOUT_MARGIN_DAYS),
        },
        fechaCheckOut: {
          gt: this.addDays(arrival, -CHECKOUT_MARGIN_DAYS),
        },
      },
      orderBy: { fechaCheckIn: 'asc' },
      select: { codigo: true, fechaCheckIn: true, fechaCheckOut: true },
    });
    if (!roomConflict) return;

    const range = `${this.toDateKey(roomConflict.fechaCheckIn)} al ${this.toDateKey(roomConflict.fechaCheckOut)}`;
    const code = roomConflict.codigo ? ` (${roomConflict.codigo})` : '';
    const strictOverlap =
      roomConflict.fechaCheckIn < departure &&
      roomConflict.fechaCheckOut > arrival;
    if (strictOverlap) {
      throw new ConflictException(
        `La habitación ya tiene una reserva activa${code} del ${range} que se solapa con estas fechas.`,
      );
    }
    throw new ConflictException(
      `La habitación tiene una reserva activa${code} del ${range}. ` +
        `Se deben dejar ${CHECKOUT_MARGIN_DAYS} días libres después de cada salida para permitir extensiones de estadía.`,
    );
  }

  /**
   * Las fechas de estadía se guardan a medianoche UTC para que no dependan de la
   * zona horaria del servidor (toDateKey las lee con toISOString).
   */
  private fromDateKey(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00Z`);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  /** Fecha de hoy (YYYY-MM-DD) en la hora del hostal, aunque el servidor esté en UTC. */
  private todayKey(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: HOTEL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
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
    const metodoPago = this.toMetodoPago(input.metodo_pago);
    const amount = (newAmount ?? previousAmount) - previousAmount;
    if (!metodoPago || amount <= 0) return null;
    if (
      metodoPago === MetodoPago.TARJETA_DEBITO ||
      metodoPago === MetodoPago.TARJETA_CREDITO
    ) {
      // El pago con tarjeta lo registra el cobro POS cuando el terminal lo aprueba.
      throw new BadRequestException(
        'Los pagos con tarjeta se cobran y registran desde el terminal POS.',
      );
    }

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

  private toMetodoPago(
    value: ReservaDto['metodo_pago'],
  ): MetodoPago | undefined {
    switch (value) {
      case 'transferencia':
        return MetodoPago.TRANSFERENCIA;
      case 'efectivo':
        return MetodoPago.EFECTIVO;
      case 'debito':
        return MetodoPago.TARJETA_DEBITO;
      case 'credito':
        return MetodoPago.TARJETA_CREDITO;
      default:
        return undefined;
    }
  }

  private fromMetodoPago(
    value?: MetodoPago | null,
  ): ReservaDto['metodo_pago'] | undefined {
    switch (value) {
      case MetodoPago.TRANSFERENCIA:
        return 'transferencia';
      case MetodoPago.EFECTIVO:
        return 'efectivo';
      case MetodoPago.TARJETA_DEBITO:
        return 'debito';
      case MetodoPago.TARJETA_CREDITO:
        return 'credito';
      default:
        return undefined;
    }
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
    const paymentMethod = this.toMetodoPago(input.metodo_pago);
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
        ? { fechaCheckIn: this.fromDateKey(input.fecha_llegada) }
        : {}),
      ...(input.fecha_salida !== undefined
        ? { fechaCheckOut: this.fromDateKey(input.fecha_salida) }
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
      metodo_pago: this.fromMetodoPago(reservation.metodoPago),
      pago_completo: reservation.pagoCompleto ?? false,
    };
  }
}
