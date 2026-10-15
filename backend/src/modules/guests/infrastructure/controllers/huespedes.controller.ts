import {
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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

interface HuespedInput {
  documento?: string;
  rutPasaporte?: string;
  nombre?: string;
  nombres?: string;
  apellido?: string;
  apellidos?: string;
  nacionalidad?: string;
  paisResidencia?: string;
  telefono?: string;
  email?: string;
  es_recurrente?: boolean;
  dias_ultimo_registro?: number;
}

@Controller('huespedes')
export class HuespedesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    const huespedes = await this.prisma.huesped.findMany({
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });
    return huespedes.map((guest) => this.toFrontend(guest));
  }

  @Post()
  async create(@Body() input: HuespedInput) {
    const data = this.toDatabase(input);
    try {
      const guest = await this.prisma.huesped.create({ data: data as Prisma.HuespedUncheckedCreateInput });
      return this.toFrontend(guest);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un huésped registrado con ese RUT o pasaporte.');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: HuespedInput) {
    try {
      const guest = await this.prisma.huesped.update({ where: { id }, data: this.toDatabase(input, true) });
      return this.toFrontend(guest);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un huésped registrado con ese RUT o pasaporte.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe el huésped ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const reservations = await this.prisma.reserva.findMany({ where: { huespedId: id }, select: { id: true } });
    try {
      await this.prisma.$transaction(async (transaction) => {
        const reservationIds = reservations.map((reservation) => reservation.id);
        if (reservationIds.length > 0) {
          await transaction.pago.deleteMany({ where: { reservaId: { in: reservationIds } } });
          await transaction.documentoFacturacion.deleteMany({ where: { reservaId: { in: reservationIds } } });
          await transaction.reserva.deleteMany({ where: { id: { in: reservationIds } } });
        }
        await transaction.huesped.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe el huésped ${id}.`);
      }
      throw error;
    }
  }

  private toDatabase(input: HuespedInput, partial = false) {
    const data = {
      ...(input.documento !== undefined || input.rutPasaporte !== undefined
        ? { rutPasaporte: (input.rutPasaporte ?? input.documento)?.trim().toUpperCase() }
        : {}),
      ...(input.nombre !== undefined || input.nombres !== undefined
        ? { nombres: (input.nombres ?? input.nombre)?.trim() }
        : {}),
      ...(input.apellido !== undefined || input.apellidos !== undefined
        ? { apellidos: (input.apellidos ?? input.apellido)?.trim() }
        : {}),
      ...(input.nacionalidad !== undefined || input.paisResidencia !== undefined
        ? { paisResidencia: (input.paisResidencia ?? input.nacionalidad)?.trim() }
        : {}),
      ...(input.telefono !== undefined ? { telefono: input.telefono.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim() } : {}),
      ...(input.es_recurrente !== undefined ? { esRecurrente: input.es_recurrente } : {}),
      ...(input.dias_ultimo_registro !== undefined ? { diasUltimoRegistro: input.dias_ultimo_registro } : {}),
    };
    if (!partial && (!data.rutPasaporte || !data.nombres || !data.apellidos || !data.paisResidencia || !data.telefono || !data.email)) {
      throw new ConflictException('Completa todos los datos obligatorios del huésped.');
    }
    return data;
  }

  private toFrontend(guest: {
    id: number;
    rutPasaporte: string;
    nombres: string;
    apellidos: string;
    paisResidencia: string;
    telefono: string;
    email: string;
    esRecurrente?: boolean;
    diasUltimoRegistro?: number | null;
  }) {
    return {
      id_huesped: guest.id,
      documento: guest.rutPasaporte,
      nombre: guest.nombres,
      apellido: guest.apellidos,
      nacionalidad: guest.paisResidencia,
      telefono: guest.telefono,
      email: guest.email,
      es_recurrente: guest.esRecurrente ?? false,
      dias_ultimo_registro: guest.diasUltimoRegistro ?? undefined,
    };
  }
}