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
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { HuespedDto, HuespedSedeQueryDto } from '../dto/huesped.dto';

@Controller('huespedes')
export class HuespedesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query() query: HuespedSedeQueryDto) {
    const huespedes = await this.prisma.huesped.findMany({
      where: { sedeId: query.sedeId },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });
    return huespedes.map((guest) => this.toFrontend(guest));
  }

  @Post()
  async create(@Body() input: HuespedDto) {
    const requestedSedeId = input.sedeId ?? input.id_sede;
    if (!requestedSedeId) {
      throw new BadRequestException(
        'Selecciona una sede para registrar el huésped.',
      );
    }
    if (
      input.sedeId !== undefined &&
      input.id_sede !== undefined &&
      input.sedeId !== input.id_sede
    ) {
      throw new BadRequestException(
        'La sede indicada no coincide entre los campos enviados.',
      );
    }
    const sede = await this.prisma.sede.findUnique({
      where: { id: requestedSedeId },
      select: { id: true },
    });
    if (!sede) {
      throw new NotFoundException(`No existe la sede ${requestedSedeId}.`);
    }

    const data = this.toDatabase({ ...input, sedeId: requestedSedeId });
    try {
      const guest = await this.prisma.huesped.create({
        data: data as Prisma.HuespedUncheckedCreateInput,
      });
      return this.toFrontend(guest);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un huésped registrado con ese documento en esta sede.',
        );
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: HuespedSedeQueryDto,
    @Body() input: HuespedDto,
  ) {
    const requestedSedeId = input.sedeId ?? input.id_sede;
    if (requestedSedeId !== undefined && requestedSedeId !== query.sedeId) {
      throw new BadRequestException(
        'No se puede mover un huésped a otra sede desde esta operación.',
      );
    }
    try {
      const guest = await this.prisma.huesped.update({
        where: { id, sedeId: query.sedeId },
        data: this.toDatabase(input, true),
      });
      return this.toFrontend(guest);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un huésped registrado con ese documento en esta sede.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el huésped ${id} en esta sede.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: HuespedSedeQueryDto,
  ) {
    const guest = await this.prisma.huesped.findFirst({
      where: { id, sedeId: query.sedeId },
      select: { id: true },
    });
    if (!guest) {
      throw new NotFoundException(`No existe el huésped ${id} en esta sede.`);
    }
    const reservations = await this.prisma.reserva.findMany({
      where: { huespedId: id, habitacion: { sedeId: query.sedeId } },
      select: { id: true },
    });
    try {
      await this.prisma.$transaction(async (transaction) => {
        const reservationIds = reservations.map(
          (reservation) => reservation.id,
        );
        if (reservationIds.length > 0) {
          await transaction.pago.deleteMany({
            where: { reservaId: { in: reservationIds } },
          });
          await transaction.documentoFacturacion.deleteMany({
            where: { reservaId: { in: reservationIds } },
          });
          await transaction.reserva.deleteMany({
            where: { id: { in: reservationIds } },
          });
        }
        await transaction.huesped.delete({
          where: { id, sedeId: query.sedeId },
        });
      });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el huésped ${id} en esta sede.`);
      }
      throw error;
    }
  }

  private toDatabase(input: HuespedDto, partial = false) {
    const sedeId = input.sedeId ?? input.id_sede;
    const data = {
      ...(!partial && sedeId !== undefined ? { sedeId } : {}),
      ...(input.documento !== undefined || input.rutPasaporte !== undefined
        ? {
            rutPasaporte: (input.rutPasaporte ?? input.documento)
              ?.trim()
              .toUpperCase(),
          }
        : {}),
      ...(input.nombre !== undefined || input.nombres !== undefined
        ? { nombres: (input.nombres ?? input.nombre)?.trim() }
        : {}),
      ...(input.apellido !== undefined || input.apellidos !== undefined
        ? { apellidos: (input.apellidos ?? input.apellido)?.trim() }
        : {}),
      ...(input.nacionalidad !== undefined || input.paisResidencia !== undefined
        ? {
            paisResidencia: (
              input.paisResidencia ?? input.nacionalidad
            )?.trim(),
          }
        : {}),
      ...(input.telefono !== undefined
        ? { telefono: input.telefono.trim() }
        : {}),
      ...(input.email !== undefined ? { email: input.email.trim() } : {}),
      ...(input.es_recurrente !== undefined
        ? { esRecurrente: input.es_recurrente }
        : {}),
      ...(input.dias_ultimo_registro !== undefined
        ? { diasUltimoRegistro: input.dias_ultimo_registro }
        : {}),
    };
    if (
      !partial &&
      (!data.sedeId ||
        !data.rutPasaporte ||
        !data.nombres ||
        !data.apellidos ||
        !data.paisResidencia ||
        !data.telefono ||
        !data.email)
    ) {
      throw new ConflictException(
        'Completa todos los datos obligatorios del huésped.',
      );
    }
    return data;
  }

  private toFrontend(guest: {
    id: number;
    sedeId: number;
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
      id_sede: guest.sedeId,
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
