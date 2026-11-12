import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { EstadoHabitacion } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

const MAX_MOTIVO_LENGTH = 100;
const MAX_DESCRIPCION_LENGTH = 1000;

interface IniciarMantenimientoInput {
  motivo?: string;
  descripcion?: string;
}

interface MantenimientoRow {
  id: number;
  habitacionId: number;
  motivo: string;
  descripcion: string | null;
  fechaInicio: Date;
  fechaTermino: Date | null;
  habitacion: { numero: string };
}

const INCLUDE_ROOM = { habitacion: { select: { numero: true } } } as const;

/**
 * Historial de mantenimientos de habitaciones. Iniciar un mantenimiento deja la
 * habitación en MANTENIMIENTO; finalizarlo registra la fecha de término y la
 * deja DISPONIBLE.
 */
@Controller()
export class MantenimientosHabitacionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sedes/:sedeId/mantenimientos')
  async listBySede(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const rows = await this.prisma.mantenimientoHabitacion.findMany({
      where: { habitacion: { sedeId } },
      include: INCLUDE_ROOM,
      orderBy: { fechaInicio: 'desc' },
    });
    return rows.map((row) => this.toFrontend(row));
  }

  @Post('habitaciones/:habitacionId/mantenimientos')
  async iniciar(
    @Param('habitacionId', ParseIntPipe) habitacionId: number,
    @Body() input: IniciarMantenimientoInput,
  ) {
    const motivo = input.motivo?.trim();
    const descripcion = input.descripcion?.trim() || null;
    if (!motivo) {
      throw new BadRequestException('Debes indicar el motivo del mantenimiento.');
    }
    if (motivo.length > MAX_MOTIVO_LENGTH) {
      throw new BadRequestException(
        `El motivo no puede superar los ${MAX_MOTIVO_LENGTH} caracteres.`,
      );
    }
    if (descripcion && descripcion.length > MAX_DESCRIPCION_LENGTH) {
      throw new BadRequestException(
        `La descripción no puede superar los ${MAX_DESCRIPCION_LENGTH} caracteres.`,
      );
    }

    const room = await this.findRoom(habitacionId);
    if (room.estado === EstadoHabitacion.MANTENIMIENTO) {
      throw new ConflictException(
        `La habitación ${room.numero} ya está en mantenimiento.`,
      );
    }
    if (room.estado === EstadoHabitacion.OCUPADA) {
      throw new ConflictException(
        `La habitación ${room.numero} está ocupada y no puede pasar a mantenimiento.`,
      );
    }

    const [row] = await this.prisma.$transaction([
      this.prisma.mantenimientoHabitacion.create({
        data: { habitacionId, motivo, descripcion },
        include: INCLUDE_ROOM,
      }),
      this.prisma.habitacion.update({
        where: { id: habitacionId },
        data: {
          estado: EstadoHabitacion.MANTENIMIENTO,
          huespedActual: null,
          aseoIniciado: null,
        },
      }),
    ]);
    return this.toFrontend(row);
  }

  @Post('habitaciones/:habitacionId/mantenimientos/finalizar')
  async finalizar(@Param('habitacionId', ParseIntPipe) habitacionId: number) {
    const room = await this.findRoom(habitacionId);
    if (room.estado !== EstadoHabitacion.MANTENIMIENTO) {
      throw new ConflictException(
        `La habitación ${room.numero} no está en mantenimiento.`,
      );
    }
    const abierto = await this.prisma.mantenimientoHabitacion.findFirst({
      where: { habitacionId, fechaTermino: null },
      orderBy: { fechaInicio: 'desc' },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.habitacion.update({
        where: { id: habitacionId },
        data: { estado: EstadoHabitacion.DISPONIBLE },
      });
      // Una habitación marcada en mantenimiento antes de existir el historial
      // no tiene registro abierto: se libera igual.
      if (!abierto) return null;
      const row = await tx.mantenimientoHabitacion.update({
        where: { id: abierto.id },
        data: { fechaTermino: new Date() },
        include: INCLUDE_ROOM,
      });
      return this.toFrontend(row);
    });
  }

  private async findRoom(habitacionId: number) {
    const room = await this.prisma.habitacion.findUnique({
      where: { id: habitacionId },
      select: { id: true, numero: true, estado: true, activa: true },
    });
    if (!room || !room.activa) {
      throw new NotFoundException(`No existe la habitación ${habitacionId}.`);
    }
    return room;
  }

  private toFrontend(row: MantenimientoRow) {
    return {
      id: row.id,
      habitacionId: row.habitacionId,
      habitacionNumero: row.habitacion.numero,
      motivo: row.motivo,
      descripcion: row.descripcion ?? undefined,
      fechaInicio: row.fechaInicio.toISOString(),
      fechaTermino: row.fechaTermino?.toISOString(),
    };
  }
}
