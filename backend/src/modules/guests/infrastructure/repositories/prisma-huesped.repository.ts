import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { HuespedRepository } from '../../domain/repositories/huesped.repository';
import { Huesped } from '../../domain/entities/huesped.entity';
import { Huesped as PrismaHuesped } from '@prisma/client';

/**
 * Adaptador de repositorio Prisma para Huesped – Infrastructure layer
 */
@Injectable()
export class PrismaHuespedRepository implements HuespedRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaHuesped): Huesped {
    return new Huesped(
      raw.id,
      raw.sedeId,
      raw.rutPasaporte,
      raw.nombres,
      raw.apellidos,
      raw.paisResidencia,
      raw.telefono,
      raw.email,
    );
  }

  async findAll(sedeId?: number): Promise<Huesped[]> {
    const rows = await this.prisma.huesped.findMany({
      where: sedeId ? { sedeId } : undefined,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Huesped | null> {
    const raw = await this.prisma.huesped.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async findByRutPasaporte(
    sedeId: number,
    rutPasaporte: string,
  ): Promise<Huesped | null> {
    const raw = await this.prisma.huesped.findUnique({
      where: {
        sedeId_rutPasaporte: {
          sedeId,
          rutPasaporte,
        },
      },
    });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    sedeId: number;
    rutPasaporte: string;
    nombres: string;
    apellidos: string;
    paisResidencia: string;
    telefono: string;
    email: string;
  }): Promise<Huesped> {
    const raw = await this.prisma.huesped.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      sedeId: number;
      rutPasaporte: string;
      nombres: string;
      apellidos: string;
      paisResidencia: string;
      telefono: string;
      email: string;
    }>,
  ): Promise<Huesped> {
    const raw = await this.prisma.huesped.update({ where: { id }, data });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.huesped.delete({ where: { id } });
  }
}
