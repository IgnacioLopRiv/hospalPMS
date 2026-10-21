import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { HabitacionRepository } from '../../domain/repositories/habitacion.repository';
import { TipologiaRepository } from '../../domain/repositories/tipologia.repository';
import { EstadoHabitacion } from '../../domain/entities/habitacion.entity';

type FrontRoomState = 'libre' | 'ocupada' | 'en aseo' | 'reservada' | 'mantenimiento';

interface HabitacionInput {
  numero?: string;
  tipo?: string;
  tipologiaId?: number;
  cantidadPersonas?: number;
  estado?: FrontRoomState;
  tamanoM2?: number | null;
  disposicionMuebles?: string | null;
  descripcion?: string | null;
  huespedActual?: string | null;
  aseoIniciado?: number | null;
}

interface TipologiaInput {
  nombre?: string;
  capacidad?: number;
  descripcion?: string;
  color?: string;
  precioBase?: number;
}

const STATE_TO_DOMAIN: Record<FrontRoomState, EstadoHabitacion> = {
  libre: EstadoHabitacion.DISPONIBLE,
  ocupada: EstadoHabitacion.OCUPADA,
  'en aseo': EstadoHabitacion.EN_LIMPIEZA,
  reservada: EstadoHabitacion.RESERVADA,
  mantenimiento: EstadoHabitacion.MANTENIMIENTO,
};

@Controller()
export class CatalogosSedeController {
  constructor(
    private readonly habitaciones: HabitacionRepository,
    private readonly tipologias: TipologiaRepository,
  ) {}

  @Get('sedes/:sedeId/habitaciones')
  async listRooms(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const rooms = await this.habitaciones.findBySedeId(sedeId);
    const typologies = await this.tipologias.findBySedeId(sedeId);
    return rooms.map((room) => ({
      id: room.id,
      numero: room.numero,
      tipo: typologies.find((item) => item.id === room.tipologiaId)?.nombre ?? '',
      tipologiaId: room.tipologiaId,
      tamanoM2: room.tamanoM2,
      disposicionMuebles: room.disposicionMuebles ?? '',
      descripcion: room.descripcion ?? '',
      huespedActual: room.huespedActual ?? undefined,
      aseoIniciado: room.aseoIniciado?.getTime(),
      estado: this.toFrontendState(room.estado),
    }));
  }

  @Post('sedes/:sedeId/habitaciones')
  async createRoom(@Param('sedeId', ParseIntPipe) sedeId: number, @Body() input: HabitacionInput) {
    if (!input.numero?.trim() || !input.tipologiaId) {
      throw new BadRequestException('numero y tipologiaId son obligatorios.');
    }
    const room = await this.habitaciones.create({
      sedeId,
      numero: input.numero.trim(),
      tipologiaId: input.tipologiaId,
      cantidadPersonas: input.cantidadPersonas ?? 1,
      estado: input.estado ? STATE_TO_DOMAIN[input.estado] : undefined,
      tamanoM2: input.tamanoM2,
      disposicionMuebles: input.disposicionMuebles,
      descripcion: input.descripcion,
      huespedActual: input.huespedActual,
      aseoIniciado: input.aseoIniciado ? new Date(input.aseoIniciado) : null,
    });
    return {
      id: room.id,
      numero: room.numero,
      tipologiaId: room.tipologiaId,
      tipo: input.tipo ?? '',
      tamanoM2: room.tamanoM2,
      disposicionMuebles: room.disposicionMuebles ?? '',
      descripcion: room.descripcion ?? '',
      estado: this.toFrontendState(room.estado),
    };
  }

  @Patch('habitaciones/:id')
  async updateRoom(@Param('id', ParseIntPipe) id: number, @Body() input: HabitacionInput) {
    try {
      const room = await this.habitaciones.update(id, {
        ...(input.numero !== undefined ? { numero: input.numero.trim() } : {}),
        ...(input.tipologiaId !== undefined ? { tipologiaId: input.tipologiaId } : {}),
        ...(input.cantidadPersonas !== undefined ? { cantidadPersonas: input.cantidadPersonas } : {}),
        ...(input.estado !== undefined ? { estado: STATE_TO_DOMAIN[input.estado] } : {}),
        ...(input.tamanoM2 !== undefined ? { tamanoM2: input.tamanoM2 } : {}),
        ...(input.disposicionMuebles !== undefined ? { disposicionMuebles: input.disposicionMuebles } : {}),
        ...(input.descripcion !== undefined ? { descripcion: input.descripcion } : {}),
        ...(input.huespedActual !== undefined ? { huespedActual: input.huespedActual } : {}),
        ...(input.aseoIniciado !== undefined ? { aseoIniciado: input.aseoIniciado ? new Date(input.aseoIniciado) : null } : {}),
      });
      return {
        id: room.id,
        numero: room.numero,
        tipologiaId: room.tipologiaId,
        estado: this.toFrontendState(room.estado),
        tamanoM2: room.tamanoM2,
        disposicionMuebles: room.disposicionMuebles ?? '',
        descripcion: room.descripcion ?? '',
      };
    } catch {
      throw new NotFoundException(`No existe la habitación ${id}.`);
    }
  }

  @Delete('habitaciones/:id')
  async deleteRoom(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.habitaciones.delete(id);
      return { deleted: true };
    } catch {
      throw new ConflictException(`No se pudo eliminar la habitación ${id}; puede tener reservas o inventario asociado.`);
    }
  }

  @Get('sedes/:sedeId/tipologias')
  async listTypologies(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const rows = await this.tipologias.findBySedeId(sedeId);
    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      capacidad: row.capacidadMax,
      descripcion: row.descripcion ?? '',
      color: row.color ?? undefined,
      precioBase: row.precioBase ?? undefined,
    }));
  }

  @Post('sedes/:sedeId/tipologias')
  async createTypology(@Param('sedeId', ParseIntPipe) sedeId: number, @Body() input: TipologiaInput) {
    if (!input.nombre?.trim() || !Number.isInteger(input.capacidad) || (input.capacidad ?? 0) < 1) {
      throw new BadRequestException('nombre y capacidad válida son obligatorios.');
    }
    const row = await this.tipologias.create({
      sedeId,
      nombre: input.nombre.trim(),
      capacidadMax: input.capacidad!,
      numCamas: 1,
      descripcion: input.descripcion?.trim() || null,
      color: input.color?.trim() || null,
      precioBase: input.precioBase ?? null,
    });
    return {
      id: row.id,
      nombre: row.nombre,
      capacidad: row.capacidadMax,
      descripcion: row.descripcion ?? '',
      color: row.color ?? undefined,
      precioBase: row.precioBase ?? undefined,
    };
  }

  @Patch('tipologias/:id')
  async updateTypology(@Param('id', ParseIntPipe) id: number, @Body() input: TipologiaInput) {
    try {
      const row = await this.tipologias.update(id, {
        ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
        ...(input.capacidad !== undefined ? { capacidadMax: input.capacidad } : {}),
        ...(input.descripcion !== undefined ? { descripcion: input.descripcion.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color.trim() || null } : {}),
        ...(input.precioBase !== undefined ? { precioBase: input.precioBase } : {}),
      });
      return {
        id: row.id,
        nombre: row.nombre,
        capacidad: row.capacidadMax,
        descripcion: row.descripcion ?? '',
        color: row.color ?? undefined,
        precioBase: row.precioBase ?? undefined,
      };
    } catch {
      throw new NotFoundException(`No existe la tipología ${id}.`);
    }
  }

  @Delete('tipologias/:id')
  async deleteTypology(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.tipologias.delete(id);
      return { deleted: true };
    } catch {
      throw new ConflictException(`No se pudo eliminar la tipología ${id}; puede tener habitaciones asociadas.`);
    }
  }

  private toFrontendState(state: EstadoHabitacion): FrontRoomState {
    const map: Record<EstadoHabitacion, FrontRoomState> = {
      [EstadoHabitacion.DISPONIBLE]: 'libre',
      [EstadoHabitacion.RESERVADA]: 'reservada',
      [EstadoHabitacion.OCUPADA]: 'ocupada',
      [EstadoHabitacion.EN_LIMPIEZA]: 'en aseo',
      [EstadoHabitacion.MANTENIMIENTO]: 'mantenimiento',
    };
    return map[state];
  }
}