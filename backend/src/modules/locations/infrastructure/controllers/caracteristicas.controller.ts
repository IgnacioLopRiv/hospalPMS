import { Roles } from '../../../auth/auth.decorators';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
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

const NOMBRE_MAX = 60;

/**
 * Controller REST para Caracteristica (amenidades/features de tipologías).
 *
 * Las características predeterminadas vienen del seed y no se pueden editar
 * ni eliminar; las personalizadas las crea el administrador.
 *
 * Rutas:
 *   GET    /caracteristicas        → listar las activas (predeterminadas primero)
 *   POST   /caracteristicas        → crear una personalizada
 *   PATCH  /caracteristicas/:id    → actualizar una personalizada
 *   DELETE /caracteristicas/:id    → eliminar una personalizada (y sus asignaciones)
 *
 * La asignación a tipologías se envía como `caracteristicaIds` al crear o
 * actualizar una tipología. También se mantienen las rutas individuales:
 *   POST   /caracteristicas/tipologia/:tipologiaId/:caracteristicaId  → asignar
 *   DELETE /caracteristicas/tipologia/:tipologiaId/:caracteristicaId  → desasignar
 */
@Controller('caracteristicas')
export class CaracteristicasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    return this.prisma.caracteristica.findMany({
      where: { activo: true },
      orderBy: [{ predeterminada: 'desc' }, { nombre: 'asc' }],
    });
  }

  @Roles('ADMINISTRADOR')
  @Post()
  async create(@Body() input: CaracteristicaInput) {
    const nombre = this.validateNombre(input.nombre);
    await this.ensureUniqueNombre(nombre);
    return this.prisma.caracteristica.create({
      data: {
        nombre,
        icono: input.icono?.trim() || null,
        activo: true,
        predeterminada: false,
      },
    });
  }

  @Roles('ADMINISTRADOR')
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: CaracteristicaInput,
  ) {
    await this.findCustomOrFail(id);
    const nombre =
      input.nombre !== undefined
        ? this.validateNombre(input.nombre)
        : undefined;
    if (nombre !== undefined) await this.ensureUniqueNombre(nombre, id);

    return this.prisma.caracteristica.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(input.icono !== undefined
          ? { icono: input.icono?.trim() || null }
          : {}),
        ...(input.activo !== undefined ? { activo: input.activo } : {}),
      },
    });
  }

  @Roles('ADMINISTRADOR')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.findCustomOrFail(id);
    // Las asignaciones se eliminan en cascada (onDelete: Cascade).
    await this.prisma.caracteristica.delete({ where: { id } });
    return { deleted: true };
  }

  /** Asignar una característica a una tipología */
  @Roles('ADMINISTRADOR')
  @Post('tipologia/:tipologiaId/:caracteristicaId')
  async assign(
    @Param('tipologiaId', ParseIntPipe) tipologiaId: number,
    @Param('caracteristicaId', ParseIntPipe) caracteristicaId: number,
  ) {
    try {
      await this.prisma.tipologiaCaracteristica.create({
        data: { tipologiaId, caracteristicaId },
      });
      return { assigned: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'La característica ya está asignada a esta tipología.',
          );
        }
        if (error.code === 'P2003') {
          throw new NotFoundException(
            'La tipología o la característica no existe.',
          );
        }
      }
      throw error;
    }
  }

  /** Desasignar una característica de una tipología */
  @Roles('ADMINISTRADOR')
  @Delete('tipologia/:tipologiaId/:caracteristicaId')
  async unassign(
    @Param('tipologiaId', ParseIntPipe) tipologiaId: number,
    @Param('caracteristicaId', ParseIntPipe) caracteristicaId: number,
  ) {
    try {
      await this.prisma.tipologiaCaracteristica.delete({
        where: {
          tipologiaId_caracteristicaId: { tipologiaId, caracteristicaId },
        },
      });
      return { unassigned: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          'La relación tipología-característica no existe.',
        );
      }
      throw error;
    }
  }

  private validateNombre(value: string | undefined): string {
    const nombre = value?.trim() ?? '';
    if (!nombre) {
      throw new BadRequestException('El campo nombre es obligatorio.');
    }
    if (nombre.length > NOMBRE_MAX) {
      throw new BadRequestException(
        `El nombre no puede superar los ${NOMBRE_MAX} caracteres.`,
      );
    }
    return nombre;
  }

  /** Evita duplicados sin distinguir mayúsculas/minúsculas. */
  private async ensureUniqueNombre(nombre: string, excludeId?: number) {
    const existentes = await this.prisma.caracteristica.findMany({
      where: excludeId ? { id: { not: excludeId } } : {},
      select: { nombre: true },
    });
    const normalizado = nombre.toLocaleLowerCase('es');
    if (
      existentes.some((c) => c.nombre.toLocaleLowerCase('es') === normalizado)
    ) {
      throw new ConflictException(
        'Ya existe una característica con ese nombre.',
      );
    }
  }

  private async findCustomOrFail(id: number) {
    const caracteristica = await this.prisma.caracteristica.findUnique({
      where: { id },
    });
    if (!caracteristica) {
      throw new NotFoundException(`No existe la característica ${id}.`);
    }
    if (caracteristica.predeterminada) {
      throw new ForbiddenException(
        'Las características predeterminadas no se pueden modificar ni eliminar.',
      );
    }
    return caracteristica;
  }
}
