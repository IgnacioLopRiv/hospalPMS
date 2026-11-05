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
  nombre_insumo?: string;
  descripcion?: string;
  costo_compra?: number;
  stock_actual?: number;
  stock_minimo?: number;
  producto_activo?: boolean;
}

interface AsignacionInput {
  id_insumo?: number;
  id_habitacion?: number;
  cantidad?: number;
  estado?: string;
}

const VALID_ASSIGNMENT_STATES = new Set(['ACTIVO', 'DEVUELTO']);

@Controller()
export class InventarioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sedes/:sedeId/insumos')
  async listSupplies(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const rows = await this.prisma.insumoInventario.findMany({
      where: { sedeId },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((row) => this.toFrontendSupply(row));
  }

  @Post('sedes/:sedeId/insumos')
  async createSupply(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() input: InsumoInput,
  ) {
    this.validateSupply(input);
    const row = await this.prisma.insumoInventario.create({
      data: {
        sedeId,
        nombre: input.nombre_insumo!.trim(),
        descripcion: input.descripcion?.trim() || null,
        costoCompra: input.costo_compra!,
        stockActual: input.stock_actual!,
        stockMinimo: input.stock_minimo!,
        activo: input.producto_activo ?? true,
      },
    });
    return this.toFrontendSupply(row);
  }

  @Patch('insumos/:id')
  async updateSupply(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: InsumoInput,
  ) {
    this.validateSupply(input, true);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.insumoInventario.findUnique({
          where: { id },
        });
        if (!existing)
          throw new NotFoundException(`No existe el insumo ${id}.`);

        if (input.stock_actual !== undefined) {
          const assigned = await this.assignedQuantity(transaction, id);
          if (input.stock_actual < assigned) {
            throw new BadRequestException(
              `El stock total no puede ser menor que las ${assigned} unidades asignadas a habitaciones.`,
            );
          }
        }

        const row = await transaction.insumoInventario.update({
          where: { id },
          data: {
            ...(input.nombre_insumo !== undefined
              ? { nombre: input.nombre_insumo.trim() }
              : {}),
            ...(input.descripcion !== undefined
              ? { descripcion: input.descripcion.trim() || null }
              : {}),
            ...(input.costo_compra !== undefined
              ? { costoCompra: input.costo_compra }
              : {}),
            ...(input.stock_actual !== undefined
              ? { stockActual: input.stock_actual }
              : {}),
            ...(input.stock_minimo !== undefined
              ? { stockMinimo: input.stock_minimo }
              : {}),
            ...(input.producto_activo !== undefined
              ? { activo: input.producto_activo }
              : {}),
          },
        });
        return this.toFrontendSupply(row);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el insumo ${id}.`);
      }
      throw error;
    }
  }

  @Delete('insumos/:id')
  async deleteSupply(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.insumoInventario.findUnique({
          where: { id },
        });
        if (!existing)
          throw new NotFoundException(`No se pudo eliminar el insumo ${id}.`);
        await transaction.inventarioHabitacion.deleteMany({
          where: { insumoId: id },
        });
        await transaction.insumoInventario.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No se pudo eliminar el insumo ${id}.`);
      }
      throw error;
    }
  }

  @Get('inventario-habitaciones')
  async listRoomAssignments(
    @Query('sedeId') sedeId?: string,
    @Query('habitacionId') habitacionId?: string,
  ) {
    if (habitacionId) {
      const rows = await this.prisma.inventarioHabitacion.findMany({
        where: { habitacionId: Number(habitacionId) },
        orderBy: { fechaAsignacion: 'desc' },
      });
      return rows.map((row) => this.toFrontendAssignment(row));
    }
    if (sedeId) {
      const rows = await this.prisma.inventarioHabitacion.findMany({
        where: { habitacion: { sedeId: Number(sedeId) } },
        orderBy: { fechaAsignacion: 'desc' },
      });
      return rows.map((row) => this.toFrontendAssignment(row));
    }
    throw new BadRequestException('Se requiere sedeId o habitacionId.');
  }

  @Post('inventario-habitaciones')
  async createRoomAssignment(@Body() input: AsignacionInput) {
    if (
      !input.id_insumo ||
      !input.id_habitacion ||
      !Number.isInteger(input.cantidad) ||
      (input.cantidad ?? 0) < 1
    ) {
      throw new BadRequestException(
        'id_insumo, id_habitacion y cantidad válida son obligatorios.',
      );
    }
    this.validateAssignmentState(input.estado);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const [supply, room] = await Promise.all([
          transaction.insumoInventario.findUnique({
            where: { id: input.id_insumo! },
          }),
          transaction.habitacion.findUnique({
            where: { id: input.id_habitacion! },
          }),
        ]);
        if (!supply)
          throw new NotFoundException(
            `No existe el insumo ${input.id_insumo}.`,
          );
        if (!room)
          throw new NotFoundException(
            `No existe la habitación ${input.id_habitacion}.`,
          );
        if (supply.sedeId !== room.sedeId) {
          throw new BadRequestException(
            'El insumo y la habitación deben pertenecer a la misma sede.',
          );
        }
        if (!supply.activo) {
          throw new BadRequestException(
            'No se pueden asignar insumos inactivos.',
          );
        }

        const assigned = await this.assignedQuantity(transaction, supply.id);
        const available = supply.stockActual - assigned;
        if (input.cantidad! > available) {
          throw new ConflictException(
            `Solo hay ${available} unidades disponibles en bodega.`,
          );
        }

        const row = await transaction.inventarioHabitacion.create({
          data: {
            insumoId: input.id_insumo!,
            habitacionId: input.id_habitacion!,
            cantidad: input.cantidad!,
            estado: input.estado ?? 'ACTIVO',
          },
        });
        return this.toFrontendAssignment(row);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'El insumo o la habitación especificados no existen.',
        );
      }
      throw error;
    }
  }

  @Patch('inventario-habitaciones/:id')
  async updateRoomAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: Partial<AsignacionInput>,
  ) {
    if (
      input.cantidad !== undefined &&
      (!Number.isInteger(input.cantidad) || input.cantidad < 1)
    ) {
      throw new BadRequestException(
        'La cantidad debe ser un número entero mayor que cero.',
      );
    }
    this.validateAssignmentState(input.estado);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.inventarioHabitacion.findUnique({
          where: { id },
        });
        if (!existing)
          throw new NotFoundException(`No existe la asignación ${id}.`);

        const nextCantidad = input.cantidad ?? existing.cantidad;
        const nextEstado = input.estado ?? existing.estado;
        const supply = await transaction.insumoInventario.findUnique({
          where: { id: existing.insumoId },
        });
        if (!supply)
          throw new NotFoundException(
            `No existe el insumo ${existing.insumoId}.`,
          );

        const activeAssigned = await this.assignedQuantity(
          transaction,
          existing.insumoId,
        );
        const assignedWithoutCurrent =
          activeAssigned -
          (existing.estado === 'ACTIVO' ? existing.cantidad : 0);
        if (nextEstado === 'ACTIVO') {
          const availableAfterUpdate =
            supply.stockActual - assignedWithoutCurrent;
          if (nextCantidad > availableAfterUpdate) {
            throw new ConflictException(
              `Solo hay ${Math.max(0, availableAfterUpdate)} unidades disponibles en bodega.`,
            );
          }
        }

        const row = await transaction.inventarioHabitacion.update({
          where: { id },
          data: {
            ...(input.cantidad !== undefined
              ? { cantidad: input.cantidad }
              : {}),
            ...(input.estado !== undefined ? { estado: input.estado } : {}),
          },
        });
        return this.toFrontendAssignment(row);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe la asignación ${id}.`);
      }
      throw error;
    }
  }

  private async assignedQuantity(
    transaction: Prisma.TransactionClient,
    insumoId: number,
  ): Promise<number> {
    const rows = await transaction.inventarioHabitacion.aggregate({
      where: { insumoId, estado: 'ACTIVO' },
      _sum: { cantidad: true },
    });
    return rows._sum.cantidad ?? 0;
  }

  private validateAssignmentState(estado?: string): void {
    if (estado !== undefined && !VALID_ASSIGNMENT_STATES.has(estado)) {
      throw new BadRequestException('El estado debe ser ACTIVO o DEVUELTO.');
    }
  }

  private validateSupply(input: InsumoInput, partial = false): void {
    if (
      !partial &&
      (!input.nombre_insumo?.trim() ||
        input.costo_compra === undefined ||
        input.stock_actual === undefined ||
        input.stock_minimo === undefined)
    ) {
      throw new BadRequestException(
        'Nombre, costo y niveles de stock son obligatorios.',
      );
    }
    if (
      input.costo_compra !== undefined &&
      (!Number.isFinite(input.costo_compra) || input.costo_compra < 0)
    ) {
      throw new BadRequestException(
        'El costo debe ser igual o mayor que cero.',
      );
    }
    if (
      [input.stock_actual, input.stock_minimo].some(
        (value) =>
          value !== undefined && (!Number.isInteger(value) || value < 0),
      )
    ) {
      throw new BadRequestException(
        'Los niveles de stock deben ser enteros no negativos.',
      );
    }
  }

  private toFrontendSupply(row: {
    id: number;
    sedeId: number;
    nombre: string;
    descripcion: string | null;
    costoCompra: number;
    stockActual: number;
    stockMinimo: number;
    activo: boolean;
  }) {
    return {
      id_insumo: row.id,
      nombre_insumo: row.nombre,
      descripcion: row.descripcion ?? '',
      costo_compra: row.costoCompra,
      stock_actual: row.stockActual,
      stock_minimo: row.stockMinimo,
      producto_activo: row.activo,
      id_sede: row.sedeId,
    };
  }

  private toFrontendAssignment(row: {
    id: number;
    insumoId: number;
    habitacionId: number;
    cantidad: number;
    estado: string;
    fechaAsignacion: Date;
  }) {
    return {
      id_inventario_hab: row.id,
      id_insumo: row.insumoId,
      id_habitacion: row.habitacionId,
      cantidad: row.cantidad,
      estado: row.estado,
      fecha_asignacion: row.fechaAsignacion.toISOString(),
    };
  }
}
