import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { InventarioItemRepository } from '../../domain/repositories/inventario-item.repository';
import { InventarioItem } from '../../domain/entities/inventario-item.entity';
import type { InventarioItem as PrismaItem } from '@prisma/client';

/**
 * Adaptador de repositorio Prisma para InventarioItem – Infrastructure layer
 */
@Injectable()
export class PrismaInventarioItemRepository implements InventarioItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaItem): InventarioItem {
    return new InventarioItem(
      raw.id,
      raw.habitacionId,
      raw.nombre,
      raw.cantidad,
      raw.observaciones,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findByHabitacionId(habitacionId: number): Promise<InventarioItem[]> {
    const rows = await this.prisma.inventarioItem.findMany({
      where: { habitacionId },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<InventarioItem | null> {
    const raw = await this.prisma.inventarioItem.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    habitacionId: number;
    nombre: string;
    cantidad: number;
    observaciones?: string;
  }): Promise<InventarioItem> {
    const raw = await this.prisma.inventarioItem.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      nombre: string;
      cantidad: number;
      observaciones: string;
    }>,
  ): Promise<InventarioItem> {
    const raw = await this.prisma.inventarioItem.update({ where: { id }, data });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.inventarioItem.delete({ where: { id } });
  }
}
