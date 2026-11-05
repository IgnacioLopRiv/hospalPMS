import {
  BadRequestException,
  Body,
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
import { EstadoSii, Prisma, TipoDocumento } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

const TIPOS_DOC: TipoDocumento[] = ['BOLETA', 'FACTURA', 'NOTA_CREDITO'];
const ESTADOS_SII: EstadoSii[] = [
  'PENDIENTE',
  'ENVIADO',
  'ACEPTADO',
  'RECHAZADO',
];

interface DocumentoInput {
  reservaId?: number;
  tipoDocumento?: string;
  folioSii?: number | null;
  montoNeto?: number;
  montoIva?: number;
  montoTotal?: number;
  fechaEmision?: string;
  estadoSii?: string;
}

/**
 * Controller REST para DocumentoFacturacion (boletas, facturas, notas de crédito).
 *
 * Rutas:
 *   GET    /documentos              → listar (opcional ?reservaId=)
 *   GET    /documentos/:id          → obtener uno
 *   POST   /documentos              → emitir documento
 *   PATCH  /documentos/:id          → actualizar estado SII
 *   DELETE /documentos/:id          → eliminar
 */
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('reservaId') reservaId?: string) {
    return this.prisma.documentoFacturacion.findMany({
      where: reservaId ? { reservaId: Number(reservaId) } : undefined,
      orderBy: { fechaEmision: 'desc' },
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const doc = await this.prisma.documentoFacturacion.findUnique({
      where: { id },
    });
    if (!doc) throw new NotFoundException(`No existe el documento ${id}.`);
    return doc;
  }

  @Post()
  async create(@Body() input: DocumentoInput) {
    if (
      !input.reservaId ||
      !input.tipoDocumento ||
      input.montoNeto == null ||
      input.montoIva == null ||
      input.montoTotal == null ||
      !input.fechaEmision
    ) {
      throw new BadRequestException(
        'Faltan campos obligatorios: reservaId, tipoDocumento, montoNeto, montoIva, montoTotal, fechaEmision.',
      );
    }
    if (!TIPOS_DOC.includes(input.tipoDocumento as TipoDocumento)) {
      throw new BadRequestException(
        `tipoDocumento inválido. Opciones: ${TIPOS_DOC.join(', ')}.`,
      );
    }
    if (
      [input.montoNeto, input.montoIva, input.montoTotal].some(
        (value) => !Number.isInteger(value) || value < 0,
      )
    ) {
      throw new BadRequestException(
        'Los montos del documento deben ser enteros no negativos.',
      );
    }
    if (input.montoNeto + input.montoIva !== input.montoTotal) {
      throw new BadRequestException(
        'El monto total debe ser igual a la suma del neto y el IVA.',
      );
    }
    const fechaEmision = new Date(input.fechaEmision);
    if (Number.isNaN(fechaEmision.getTime())) {
      throw new BadRequestException('La fecha de emisión no es válida.');
    }

    try {
      const reservation = await this.prisma.reserva.findUnique({
        where: { id: input.reservaId },
        select: { id: true, precioTotal: true },
      });
      if (!reservation) {
        throw new BadRequestException('La reserva especificada no existe.');
      }
      if (
        reservation.precioTotal !== null &&
        reservation.precioTotal !== undefined &&
        input.montoTotal > reservation.precioTotal
      ) {
        throw new BadRequestException(
          'El monto del documento supera el precio total de la reserva.',
        );
      }

      return await this.prisma.documentoFacturacion.create({
        data: {
          reservaId: input.reservaId,
          tipoDocumento: input.tipoDocumento as TipoDocumento,
          folioSii: input.folioSii ?? null,
          montoNeto: input.montoNeto,
          montoIva: input.montoIva,
          montoTotal: input.montoTotal,
          fechaEmision,
          estadoSii: 'PENDIENTE',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Ya existe un documento con ese tipo y folio SII.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('La reserva especificada no existe.');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: { estadoSii?: string; folioSii?: number | null },
  ) {
    if (
      input.estadoSii &&
      !ESTADOS_SII.includes(input.estadoSii as EstadoSii)
    ) {
      throw new BadRequestException(
        `estadoSii inválido. Opciones: ${ESTADOS_SII.join(', ')}.`,
      );
    }
    if (
      input.folioSii !== undefined &&
      input.folioSii !== null &&
      (!Number.isInteger(input.folioSii) || input.folioSii < 1)
    ) {
      throw new BadRequestException(
        'El folio SII debe ser un número entero positivo.',
      );
    }
    const data = {
      ...(input.estadoSii !== undefined
        ? { estadoSii: input.estadoSii as EstadoSii }
        : {}),
      ...(input.folioSii !== undefined ? { folioSii: input.folioSii } : {}),
    };
    try {
      return await this.prisma.documentoFacturacion.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Ya existe un documento con ese tipo y folio SII.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el documento ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.documentoFacturacion.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el documento ${id}.`);
      }
      throw error;
    }
  }
}
