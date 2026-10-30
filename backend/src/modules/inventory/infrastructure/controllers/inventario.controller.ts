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
import { InsumoInventarioRepository } from '../../domain/repositories/insumo-inventario.repository';
import { InventarioHabitacionRepository } from '../../domain/repositories/inventario-habitacion.repository';

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

@Controller()
export class InventarioController {
  constructor(
    private readonly insumos: InsumoInventarioRepository,
    private readonly asignaciones: InventarioHabitacionRepository,
  ) {}

  @Get('sedes/:sedeId/insumos')
  async listSupplies(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const rows = await this.insumos.findBySedeId(sedeId);
    return rows.map((row) => ({
      id_insumo: row.id,
      nombre_insumo: row.nombre,
      descripcion: row.descripcion ?? '',
      costo_compra: row.costoCompra,
      stock_actual: row.stockActual,
      stock_minimo: row.stockMinimo,
      producto_activo: row.activo,
      id_sede: row.sedeId,
    }));
  }

  @Post('sedes/:sedeId/insumos')
  async createSupply(@Param('sedeId', ParseIntPipe) sedeId: number, @Body() input: InsumoInput) {
    this.validateSupply(input);
    const row = await this.insumos.create({
      sedeId,
      nombre: input.nombre_insumo!.trim(),
      descripcion: input.descripcion?.trim() || null,
      costoCompra: input.costo_compra!,
      stockActual: input.stock_actual!,
      stockMinimo: input.stock_minimo!,
      activo: input.producto_activo ?? true,
    });
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

  @Patch('insumos/:id')
  async updateSupply(@Param('id', ParseIntPipe) id: number, @Body() input: InsumoInput) {
    this.validateSupply(input, true);
    try {
      const row = await this.insumos.update(id, {
        ...(input.nombre_insumo !== undefined ? { nombre: input.nombre_insumo.trim() } : {}),
        ...(input.descripcion !== undefined ? { descripcion: input.descripcion.trim() || null } : {}),
        ...(input.costo_compra !== undefined ? { costoCompra: input.costo_compra } : {}),
        ...(input.stock_actual !== undefined ? { stockActual: input.stock_actual } : {}),
        ...(input.stock_minimo !== undefined ? { stockMinimo: input.stock_minimo } : {}),
        ...(input.producto_activo !== undefined ? { activo: input.producto_activo } : {}),
      });
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
    } catch {
      throw new NotFoundException(`No existe el insumo ${id}.`);
    }
  }

  @Delete('insumos/:id')
  async deleteSupply(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.asignaciones.deleteByInsumoId(id);
      await this.insumos.delete(id);
      return { deleted: true };
    } catch {
      throw new NotFoundException(`No se pudo eliminar el insumo ${id}.`);
    }
  }

  @Get('inventario-habitaciones')
  async listRoomAssignments(@Query('sedeId') sedeId?: string, @Query('habitacionId') habitacionId?: string) {
    if (habitacionId) {
      return (await this.asignaciones.findByHabitacionId(Number(habitacionId))).map((row) => this.toFrontendAssignment(row));
    }
    if (sedeId) {
      return (await this.asignaciones.findBySedeId(Number(sedeId))).map((row) => this.toFrontendAssignment(row));
    }
    throw new BadRequestException('Se requiere sedeId o habitacionId.');
  }

  @Post('inventario-habitaciones')
  async createRoomAssignment(@Body() input: AsignacionInput) {
    if (!input.id_insumo || !input.id_habitacion || !Number.isInteger(input.cantidad) || (input.cantidad ?? 0) < 1) {
      throw new BadRequestException('id_insumo, id_habitacion y cantidad válida son obligatorios.');
    }
    const row = await this.asignaciones.create({
      insumoId: input.id_insumo,
      habitacionId: input.id_habitacion,
      cantidad: input.cantidad!,
      estado: input.estado ?? 'ACTIVO',
    });
    return this.toFrontendAssignment(row);
  }

  @Patch('inventario-habitaciones/:id')
  async updateRoomAssignment(@Param('id', ParseIntPipe) id: number, @Body() input: Partial<AsignacionInput>) {
    try {
      const row = await this.asignaciones.update(id, {
        ...(input.cantidad !== undefined ? { cantidad: input.cantidad } : {}),
        ...(input.estado !== undefined ? { estado: input.estado } : {}),
      });
      return this.toFrontendAssignment(row);
    } catch {
      throw new NotFoundException(`No existe la asignación ${id}.`);
    }
  }

  private validateSupply(input: InsumoInput, partial = false): void {
    if (!partial && (!input.nombre_insumo?.trim() || input.costo_compra === undefined || input.stock_actual === undefined || input.stock_minimo === undefined)) {
      throw new BadRequestException('Nombre, costo y niveles de stock son obligatorios.');
    }
    if (input.costo_compra !== undefined && (!Number.isFinite(input.costo_compra) || input.costo_compra < 0)) {
      throw new BadRequestException('El costo debe ser igual o mayor que cero.');
    }
    if ([input.stock_actual, input.stock_minimo].some((value) => value !== undefined && (!Number.isInteger(value) || value < 0))) {
      throw new BadRequestException('Los niveles de stock deben ser enteros no negativos.');
    }
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