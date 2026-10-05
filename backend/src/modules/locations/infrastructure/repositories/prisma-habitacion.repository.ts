import { Injectable } from '@nestjs/common';
import type {
  EstadoHabitacion as PrismaEstado,
  Habitacion as PrismaHabitacion,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { HabitacionRepository } from '../../domain/repositories/habitacion.repository';
import {
  Habitacion,
  EstadoHabitacion,
} from '../../domain/entities/habitacion.entity';

/**
 * Adaptador de repositorio Prisma para Habitacion – Infrastructure layer
 */
@Injectable()
export class PrismaHabitacionRepository implements HabitacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapEstado(estado: PrismaEstado): EstadoHabitacion {
    const map: Record<PrismaEstado, EstadoHabitacion> = {
      libre: EstadoHabitacion.LIBRE,
      ocupada: EstadoHabitacion.OCUPADA,
      en_aseo: EstadoHabitacion.EN_ASEO,
    };
    return map[estado];
  }

  private mapEstadoToPrisma(estado: EstadoHabitacion): PrismaEstado {
    const map: Record<EstadoHabitacion, PrismaEstado> = {
      [EstadoHabitacion.LIBRE]: 'libre',
      [EstadoHabitacion.OCUPADA]: 'ocupada',
      [EstadoHabitacion.EN_ASEO]: 'en_aseo',
    };
    return map[estado];
  }

  private toEntity(raw: PrismaHabitacion): Habitacion {
    return new Habitacion(
      raw.id,
      raw.sedeId,
      raw.tipologiaId,
      raw.numero,
      raw.tamanoM2 ? Number(raw.tamanoM2) : null,
      raw.disposicionMuebles,
      raw.descripcion,
      this.mapEstado(raw.estado),
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findBySedeId(sedeId: number): Promise<Habitacion[]> {
    const rows = await this.prisma.habitacion.findMany({
      where: { sedeId },
      orderBy: { numero: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Habitacion | null> {
    const raw = await this.prisma.habitacion.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    sedeId: number;
    numero: string;
    tipologiaId?: number;
    tamanoM2?: number;
    disposicionMuebles?: string;
    descripcion?: string;
  }): Promise<Habitacion> {
    const raw = await this.prisma.habitacion.create({ data });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      numero: string;
      tipologiaId: number | null;
      tamanoM2: number | null;
      disposicionMuebles: string;
      descripcion: string;
      estado: EstadoHabitacion;
    }>,
  ): Promise<Habitacion> {
    const prismaData: any = { ...data };
    if (data.estado !== undefined) {
      prismaData.estado = this.mapEstadoToPrisma(data.estado);
    }
    const raw = await this.prisma.habitacion.update({ where: { id }, data: prismaData });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.habitacion.delete({ where: { id } });
  }

  async updateEstado(id: number, estado: EstadoHabitacion): Promise<Habitacion> {
    const raw = await this.prisma.habitacion.update({
      where: { id },
      data: { estado: this.mapEstadoToPrisma(estado) },
    });
    return this.toEntity(raw);
  }
}
