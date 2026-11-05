import { Injectable } from '@nestjs/common';
import type { Hostal as PrismaHostal } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { HostalRepository } from '../../domain/repositories/hostal.repository';
import type { HostalData } from '../../domain/repositories/hostal.repository';
import { Hostal } from '../../domain/entities/hostal.entity';

/**
 * Adaptador de repositorio Prisma para Hostal – Infrastructure layer
 *
 * Implementa el puerto HostalRepository usando PrismaClient.
 * La capa de dominio/aplicación nunca importa esta clase directamente.
 */
@Injectable()
export class PrismaHostalRepository implements HostalRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaHostal): Hostal {
    return new Hostal(
      raw.id,
      raw.rutEmpresa,
      raw.razonSocial,
      raw.nombreFantasia,
      raw.giro,
      raw.direccion,
      raw.logoUrl,
      raw.email,
    );
  }

  async findFirst(): Promise<Hostal | null> {
    const raw = await this.prisma.hostal.findFirst({ orderBy: { id: 'asc' } });
    return raw ? this.toEntity(raw) : null;
  }

  async findAll(): Promise<Hostal[]> {
    const rows = await this.prisma.hostal.findMany({
      orderBy: { razonSocial: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Hostal | null> {
    const raw = await this.prisma.hostal.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: HostalData): Promise<Hostal> {
    const raw = await this.prisma.hostal.create({ data });
    return this.toEntity(raw);
  }

  async update(id: number, data: Partial<HostalData>): Promise<Hostal> {
    const raw = await this.prisma.hostal.update({ where: { id }, data });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.hostal.delete({ where: { id } });
  }
}
