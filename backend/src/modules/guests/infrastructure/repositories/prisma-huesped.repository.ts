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
  constructor(private readonly prisma: PrismaService) { }

  private toEntity(raw: PrismaHuesped): Huesped {
    return new Huesped(
      raw.id,
      raw.documento,
      raw.nombre,
      raw.apellido,
      raw.nacionalidad,
      raw.telefono,
      raw.email,
      raw.esRecurrente,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findAll(): Promise<Huesped[]> {
    const rows = await this.prisma.huesped.findMany({
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Huesped | null> {
    const raw = await this.prisma.huesped.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async findByEmail(email: string): Promise<Huesped | null> {
    const raw = await this.prisma.huesped.findUnique({ where: { email } });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    documento?: string;
    nombre: string;
    apellido: string;
    nacionalidad: string;
    telefono: string;
    email: string;
    esRecurrente?: boolean;
  }): Promise<Huesped> {
    const raw = await this.prisma.huesped.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      documento: string;
      nombre: string;
      apellido: string;
      nacionalidad: string;
      telefono: string;
      email: string;
      esRecurrente: boolean;
    }>,
  ): Promise<Huesped> {
    const raw = await this.prisma.huesped.update({ where: { id }, data });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.huesped.delete({ where: { id } });
  }
}
