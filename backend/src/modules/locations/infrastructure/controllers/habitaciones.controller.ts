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
import { EstadoHabitacion, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

const ESTADOS_VALIDOS: EstadoHabitacion[] = ['DISPONIBLE', 'RESERVADA', 'OCUPADA', 'EN_LIMPIEZA', 'MANTENIMIENTO'];

interface HabitacionInput {
  sedeId?: number;
  tipologiaId?: number;
  numero?: string;
  estado?: string;
  cantidadPersonas?: number;
}

/**
 * Controller REST para Habitacion.
 *
 * Rutas:
 *   GET    /habitaciones               → listar (opcional ?sedeId=)
 *   GET    /habitaciones/:id           → obtener una
 *   POST   /habitaciones               → crear
 *   PATCH  /habitaciones/:id           → actualizar (incluyendo cambio de estado)
 *   DELETE /habitaciones/:id           → eliminar
 */
@Controller('habitaciones')
export class HabitacionesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('sedeId') sedeId?: string) {
    const rows = await this.prisma.habitacion.findMany({
      where: sedeId ? { sedeId: Number(sedeId) } : undefined,
      include: { tipologia: true },
      orderBy: { numero: 'asc' },
    });
    return rows.map((h) => this.toFrontend(h));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const h = await this.prisma.habitacion.findUnique({
      where: { id },
      include: { tipologia: true },
    });
    if (!h) throw new NotFoundException(`No existe la habitación ${id}.`);
    return this.toFrontend(h);
  }

  @Post()
  async create(@Body() input: HabitacionInput) {
    if (!input.sedeId || !input.tipologiaId || !input.numero || input.cantidadPersonas == null) {
      throw new BadRequestException('Faltan campos obligatorios: sedeId, tipologiaId, numero, cantidadPersonas.');
    }
    const estado = (input.estado ?? 'DISPONIBLE') as EstadoHabitacion;
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new BadRequestException(`Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}.`);
    }
    try {
      const h = await this.prisma.habitacion.create({
        data: {
          sedeId: input.sedeId,
          tipologiaId: input.tipologiaId,
          numero: input.numero.trim(),
          estado,
          cantidadPersonas: input.cantidadPersonas,
        },
        include: { tipologia: true },
      });
      return this.toFrontend(h);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una habitación con ese número en esta sede.');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: HabitacionInput) {
    if (input.estado && !ESTADOS_VALIDOS.includes(input.estado as EstadoHabitacion)) {
      throw new BadRequestException(`Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}.`);
    }
    const data = {
      ...(input.tipologiaId !== undefined ? { tipologiaId: input.tipologiaId } : {}),
      ...(input.numero !== undefined ? { numero: input.numero.trim() } : {}),
      ...(input.estado !== undefined ? { estado: input.estado as EstadoHabitacion } : {}),
      ...(input.cantidadPersonas !== undefined ? { cantidadPersonas: input.cantidadPersonas } : {}),
    };
    try {
      const h = await this.prisma.habitacion.update({
        where: { id },
        data,
        include: { tipologia: true },
      });
      return this.toFrontend(h);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una habitación con ese número en esta sede.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la habitación ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.habitacion.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la habitación ${id}.`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar la habitación porque tiene reservas o inventario asociados.');
      }
      throw error;
    }
  }

  private toFrontend(h: {
    id: number;
    sedeId: number;
    tipologiaId: number;
    numero: string;
    estado: EstadoHabitacion;
    cantidadPersonas: number;
    tipologia: { nombre: string };
  }) {
    return {
      id: h.id,
      sedeId: h.sedeId,
      tipologiaId: h.tipologiaId,
      tipologiaNombre: h.tipologia.nombre,
      numero: h.numero,
      estado: h.estado,
      cantidadPersonas: h.cantidadPersonas,
    };
  }
}
