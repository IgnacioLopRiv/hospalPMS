import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { SedeRepository } from '../../domain/repositories/sede.repository';
import { Sede } from '../../domain/entities/sede.entity';
import type { Sede as PrismaSede } from '@prisma/client';

/**
 * Adaptador de repositorio Prisma para Sede – Infrastructure layer
 *
 * Implementa el puerto SedeRepository usando PrismaClient.
 * La capa de dominio/aplicación nunca importa esta clase directamente.
 */
@Injectable()
export class PrismaSedeRepository implements SedeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaSede): Sede {
    return new Sede(
      raw.id,
      raw.nombre,
      raw.ciudad,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findAll(): Promise<Sede[]> {
    const rows = await this.prisma.sede.findMany({ orderBy: { nombre: 'asc' } });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Sede | null> {
    const raw = await this.prisma.sede.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: { nombre: string; ciudad: string }): Promise<Sede> {
    const raw = await this.prisma.sede.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{ nombre: string; ciudad: string }>,
  ): Promise<Sede> {
    const raw = await this.prisma.sede.update({ where: { id }, data });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.sede.delete({ where: { id } });
  }
}
