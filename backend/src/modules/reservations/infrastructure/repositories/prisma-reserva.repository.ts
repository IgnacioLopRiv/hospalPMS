import { Injectable } from '@nestjs/common';
import type {
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
      HOSPEDADO: EstadoReserva.HOSPEDADO,
      CHECK_IN_HOY: EstadoReserva.CHECK_IN_HOY,
      CHECK_OUT_HOY: EstadoReserva.CHECK_OUT_HOY,
      CONFIRMADA: EstadoReserva.CONFIRMADA,
    };
    return map[estado];
  }

  private mapEstadoToPrisma(estado: EstadoReserva): PrismaEstado {
    const map: Record<EstadoReserva, PrismaEstado> = {
      [EstadoReserva.HOSPEDADO]: 'HOSPEDADO',
      [EstadoReserva.CHECK_IN_HOY]: 'CHECK_IN_HOY',
      [EstadoReserva.CHECK_OUT_HOY]: 'CHECK_OUT_HOY',
      [EstadoReserva.CONFIRMADA]: 'CONFIRMADA',
    };
    return map[estado];
  }

  private toEntity(raw: PrismaReserva): Reserva {
    return new Reserva(
      raw.id,
      raw.huespedId,
      raw.habitacionId,
      raw.fechaLlegada,
      raw.fechaSalida,
      raw.horaLlegada,
      raw.cantidadPersonas,
      this.mapEstado(raw.estado),
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findAll(): Promise<Reserva[]> {
    const rows = await this.prisma.reserva.findMany({
      orderBy: { fechaLlegada: 'asc' },
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
      orderBy: { fechaLlegada: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByHabitacionId(habitacionId: number): Promise<Reserva[]> {
    const rows = await this.prisma.reserva.findMany({
      where: { habitacionId },
      orderBy: { fechaLlegada: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async create(data: {
    huespedId: number;
    habitacionId: number;
    fechaLlegada: Date;
    fechaSalida: Date;
    horaLlegada?: string;
    cantidadPersonas?: number;
    estado?: EstadoReserva;
  }): Promise<Reserva> {
    const raw = await this.prisma.reserva.create({
      data: {
        ...data,
        estado: data.estado
          ? this.mapEstadoToPrisma(data.estado)
          : 'CONFIRMADA',
      },
    });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      fechaLlegada: Date;
      fechaSalida: Date;
      horaLlegada: string;
      cantidadPersonas: number;
      estado: EstadoReserva;
    }>,
  ): Promise<Reserva> {
    const prismaData: any = { ...data };
    if (data.estado !== undefined) {
      prismaData.estado = this.mapEstadoToPrisma(data.estado);
    }
    const raw = await this.prisma.reserva.update({ where: { id }, data: prismaData });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.reserva.delete({ where: { id } });
  }
}
