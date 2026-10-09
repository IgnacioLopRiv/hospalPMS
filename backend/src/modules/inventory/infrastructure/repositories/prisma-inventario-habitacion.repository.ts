import { Injectable } from '@nestjs/common';
import type { InventarioHabitacion as PrismaInventarioHabitacion } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { InventarioHabitacion } from '../../domain/entities/inventario-habitacion.entity';
import { InventarioHabitacionRepository } from '../../domain/repositories/inventario-habitacion.repository';

@Injectable()
export class PrismaInventarioHabitacionRepository
  implements InventarioHabitacionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaInventarioHabitacion): InventarioHabitacion {
    return new InventarioHabitacion(
      raw.id,
      raw.insumoId,
      raw.habitacionId,
      raw.cantidad,
      raw.estado,
      raw.fechaAsignacion,
    );
  }

  async findByHabitacionId(habitacionId: number): Promise<InventarioHabitacion[]> {
    const rows = await this.prisma.inventarioHabitacion.findMany({
      where: { habitacionId },
      orderBy: { fechaAsignacion: 'desc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: number): Promise<InventarioHabitacion | null> {
    const raw = await this.prisma.inventarioHabitacion.findUnique({
      where: { id },
    });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    insumoId: number;
    habitacionId: number;
    cantidad: number;
    estado: string;
  }): Promise<InventarioHabitacion> {
    const raw = await this.prisma.inventarioHabitacion.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{ cantidad: number; estado: string }>,
  ): Promise<InventarioHabitacion> {
    const raw = await this.prisma.inventarioHabitacion.update({ where: { id }, data });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.inventarioHabitacion.delete({ where: { id } });
  }
}
