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
import { EstadoReserva, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { HuespedDto, HuespedSedeQueryDto } from '../dto/huesped.dto';

@Controller('huespedes')
export class HuespedesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query() query: HuespedSedeQueryDto) {
    const huespedes = await this.prisma.huesped.findMany({
      where: { sedeId: query.sedeId, eliminadoEn: null },
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
    await this.assertUniqueIdentity(requestedSedeId, data);
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
    const data = this.toDatabase(input, true);
    await this.assertUniqueIdentity(query.sedeId, data, id);
    try {
      const guest = await this.prisma.huesped.update({
        where: { id, sedeId: query.sedeId, eliminadoEn: null },
        data,
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
      where: { id, sedeId: query.sedeId, eliminadoEn: null },
      select: { id: true },
    });
    if (!guest) {
      throw new NotFoundException(`No existe el huésped ${id} en esta sede.`);
    }
    const activeReservations = await this.prisma.reserva.count({
      where: {
        huespedId: id,
        estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.EN_CURSO] },
      },
    });
    if (activeReservations > 0) {
      throw new ConflictException(
        `No se puede eliminar el huésped: tiene ${activeReservations} reserva(s) activa(s). Cancélalas o finalízalas primero.`,
      );
    }
    try {
      // Se borran los datos personales pero se conservan sus reservas,
      // pagos y documentos para los reportes.
      await this.prisma.huesped.update({
        where: { id, sedeId: query.sedeId },
        data: {
          rutPasaporte: `ELIMINADO-${id}`,
          nombres: 'Huésped',
          apellidos: 'eliminado',
          email: '',
          telefono: '',
          esRecurrente: false,
          diasUltimoRegistro: null,
          eliminadoEn: new Date(),
        },
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

  /** RUT/pasaporte y email no pueden repetirse entre huéspedes de una misma sede. */
  private async assertUniqueIdentity(
    sedeId: number,
    data: { rutPasaporte?: string; email?: string },
    excludeId?: number,
  ): Promise<void> {
    const conditions: Prisma.HuespedWhereInput[] = [];
    if (data.rutPasaporte) conditions.push({ rutPasaporte: data.rutPasaporte });
    if (data.email) conditions.push({ email: data.email });
    if (conditions.length === 0) return;

    const duplicate = await this.prisma.huesped.findFirst({
      where: {
        sedeId,
        eliminadoEn: null,
        OR: conditions,
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
      select: { rutPasaporte: true, email: true },
    });
    if (!duplicate) return;

    if (data.rutPasaporte && duplicate.rutPasaporte === data.rutPasaporte) {
      throw new ConflictException(
        'Ya existe un huésped registrado con ese RUT/pasaporte en esta sede.',
      );
    }
    throw new ConflictException(
      'Ya existe un huésped registrado con ese email en esta sede.',
    );
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
      ...(input.email !== undefined
        ? { email: input.email.trim().toLowerCase() }
        : {}),
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
