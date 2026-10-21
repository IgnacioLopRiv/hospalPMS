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

interface InsumoInput {
  sedeId?: number;
  nombre?: string;
  descripcion?: string | null;
  costoCompra?: number;
  stockActual?: number;
  stockMinimo?: number;
  activo?: boolean;
}

interface AsignacionInput {
  insumoId?: number;
  habitacionId?: number;
  cantidad?: number;
  estado?: string;
}

/**
 * Controller REST para InsumoInventario y su asignación a habitaciones.
 *
 * Rutas insumos:
 *   GET    /inventario/insumos            → listar (opcional ?sedeId=)
 *   GET    /inventario/insumos/:id        → obtener uno
 *   POST   /inventario/insumos            → crear
 *   PATCH  /inventario/insumos/:id        → actualizar
 *   DELETE /inventario/insumos/:id        → eliminar
 *
 * Rutas asignaciones (inventario_habitacion):
 *   GET    /inventario/asignaciones       → listar (opcional ?habitacionId=)
 *   POST   /inventario/asignaciones       → crear asignación
 *   PATCH  /inventario/asignaciones/:id   → actualizar asignación
 *   DELETE /inventario/asignaciones/:id   → eliminar asignación
 */
@Controller('inventario')
export class InventarioController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Insumos ──────────────────────────────────────────────────────────────

  @Get('insumos')
  async findAllInsumos(@Query('sedeId') sedeId?: string) {
    return this.prisma.insumoInventario.findMany({
      where: sedeId ? { sedeId: Number(sedeId) } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  @Get('insumos/:id')
  async findOneInsumo(@Param('id', ParseIntPipe) id: number) {
    const insumo = await this.prisma.insumoInventario.findUnique({ where: { id } });
    if (!insumo) throw new NotFoundException(`No existe el insumo ${id}.`);
    return insumo;
  }

  @Post('insumos')
  async createInsumo(@Body() input: InsumoInput) {
    if (!input.sedeId || !input.nombre || input.costoCompra == null || input.stockActual == null || input.stockMinimo == null) {
      throw new BadRequestException('Faltan campos obligatorios: sedeId, nombre, costoCompra, stockActual, stockMinimo.');
    }
    try {
      return await this.prisma.insumoInventario.create({
        data: {
          sedeId: input.sedeId,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() ?? null,
          costoCompra: input.costoCompra,
          stockActual: input.stockActual,
          stockMinimo: input.stockMinimo,
          activo: input.activo ?? true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('La sede especificada no existe.');
      }
      throw error;
    }
  }

  @Patch('insumos/:id')
  async updateInsumo(@Param('id', ParseIntPipe) id: number, @Body() input: InsumoInput) {
    const data = {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.descripcion !== undefined ? { descripcion: input.descripcion?.trim() ?? null } : {}),
      ...(input.costoCompra !== undefined ? { costoCompra: input.costoCompra } : {}),
      ...(input.stockActual !== undefined ? { stockActual: input.stockActual } : {}),
      ...(input.stockMinimo !== undefined ? { stockMinimo: input.stockMinimo } : {}),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
    };
    try {
      return await this.prisma.insumoInventario.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe el insumo ${id}.`);
      }
      throw error;
    }
  }

  @Delete('insumos/:id')
  async removeInsumo(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.insumoInventario.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe el insumo ${id}.`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar el insumo porque tiene asignaciones a habitaciones.');
      }
      throw error;
    }
  }

  // ── Asignaciones (inventario_habitacion) ─────────────────────────────────

  @Get('asignaciones')
  async findAllAsignaciones(@Query('habitacionId') habitacionId?: string) {
    return this.prisma.inventarioHabitacion.findMany({
      where: habitacionId ? { habitacionId: Number(habitacionId) } : undefined,
      include: { insumo: true },
      orderBy: { fechaAsignacion: 'desc' },
    });
  }

  @Post('asignaciones')
  async createAsignacion(@Body() input: AsignacionInput) {
    if (!input.insumoId || !input.habitacionId || input.cantidad == null || !input.estado) {
      throw new BadRequestException('Faltan campos obligatorios: insumoId, habitacionId, cantidad, estado.');
    }
    try {
      return await this.prisma.inventarioHabitacion.create({
        data: {
          insumoId: input.insumoId,
          habitacionId: input.habitacionId,
          cantidad: input.cantidad,
          estado: input.estado.trim(),
        },
        include: { insumo: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('El insumo o la habitación especificados no existen.');
      }
      throw error;
    }
  }

  @Patch('asignaciones/:id')
  async updateAsignacion(@Param('id', ParseIntPipe) id: number, @Body() input: AsignacionInput) {
    const data = {
      ...(input.cantidad !== undefined ? { cantidad: input.cantidad } : {}),
      ...(input.estado !== undefined ? { estado: input.estado.trim() } : {}),
    };
    try {
      return await this.prisma.inventarioHabitacion.update({
        where: { id },
        data,
        include: { insumo: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la asignación ${id}.`);
      }
      throw error;
    }
  }

  @Delete('asignaciones/:id')
  async removeAsignacion(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.inventarioHabitacion.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la asignación ${id}.`);
      }
      throw error;
    }
  }
}
