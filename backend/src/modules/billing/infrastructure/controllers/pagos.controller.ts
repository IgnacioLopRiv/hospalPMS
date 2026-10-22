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

const METODOS_PAGO: MetodoPago[] = ['TRANSFERENCIA', 'EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO'];
const TIPOS_OPERACION: TipoOperacion[] = ['ABONO', 'PAGO_FINAL', 'PAGO_SERVICIO_ADICIONAL', 'REEMBOLSO'];

interface PagoInput {
  reservaId?: number;
  monto?: number;
  metodoPago?: string;
  tipoOperacion?: string;
}

/**
 * Controller REST para Pago.
 *
 * Rutas:
 *   GET    /pagos              → listar (opcional ?reservaId=)
 *   GET    /pagos/:id          → obtener uno
 *   POST   /pagos              → registrar pago
 *   DELETE /pagos/:id          → eliminar pago (anulación)
 */
@Controller('pagos')
export class PagosController {
  constructor(private readonly prisma: PrismaService) {}

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
    if (!input.reservaId || input.monto == null || !input.metodoPago || !input.tipoOperacion) {
      throw new BadRequestException('Faltan campos obligatorios: reservaId, monto, metodoPago, tipoOperacion.');
    }
    if (!METODOS_PAGO.includes(input.metodoPago as MetodoPago)) {
      throw new BadRequestException(`metodoPago inválido. Opciones: ${METODOS_PAGO.join(', ')}.`);
    }
    if (!TIPOS_OPERACION.includes(input.tipoOperacion as TipoOperacion)) {
      throw new BadRequestException(`tipoOperacion inválido. Opciones: ${TIPOS_OPERACION.join(', ')}.`);
    }
    try {
      return await this.prisma.pago.create({
        data: {
          reservaId: input.reservaId,
          monto: input.monto,
          metodoPago: input.metodoPago as MetodoPago,
          tipoOperacion: input.tipoOperacion as TipoOperacion,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('La reserva especificada no existe.');
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.pago.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe el pago ${id}.`);
      }
      throw error;
    }
  }
}
