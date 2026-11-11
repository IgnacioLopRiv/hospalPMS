import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EstadoReserva,
  MetodoPago,
  Pago,
  Prisma,
  Reserva,
  TipoOperacion,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export const METODOS_PAGO: MetodoPago[] = [
  'TRANSFERENCIA',
  'EFECTIVO',
  'TARJETA_CREDITO',
  'TARJETA_DEBITO',
];
export const TIPOS_OPERACION: TipoOperacion[] = [
  'ABONO',
  'PAGO_FINAL',
  'PAGO_SERVICIO_ADICIONAL',
  'REEMBOLSO',
];

const TERMINAL_STATES: EstadoReserva[] = [
  EstadoReserva.FINALIZADA,
  EstadoReserva.CANCELADA,
];

export interface NuevoPago {
  reservaId: number;
  monto: number;
  metodoPago: MetodoPago;
  tipoOperacion: TipoOperacion;
}

/**
 * Reglas de registro de pagos compartidas por el registro manual
 * (PagosController) y los cobros por terminal POS.
 */
@Injectable()
export class PagoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Registra el pago en su propia transacción y emite `pago.registrado`. */
  async registrar(input: NuevoPago): Promise<Pago> {
    let pago: Pago;
    try {
      pago = await this.prisma.$transaction((trx) =>
        this.registrarEn(trx, input),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('La reserva especificada no existe.');
      }
      throw error;
    }
    this.notificar(pago);
    return pago;
  }

  /**
   * Valida y registra el pago dentro de una transacción existente.
   * Quien llama debe invocar `notificar` tras el commit.
   */
  async registrarEn(
    trx: Prisma.TransactionClient,
    input: NuevoPago,
  ): Promise<Pago> {
    const { reservation, cumulative } = await this.validarEn(trx, input);
    const isRefund = input.tipoOperacion === TipoOperacion.REEMBOLSO;

    const created = await trx.pago.create({
      data: {
        reservaId: input.reservaId,
        monto: input.monto,
        metodoPago: input.metodoPago,
        tipoOperacion: input.tipoOperacion,
      },
    });

    const referencia = `PAY-${String(created.id).padStart(6, '0')}`;
    const withReference = await trx.pago.update({
      where: { id: created.id },
      data: { referencia },
    });

    const nextCumulative = isRefund
      ? cumulative - input.monto
      : cumulative + input.monto;
    const total = reservation.precioTotal ?? nextCumulative;
    await trx.reserva.update({
      where: { id: input.reservaId },
      data: {
        montoPagado: nextCumulative,
        metodoPago: input.metodoPago,
        pagoCompleto: nextCumulative >= total,
      },
    });

    return withReference;
  }

  /** Verifica que el pago sea admisible sin escribir nada. */
  async validarEn(
    trx: Prisma.TransactionClient,
    input: NuevoPago,
  ): Promise<{ reservation: Reserva; cumulative: number }> {
    if (!Number.isInteger(input.monto) || input.monto < 0) {
      throw new BadRequestException(
        'El monto debe ser un número entero mayor o igual que cero.',
      );
    }

    const reservation = await trx.reserva.findUnique({
      where: { id: input.reservaId },
    });
    if (!reservation) {
      throw new BadRequestException('La reserva especificada no existe.');
    }
    if (TERMINAL_STATES.includes(reservation.estado)) {
      throw new BadRequestException(
        `No se pueden registrar pagos en una reserva ${reservation.estado}.`,
      );
    }

    const isRefund = input.tipoOperacion === TipoOperacion.REEMBOLSO;
    const existingPayments = await trx.pago.findMany({
      where: { reservaId: input.reservaId },
      select: { monto: true, tipoOperacion: true },
    });
    const cumulative = existingPayments.reduce(
      (total, payment) =>
        total +
        (payment.tipoOperacion === TipoOperacion.REEMBOLSO
          ? -payment.monto
          : payment.monto),
      0,
    );
    const precioTotal = reservation.precioTotal;

    if (
      !isRefund &&
      input.tipoOperacion === TipoOperacion.PAGO_FINAL &&
      precioTotal !== null &&
      cumulative + input.monto !== precioTotal
    ) {
      throw new BadRequestException(
        'El pago final debe completar exactamente el precio total de la reserva.',
      );
    }

    if (
      !isRefund &&
      precioTotal !== null &&
      cumulative + input.monto > precioTotal
    ) {
      throw new BadRequestException(
        'El pago supera el precio total de la reserva.',
      );
    }

    if (isRefund && cumulative - input.monto < 0) {
      throw new BadRequestException(
        'El reembolso supera el monto pagado de la reserva.',
      );
    }

    return { reservation, cumulative };
  }

  notificar(pago: Pago): void {
    if (pago.tipoOperacion !== TipoOperacion.REEMBOLSO) {
      this.eventEmitter.emit('pago.registrado', {
        reservaId: pago.reservaId,
        pagoId: pago.id,
      });
    }
  }
}
