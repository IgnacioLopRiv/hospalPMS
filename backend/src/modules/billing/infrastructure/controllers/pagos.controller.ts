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
import { MetodoPago, Prisma, TipoOperacion } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import {
  METODOS_PAGO,
  PagoService,
  TIPOS_OPERACION,
} from '../../application/pago.service';

interface PagoInput {
  reservaId?: number;
  monto?: number;
  metodoPago?: string;
  tipoOperacion?: string;
}

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagoService: PagoService,
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

    return this.pagoService.registrar({
      reservaId: input.reservaId,
      monto: input.monto,
      metodoPago: input.metodoPago as MetodoPago,
      tipoOperacion: input.tipoOperacion as TipoOperacion,
    });
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
