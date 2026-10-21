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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

interface TipologiaInput {
  sedeId?: number;
  nombre?: string;
  capacidadMax?: number;
  numCamas?: number;
  descripcion?: string | null;
}

/**
 * Controller REST para Tipologia (tipo de habitación).
 *
 * Rutas:
 *   GET    /tipologias          → listar (opcional ?sedeId=)
 *   GET    /tipologias/:id      → obtener una
 *   POST   /tipologias          → crear
 *   PATCH  /tipologias/:id      → actualizar
 *   DELETE /tipologias/:id      → eliminar
 */
@Controller('tipologias')
export class TipologiasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('sedeId') sedeId?: string) {
    const rows = await this.prisma.tipologia.findMany({
      where: sedeId ? { sedeId: Number(sedeId) } : undefined,
      include: { caracteristicas: { include: { caracteristica: true } }, tarifas: true },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((t) => this.toFrontend(t));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const t = await this.prisma.tipologia.findUnique({
      where: { id },
      include: { caracteristicas: { include: { caracteristica: true } }, tarifas: true },
    });
    if (!t) throw new NotFoundException(`No existe la tipología ${id}.`);
    return this.toFrontend(t);
  }

  @Post()
  async create(@Body() input: TipologiaInput) {
    if (!input.sedeId || !input.nombre || input.capacidadMax == null || input.numCamas == null) {
      throw new BadRequestException('Faltan campos obligatorios: sedeId, nombre, capacidadMax, numCamas.');
    }
    try {
      const t = await this.prisma.tipologia.create({
        data: {
          sedeId: input.sedeId,
          nombre: input.nombre.trim(),
          capacidadMax: input.capacidadMax,
          numCamas: input.numCamas,
          descripcion: input.descripcion?.trim() ?? null,
        },
        include: { caracteristicas: { include: { caracteristica: true } }, tarifas: true },
      });
      return this.toFrontend(t);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una tipología con ese nombre en esta sede.');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: TipologiaInput) {
    const data = {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.capacidadMax !== undefined ? { capacidadMax: input.capacidadMax } : {}),
      ...(input.numCamas !== undefined ? { numCamas: input.numCamas } : {}),
      ...(input.descripcion !== undefined ? { descripcion: input.descripcion?.trim() ?? null } : {}),
    };
    try {
      const t = await this.prisma.tipologia.update({
        where: { id },
        data,
        include: { caracteristicas: { include: { caracteristica: true } }, tarifas: true },
      });
      return this.toFrontend(t);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una tipología con ese nombre en esta sede.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la tipología ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tipologiaCaracteristica.deleteMany({ where: { tipologiaId: id } });
        await tx.tipologia.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la tipología ${id}.`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar la tipología porque tiene habitaciones o tarifas asociadas.');
      }
      throw error;
    }
  }

  private toFrontend(t: {
    id: number;
    sedeId: number;
    nombre: string;
    capacidadMax: number;
    numCamas: number;
    descripcion: string | null;
    caracteristicas: { caracteristica: { id: number; nombre: string; icono: string | null } }[];
    tarifas: { id: number; nombre: string; precioBase: number; tipoTemporada: string; activa: boolean }[];
  }) {
    return {
      id: t.id,
      sedeId: t.sedeId,
      nombre: t.nombre,
      capacidadMax: t.capacidadMax,
      numCamas: t.numCamas,
      descripcion: t.descripcion ?? null,
      caracteristicas: t.caracteristicas.map((c) => ({
        id: c.caracteristica.id,
        nombre: c.caracteristica.nombre,
        icono: c.caracteristica.icono ?? null,
      })),
      tarifas: t.tarifas.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        precioBase: r.precioBase,
        tipoTemporada: r.tipoTemporada,
        activa: r.activa,
      })),
    };
  }
}
