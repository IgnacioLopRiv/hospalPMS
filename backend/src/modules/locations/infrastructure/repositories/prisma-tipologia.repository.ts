import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { TipologiaRepository } from '../../domain/repositories/tipologia.repository';
import { Tipologia } from '../../domain/entities/tipologia.entity';
import type { Tipologia as PrismaTipologia } from '@prisma/client';

type PrismaTipologiaConCaracteristicas = PrismaTipologia & {
  caracteristicas?: { caracteristicaId: number }[];
};

const INCLUDE_CARACTERISTICAS = {
  caracteristicas: { select: { caracteristicaId: true } },
} as const;

/**
 * Adaptador de repositorio Prisma para Tipologia – Infrastructure layer
 */
@Injectable()
export class PrismaTipologiaRepository implements TipologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaTipologiaConCaracteristicas): Tipologia {
    return new Tipologia(
      raw.id,
      raw.sedeId,
      raw.nombre,
      raw.capacidadMax,
      raw.numCamas,
      raw.descripcion,
      raw.color,
      raw.precioBase,
      (raw.caracteristicas ?? []).map((c) => c.caracteristicaId),
    );
  }

  private toCreateMany(ids: number[]) {
    return [...new Set(ids)].map((caracteristicaId) => ({ caracteristicaId }));
  }

  async findBySedeId(sedeId: number): Promise<Tipologia[]> {
    const rows = await this.prisma.tipologia.findMany({
      where: { sedeId },
      include: INCLUDE_CARACTERISTICAS,
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Tipologia | null> {
    const raw = await this.prisma.tipologia.findUnique({
      where: { id },
      include: INCLUDE_CARACTERISTICAS,
    });
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
    caracteristicaIds?: number[];
  }): Promise<Tipologia> {
    const { caracteristicaIds, ...rest } = data;
    const raw = await this.prisma.tipologia.create({
      data: {
        ...rest,
        ...(caracteristicaIds?.length
          ? {
              caracteristicas: { create: this.toCreateMany(caracteristicaIds) },
            }
          : {}),
      },
      include: INCLUDE_CARACTERISTICAS,
    });
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
      caracteristicaIds: number[];
    }>,
  ): Promise<Tipologia> {
    const { caracteristicaIds, ...rest } = data;
    const raw = await this.prisma.tipologia.update({
      where: { id },
      data: {
        ...rest,
        ...(caracteristicaIds !== undefined
          ? {
              caracteristicas: {
                deleteMany: {},
                create: this.toCreateMany(caracteristicaIds),
              },
            }
          : {}),
      },
      include: INCLUDE_CARACTERISTICAS,
    });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.tipologia.delete({ where: { id } });
  }
}
