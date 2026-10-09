import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  EstadoReserva as PrismaEstado,
  Reserva as PrismaReserva,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { ReservaRepository } from '../../domain/repositories/reserva.repository';
import { Reserva, EstadoReserva } from '../../domain/entities/reserva.entity';

/**
 * Adaptador de repositorio Prisma para Reserva – Infrastructure layer
 */
@Injectable()
export class PrismaReservaRepository implements ReservaRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapEstado(estado: PrismaEstado): EstadoReserva {
    const map: Record<PrismaEstado, EstadoReserva> = {
      CONFIRMADA: EstadoReserva.CONFIRMADA,
      EN_CURSO: EstadoReserva.EN_CURSO,
      FINALIZADA: EstadoReserva.FINALIZADA,
      CANCELADA: EstadoReserva.CANCELADA,
    };
    return map[estado];
  }

  private mapEstadoToPrisma(estado: EstadoReserva): PrismaEstado {
    const map: Record<EstadoReserva, PrismaEstado> = {
      [EstadoReserva.CONFIRMADA]: 'CONFIRMADA',
      [EstadoReserva.EN_CURSO]: 'EN_CURSO',
      [EstadoReserva.FINALIZADA]: 'FINALIZADA',
      [EstadoReserva.CANCELADA]: 'CANCELADA',
    };
    return map[estado];
  }

  private toEntity(raw: PrismaReserva): Reserva {
    return new Reserva(
      raw.id,
      raw.huespedId,
      raw.habitacionId,
      raw.fechaReserva,
      raw.fechaCheckIn,
      raw.fechaCheckOut,
      this.mapEstado(raw.estado),
    );
  }

  async findAll(): Promise<Reserva[]> {
    const rows = await this.prisma.reserva.findMany({
      orderBy: { fechaCheckIn: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Reserva | null> {
    const raw = await this.prisma.reserva.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async findByHuespedId(huespedId: number): Promise<Reserva[]> {
    const rows = await this.prisma.reserva.findMany({
      where: { huespedId },
      orderBy: { fechaCheckIn: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByHabitacionId(habitacionId: number): Promise<Reserva[]> {
    const rows = await this.prisma.reserva.findMany({
      where: { habitacionId },
      orderBy: { fechaCheckIn: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async create(data: {
    huespedId: number;
    habitacionId: number;
    fechaCheckIn: Date;
    fechaCheckOut: Date;
    estado?: EstadoReserva;
  }): Promise<Reserva> {
    const prismaData: Prisma.ReservaUncheckedCreateInput = {
      huespedId: data.huespedId,
      habitacionId: data.habitacionId,
      fechaCheckIn: data.fechaCheckIn,
      fechaCheckOut: data.fechaCheckOut,
      estado: data.estado
        ? this.mapEstadoToPrisma(data.estado)
        : 'CONFIRMADA',
    };
    const raw = await this.prisma.reserva.create({
      data: prismaData,
    });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      fechaCheckIn: Date;
      fechaCheckOut: Date;
      estado: EstadoReserva;
    }>,
  ): Promise<Reserva> {
    const prismaData: Prisma.ReservaUncheckedUpdateInput = {
      ...data,
      estado:
        data.estado === undefined
          ? undefined
          : this.mapEstadoToPrisma(data.estado),
    };
    const raw = await this.prisma.reserva.update({ where: { id }, data: prismaData });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.reserva.delete({ where: { id } });
  }
}
