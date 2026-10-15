import {
  BadRequestException,
  Body,
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

interface SedeInput {
  nombre?: string;
  nombreSede?: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string | null;
  hostalId?: number;
}

@Controller('sedes')
export class SedesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    const sedes = await this.prisma.sede.findMany({
      include: { tipologias: true, habitaciones: true },
      orderBy: { nombreSede: 'asc' },
    });

    return sedes.map((sede) => ({
      id: sede.id,
      hostalId: sede.hostalId,
      nombre: sede.nombreSede,
      ciudad: sede.ciudad,
      direccion: sede.direccion,
      telefono: sede.telefono,
      tipologias: sede.tipologias.map((typology) => ({
        id: typology.id,
        nombre: typology.nombre,
        capacidad: typology.capacidadMax,
        descripcion: typology.descripcion ?? '',
      })),
      habitaciones: sede.habitaciones.map((room) => ({
        id: room.id,
        numero: room.numero,
        tipologiaId: room.tipologiaId,
        tipo: sede.tipologias.find((typology) => typology.id === room.tipologiaId)?.nombre ?? '',
        tamanoM2: null,
        disposicionMuebles: '',
        estado: room.estado === 'OCUPADA' ? 'ocupada' : room.estado === 'EN_LIMPIEZA' ? 'en aseo' : 'libre',
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

    const hostal = input.hostalId
      ? await this.prisma.hostal.findUnique({ where: { id: input.hostalId } })
      : await this.prisma.hostal.findFirst({ orderBy: { id: 'asc' } });
    if (!hostal) {
      throw new BadRequestException('Debe existir un hostal en la base de datos antes de crear sedes.');
    }

    const sede = await this.prisma.sede.create({
      data: {
        hostalId: hostal.id,
        nombreSede,
        ciudad,
        direccion: input.direccion?.trim() || ciudad,
        telefono: input.telefono?.trim() || null,
      },
    });
    return { id: sede.id, hostalId: sede.hostalId, nombre: sede.nombreSede, ciudad: sede.ciudad, tipologias: [], habitaciones: [] };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: SedeInput) {
    const data = {
      ...(input.nombre !== undefined || input.nombreSede !== undefined
        ? { nombreSede: (input.nombreSede ?? input.nombre)?.trim() }
        : {}),
      ...(input.ciudad !== undefined ? { ciudad: input.ciudad.trim() } : {}),
      ...(input.direccion !== undefined ? { direccion: input.direccion.trim() } : {}),
      ...(input.telefono !== undefined ? { telefono: input.telefono?.trim() || null } : {}),
    };

    try {
      const sede = await this.prisma.sede.update({ where: { id }, data });
      return { id: sede.id, hostalId: sede.hostalId, nombre: sede.nombreSede, ciudad: sede.ciudad };
    } catch {
      throw new NotFoundException(`No existe la sede ${id}.`);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.sede.delete({ where: { id } });
      return { deleted: true };
    } catch {
      throw new NotFoundException(`No se pudo eliminar la sede ${id}; puede no existir o tener registros asociados.`);
    }
  }
}