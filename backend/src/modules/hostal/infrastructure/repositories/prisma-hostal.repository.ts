import { Injectable } from '@nestjs/common';
import type { Hostal as PrismaHostal } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { Hostal } from '../../domain/entities/hostal.entity';
import { HostalData, HostalRepository } from '../../domain/repositories/hostal.repository';

@Injectable()
export class PrismaHostalRepository implements HostalRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaHostal): Hostal {
    return new Hostal(row.id, row.rutEmpresa, row.razonSocial, row.nombreFantasia, row.giro, row.direccion, row.logoUrl);
  }

  async findAll(): Promise<Hostal[]> {
    const rows = await this.prisma.hostal.findMany({ orderBy: { nombreFantasia: 'asc' } });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: number): Promise<Hostal | null> {
    const row = await this.prisma.hostal.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async create(data: HostalData): Promise<Hostal> {
    return this.toEntity(await this.prisma.hostal.create({ data }));
  }

  async update(id: number, data: Partial<HostalData>): Promise<Hostal> {
    return this.toEntity(await this.prisma.hostal.update({ where: { id }, data }));
  }

  async delete(id: number): Promise<void> {
    await this.prisma.hostal.delete({ where: { id } });
  }
}