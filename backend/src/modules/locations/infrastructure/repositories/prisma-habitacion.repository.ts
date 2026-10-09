import { Injectable } from '@nestjs/common';
import type {
  Prisma,
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
      DISPONIBLE: EstadoHabitacion.DISPONIBLE,
      RESERVADA: EstadoHabitacion.RESERVADA,
      OCUPADA: EstadoHabitacion.OCUPADA,
      EN_LIMPIEZA: EstadoHabitacion.EN_LIMPIEZA,
      MANTENIMIENTO: EstadoHabitacion.MANTENIMIENTO,
    };
    return map[estado];
  }

  private mapEstadoToPrisma(estado: EstadoHabitacion): PrismaEstado {
    const map: Record<EstadoHabitacion, PrismaEstado> = {
      [EstadoHabitacion.DISPONIBLE]: 'DISPONIBLE',
      [EstadoHabitacion.RESERVADA]: 'RESERVADA',
      [EstadoHabitacion.OCUPADA]: 'OCUPADA',
      [EstadoHabitacion.EN_LIMPIEZA]: 'EN_LIMPIEZA',
      [EstadoHabitacion.MANTENIMIENTO]: 'MANTENIMIENTO',
    };
    return map[estado];
  }

  private toEntity(raw: PrismaHabitacion): Habitacion {
    return new Habitacion(
      raw.id,
      raw.sedeId,
      raw.tipologiaId,
      raw.numero,
      raw.cantidadPersonas,
      this.mapEstado(raw.estado),
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
    tipologiaId: number;
    numero: string;
    cantidadPersonas: number;
    estado?: EstadoHabitacion;
  }): Promise<Habitacion> {
    const prismaData: Prisma.HabitacionUncheckedCreateInput = {
      ...data,
      estado: data.estado
        ? this.mapEstadoToPrisma(data.estado)
        : 'DISPONIBLE',
    };
    const raw = await this.prisma.habitacion.create({ data: prismaData });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      numero: string;
      tipologiaId: number;
      cantidadPersonas: number;
      estado: EstadoHabitacion;
    }>,
  ): Promise<Habitacion> {
    const prismaData: Prisma.HabitacionUncheckedUpdateInput = {
      ...data,
      estado:
        data.estado === undefined
          ? undefined
          : this.mapEstadoToPrisma(data.estado),
    };
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
