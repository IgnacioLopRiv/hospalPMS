import { Injectable } from '@nestjs/common';
import type { InsumoInventario as PrismaInsumoInventario } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { InsumoInventario } from '../../domain/entities/insumo-inventario.entity';
import { InsumoInventarioRepository } from '../../domain/repositories/insumo-inventario.repository';

@Injectable()
export class PrismaInsumoInventarioRepository implements InsumoInventarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaInsumoInventario): InsumoInventario {
    return new InsumoInventario(
      raw.id,
      raw.sedeId,
      raw.nombre,
      raw.descripcion,
      raw.costoCompra,
      raw.stockActual,
      raw.stockMinimo,
      raw.activo,
    );
  }

  async findBySedeId(sedeId: number): Promise<InsumoInventario[]> {
    const rows = await this.prisma.insumoInventario.findMany({
      where: { sedeId },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: number): Promise<InsumoInventario | null> {
    const raw = await this.prisma.insumoInventario.findUnique({
      where: { id },
    });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    sedeId: number;
    nombre: string;
    descripcion?: string | null;
    costoCompra: number;
    stockActual: number;
    stockMinimo: number;
    activo?: boolean;
  }): Promise<InsumoInventario> {
    const raw = await this.prisma.insumoInventario.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      nombre: string;
      descripcion: string | null;
      costoCompra: number;
      stockActual: number;
      stockMinimo: number;
      activo: boolean;
    }>,
  ): Promise<InsumoInventario> {
    const raw = await this.prisma.insumoInventario.update({
      where: { id },
      data,
    });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.insumoInventario.delete({ where: { id } });
  }
}
