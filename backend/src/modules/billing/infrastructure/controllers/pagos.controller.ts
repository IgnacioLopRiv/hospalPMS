import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EstadoReserva,
  MetodoPago,
  Prisma,
  TipoOperacion,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

const METODOS_PAGO: MetodoPago[] = [
  'TRANSFERENCIA',
  'EFECTIVO',
  'TARJETA_CREDITO',
  'TARJETA_DEBITO',
];
const TIPOS_OPERACION: TipoOperacion[] = [
  'ABONO',
  'PAGO_FINAL',
  'PAGO_SERVICIO_ADICIONAL',
  'REEMBOLSO',
];

interface PagoInput {
  reservaId?: number;
  monto?: number;
  metodoPago?: string;
  tipoOperacion?: string;
}

const TERMINAL_STATES: EstadoReserva[] = [
  EstadoReserva.FINALIZADA,
  EstadoReserva.CANCELADA,
];

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async findAll(@Query('reservaId') reservaId?: string) {
    return this.prisma.pago.findMany({
      where: reservaId ? { reservaId: Number(reservaId) } : undefined,
      orderBy: { fechaPago: 'desc' },
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const pago = await this.prisma.pago.findUnique({ where: { id } });
    if (!pago) throw new NotFoundException(`No existe el pago ${id}.`);
    return pago;
  }

  @Post()
  async create(@Body() input: PagoInput) {
    if (
      !input.reservaId ||
      input.monto == null ||
      !input.metodoPago ||
      !input.tipoOperacion
    ) {
      throw new BadRequestException(
        'Faltan campos obligatorios: reservaId, monto, metodoPago, tipoOperacion.',
      );
    }
    if (!Number.isInteger(input.monto) || input.monto < 0) {
      throw new BadRequestException(
        'El monto debe ser un número entero mayor o igual que cero.',
      );
    }
    if (!METODOS_PAGO.includes(input.metodoPago as MetodoPago)) {
      throw new BadRequestException(
        `metodoPago inválido. Opciones: ${METODOS_PAGO.join(', ')}.`,
      );
    }
    if (!TIPOS_OPERACION.includes(input.tipoOperacion as TipoOperacion)) {
      throw new BadRequestException(
        `tipoOperacion inválido. Opciones: ${TIPOS_OPERACION.join(', ')}.`,
      );
    }

    let updated: Prisma.PagoGetPayload<object> | null = null;
    try {
      updated = await this.prisma.$transaction(async (transaction) => {
        const reservation = await transaction.reserva.findUnique({
          where: { id: input.reservaId! },
        });
        if (!reservation) {
          throw new BadRequestException('La reserva especificada no existe.');
        }
        if (TERMINAL_STATES.includes(reservation.estado)) {
          throw new BadRequestException(
            `No se pueden registrar pagos en una reserva ${reservation.estado}.`,
          );
        }

        const isRefund =
          (input.tipoOperacion as TipoOperacion) === TipoOperacion.REEMBOLSO;
        const existingPayments = await transaction.pago.findMany({
          where: { reservaId: input.reservaId! },
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

        if (
          !isRefund &&
          input.tipoOperacion === TipoOperacion.PAGO_FINAL &&
          reservation.precioTotal !== null &&
          reservation.precioTotal !== undefined &&
          cumulative + input.monto! !== reservation.precioTotal
        ) {
          throw new BadRequestException(
            'El pago final debe completar exactamente el precio total de la reserva.',
          );
        }

        if (
          !isRefund &&
          reservation.precioTotal !== null &&
          reservation.precioTotal !== undefined &&
          cumulative + input.monto! > reservation.precioTotal
        ) {
          throw new BadRequestException(
            'El pago supera el precio total de la reserva.',
          );
        }

        if (isRefund && cumulative - input.monto! < 0) {
          throw new BadRequestException(
            'El reembolso supera el monto pagado de la reserva.',
          );
        }

        const created = await transaction.pago.create({
          data: {
            reservaId: input.reservaId!,
            monto: input.monto!,
            metodoPago: input.metodoPago as MetodoPago,
            tipoOperacion: input.tipoOperacion as TipoOperacion,
          },
        });

        const referencia = `PAY-${String(created.id).padStart(6, '0')}`;
        const withReference = await transaction.pago.update({
          where: { id: created.id },
          data: { referencia },
        });

        const nextCumulative = isRefund
          ? cumulative - input.monto!
          : cumulative + input.monto!;
        const total = reservation.precioTotal ?? nextCumulative;
        await transaction.reserva.update({
          where: { id: input.reservaId! },
          data: {
            montoPagado: nextCumulative,
            metodoPago: input.metodoPago as MetodoPago,
            pagoCompleto:
              total !== undefined && total !== null && nextCumulative >= total,
          },
        });

        return withReference;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('La reserva especificada no existe.');
      }
      throw error;
    }

    if (updated && updated.tipoOperacion !== TipoOperacion.REEMBOLSO) {
      this.eventEmitter.emit('pago.registrado', {
        reservaId: updated.reservaId,
        pagoId: updated.id,
      });
    }

    return updated;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const payment = await transaction.pago.findUnique({ where: { id } });
        if (!payment) {
          throw new NotFoundException(`No existe el pago ${id}.`);
        }

        await transaction.pago.delete({ where: { id } });

        const remainingPayments = await transaction.pago.findMany({
          where: { reservaId: payment.reservaId },
          select: { monto: true, tipoOperacion: true, metodoPago: true },
        });
        const cumulative = remainingPayments.reduce(
          (total, item) =>
            total +
            (item.tipoOperacion === TipoOperacion.REEMBOLSO
              ? -item.monto
              : item.monto),
          0,
        );
        const reservation = await transaction.reserva.findUnique({
          where: { id: payment.reservaId },
        });
        if (reservation) {
          const total = reservation.precioTotal ?? cumulative;
          await transaction.reserva.update({
            where: { id: payment.reservaId },
            data: {
              montoPagado: cumulative,
              metodoPago:
                remainingPayments.length > 0
                  ? remainingPayments[remainingPayments.length - 1].metodoPago
                  : null,
              pagoCompleto:
                total !== undefined && total !== null && cumulative >= total,
            },
          });
        }
      });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el pago ${id}.`);
      }
      throw error;
    }
  }
}
