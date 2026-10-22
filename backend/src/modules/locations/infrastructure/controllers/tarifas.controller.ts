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
import { Prisma, TipoTemporada } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

interface TarifaInput {
  tipologiaId?: number;
  nombre?: string;
  precioBase?: number;
  fechaInicio?: string;
  fechaFin?: string;
  tipoTemporada?: string;
  activa?: boolean;
}

/**
 * Controller REST para Tarifa (precios por tipología y temporada).
 *
 * Rutas:
 *   GET    /tarifas                → listar (opcional ?tipologiaId=)
 *   GET    /tarifas/:id            → obtener una
 *   POST   /tarifas                → crear
 *   PATCH  /tarifas/:id            → actualizar
 *   DELETE /tarifas/:id            → eliminar
 */
@Controller('tarifas')
export class TarifasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('tipologiaId') tipologiaId?: string) {
    return this.prisma.tarifa.findMany({
      where: tipologiaId ? { tipologiaId: Number(tipologiaId) } : undefined,
      orderBy: [{ fechaInicio: 'asc' }],
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const tarifa = await this.prisma.tarifa.findUnique({ where: { id } });
    if (!tarifa) throw new NotFoundException(`No existe la tarifa ${id}.`);
    return tarifa;
  }

  @Post()
  async create(@Body() input: TarifaInput) {
    if (!input.tipologiaId || !input.nombre || input.precioBase == null || !input.fechaInicio || !input.fechaFin || !input.tipoTemporada) {
      throw new BadRequestException('Faltan campos obligatorios: tipologiaId, nombre, precioBase, fechaInicio, fechaFin, tipoTemporada.');
    }
    if (!['ALTA', 'BAJA'].includes(input.tipoTemporada)) {
      throw new BadRequestException('tipoTemporada debe ser ALTA o BAJA.');
    }
    const inicio = new Date(input.fechaInicio);
    const fin = new Date(input.fechaFin);
    if (inicio >= fin) {
      throw new BadRequestException('fechaInicio debe ser anterior a fechaFin.');
    }
    try {
      return await this.prisma.tarifa.create({
        data: {
          tipologiaId: input.tipologiaId,
          nombre: input.nombre.trim(),
          precioBase: input.precioBase,
          fechaInicio: inicio,
          fechaFin: fin,
          tipoTemporada: input.tipoTemporada as TipoTemporada,
          activa: input.activa ?? true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('La tipología especificada no existe.');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: TarifaInput) {
    if (input.tipoTemporada && !['ALTA', 'BAJA'].includes(input.tipoTemporada)) {
      throw new BadRequestException('tipoTemporada debe ser ALTA o BAJA.');
    }
    const data = {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.precioBase !== undefined ? { precioBase: input.precioBase } : {}),
      ...(input.fechaInicio !== undefined ? { fechaInicio: new Date(input.fechaInicio) } : {}),
      ...(input.fechaFin !== undefined ? { fechaFin: new Date(input.fechaFin) } : {}),
      ...(input.tipoTemporada !== undefined ? { tipoTemporada: input.tipoTemporada as TipoTemporada } : {}),
      ...(input.activa !== undefined ? { activa: input.activa } : {}),
    };
    try {
      return await this.prisma.tarifa.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la tarifa ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.tarifa.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la tarifa ${id}.`);
      }
      throw error;
    }
  }
}
