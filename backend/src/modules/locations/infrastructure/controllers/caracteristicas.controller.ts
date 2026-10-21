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
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

interface CaracteristicaInput {
  nombre?: string;
  icono?: string | null;
  activo?: boolean;
}

/**
 * Controller REST para Caracteristica (amenidades/features de tipologías).
 *
 * Rutas:
 *   GET    /caracteristicas        → listar todas
 *   POST   /caracteristicas        → crear
 *   PATCH  /caracteristicas/:id    → actualizar
 *   DELETE /caracteristicas/:id    → eliminar
 *
 * Ruta para gestionar la relación tipología↔característica:
 *   POST   /caracteristicas/tipologia/:tipologiaId/:caracteristicaId  → asignar
 *   DELETE /caracteristicas/tipologia/:tipologiaId/:caracteristicaId  → desasignar
 */
@Controller('caracteristicas')
export class CaracteristicasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    return this.prisma.caracteristica.findMany({ orderBy: { nombre: 'asc' } });
  }

  @Post()
  async create(@Body() input: CaracteristicaInput) {
    if (!input.nombre?.trim()) {
      throw new BadRequestException('El campo nombre es obligatorio.');
    }
    return this.prisma.caracteristica.create({
      data: {
        nombre: input.nombre.trim(),
        icono: input.icono?.trim() ?? null,
        activo: input.activo ?? true,
      },
    });
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: CaracteristicaInput) {
    const data = {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.icono !== undefined ? { icono: input.icono?.trim() ?? null } : {}),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
    };
    try {
      return await this.prisma.caracteristica.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la característica ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tipologiaCaracteristica.deleteMany({ where: { caracteristicaId: id } });
        await tx.caracteristica.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la característica ${id}.`);
      }
      throw error;
    }
  }

  /** Asignar una característica a una tipología */
  @Post('tipologia/:tipologiaId/:caracteristicaId')
  async assign(
    @Param('tipologiaId', ParseIntPipe) tipologiaId: number,
    @Param('caracteristicaId', ParseIntPipe) caracteristicaId: number,
  ) {
    try {
      await this.prisma.tipologiaCaracteristica.create({ data: { tipologiaId, caracteristicaId } });
      return { assigned: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('La característica ya está asignada a esta tipología.');
      }
      throw error;
    }
  }

  /** Desasignar una característica de una tipología */
  @Delete('tipologia/:tipologiaId/:caracteristicaId')
  async unassign(
    @Param('tipologiaId', ParseIntPipe) tipologiaId: number,
    @Param('caracteristicaId', ParseIntPipe) caracteristicaId: number,
  ) {
    try {
      await this.prisma.tipologiaCaracteristica.delete({
        where: { tipologiaId_caracteristicaId: { tipologiaId, caracteristicaId } },
      });
      return { unassigned: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('La relación tipología-característica no existe.');
      }
      throw error;
    }
  }
}
