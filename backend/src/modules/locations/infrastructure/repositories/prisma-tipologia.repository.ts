import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { TipologiaRepository } from '../../domain/repositories/tipologia.repository';
import { Tipologia } from '../../domain/entities/tipologia.entity';
import type { Tipologia as PrismaTipologia } from '@prisma/client';

/**
 * Adaptador de repositorio Prisma para Tipologia – Infrastructure layer
 */
@Injectable()
export class PrismaTipologiaRepository implements TipologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaTipologia): Tipologia {
    return new Tipologia(
      raw.id,
      raw.sedeId,
      raw.nombre,
      raw.capacidadMax,
      raw.numCamas,
      raw.descripcion,
      raw.color,
      raw.precioBase,
    );
  }

  async findBySedeId(sedeId: number): Promise<Tipologia[]> {
    const rows = await this.prisma.tipologia.findMany({
      where: { sedeId },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Tipologia | null> {
    const raw = await this.prisma.tipologia.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    sedeId: number;
    nombre: string;
    capacidadMax: number;
    numCamas: number;
    descripcion?: string | null;
    color?: string | null;
    precioBase?: number | null;
  }): Promise<Tipologia> {
    const raw = await this.prisma.tipologia.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      nombre: string;
      capacidadMax: number;
      numCamas: number;
      descripcion: string | null;
      color: string | null;
      precioBase: number | null;
    }>,
  ): Promise<Tipologia> {
    const raw = await this.prisma.tipologia.update({ where: { id }, data });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.tipologia.delete({ where: { id } });
  }
}
