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
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '@prisma/client';

interface SedeInput {
  nombre?: string;
  nombreSede?: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string | null;
  email?: string | null;
  hostalId?: number;
}

@Controller('sedes')
export class SedesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    const sedes = await this.prisma.sede.findMany({
      include: {
        tipologias: true,
        habitaciones: { where: { activa: true } },
      },
      orderBy: { nombreSede: 'asc' },
    });

    return sedes.map((sede) => ({
      id: sede.id,
      hostalId: sede.hostalId,
      nombre: sede.nombreSede,
      ciudad: sede.ciudad,
      direccion: sede.direccion,
      telefono: sede.telefono,
      email: sede.email,
      horaCheckIn: sede.horaCheckIn ?? '15:00',
      horaCheckOut: sede.horaCheckOut ?? '12:00',
      tipologias: sede.tipologias.map((typology) => ({
        id: typology.id,
        nombre: typology.nombre,
        capacidad: typology.capacidadMax,
        descripcion: typology.descripcion ?? '',
        color: typology.color ?? undefined,
        precioBase: typology.precioBase ?? undefined,
      })),
      habitaciones: sede.habitaciones.map((room) => ({
        id: room.id,
        numero: room.numero,
        tipologiaId: room.tipologiaId,
        tipo:
          sede.tipologias.find((typology) => typology.id === room.tipologiaId)
            ?.nombre ?? '',
        tamanoM2: room.tamanoM2,
        disposicionMuebles: room.disposicionMuebles ?? '',
        descripcion: room.descripcion ?? '',
        estado:
          room.estado === 'OCUPADA'
            ? 'ocupada'
            : room.estado === 'EN_LIMPIEZA'
              ? 'en aseo'
              : 'libre',
        huespedActual: room.huespedActual ?? undefined,
        aseoIniciado: room.aseoIniciado?.getTime(),
      })),
    }));
  }

  @Post()
  async create(@Body() input: SedeInput) {
    const nombreSede = (input.nombreSede ?? input.nombre)?.trim();
    const ciudad = input.ciudad?.trim();
    if (!nombreSede || !ciudad) {
      throw new BadRequestException('nombre y ciudad son obligatorios.');
    }

    const emailTrimmed =
      input.email !== undefined && input.email !== null
        ? input.email.trim()
        : null;
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      throw new BadRequestException(
        'El formato del correo de la sede no es válido.',
      );
    }

    const hostal = input.hostalId
      ? await this.prisma.hostal.findUnique({ where: { id: input.hostalId } })
      : await this.prisma.hostal.findFirst({ orderBy: { id: 'asc' } });
    if (!hostal) {
      throw new BadRequestException(
        'Debe existir un hostal en la base de datos antes de crear sedes.',
      );
    }

    const sede = await this.prisma.sede.create({
      data: {
        hostalId: hostal.id,
        nombreSede,
        ciudad,
        direccion: input.direccion?.trim() || ciudad,
        telefono: input.telefono?.trim() || null,
        email: emailTrimmed || null,
      },
    });
    return {
      id: sede.id,
      hostalId: sede.hostalId,
      nombre: sede.nombreSede,
      ciudad: sede.ciudad,
      email: sede.email,
      tipologias: [],
      habitaciones: [],
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: SedeInput,
  ) {
    let emailValue: string | null | undefined = undefined;
    if (input.email !== undefined) {
      if (input.email === null || input.email.trim() === '') {
        emailValue = null;
      } else {
        const trimmed = input.email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          throw new BadRequestException(
            'El formato del correo de la sede no es válido.',
          );
        }
        emailValue = trimmed;
      }
    }

    const data = {
      ...(input.nombre !== undefined || input.nombreSede !== undefined
        ? { nombreSede: (input.nombreSede ?? input.nombre)?.trim() }
        : {}),
      ...(input.ciudad !== undefined ? { ciudad: input.ciudad.trim() } : {}),
      ...(input.direccion !== undefined
        ? { direccion: input.direccion.trim() }
        : {}),
      ...(input.telefono !== undefined
        ? { telefono: input.telefono?.trim() || null }
        : {}),
      ...(emailValue !== undefined ? { email: emailValue } : {}),
    };

    try {
      const sede = await this.prisma.sede.update({ where: { id }, data });
      return {
        id: sede.id,
        hostalId: sede.hostalId,
        nombre: sede.nombreSede,
        ciudad: sede.ciudad,
        email: sede.email,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe la sede ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.tarifa.deleteMany({ where: { sedeId: id } });
        await transaction.tarifaAbono.deleteMany({ where: { sedeId: id } });
        await transaction.sede.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe la sede ${id}.`);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          `No se puede eliminar la sede ${id}; todavía tiene registros asociados.`,
        );
      }
      throw error;
    }
  }
}
