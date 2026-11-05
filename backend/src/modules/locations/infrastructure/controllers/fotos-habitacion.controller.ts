import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

const MAX_PHOTO_URL_LENGTH = 2_000_000;
const DATA_URL_PREFIX = 'data:image/';

interface FotoInput {
  url?: string;
  titulo?: string;
  descripcion?: string;
}

@Controller()
export class FotosHabitacionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('habitaciones/:habitacionId/fotos')
  async listPhotos(@Param('habitacionId', ParseIntPipe) habitacionId: number) {
    await this.assertRoomExists(habitacionId);
    const rows = await this.prisma.fotoHabitacion.findMany({
      where: { habitacionId },
      orderBy: { fechaSubida: 'asc' },
    });
    return rows.map((row) => this.toFrontend(row));
  }

  @Get('fotos-habitacion')
  async listPhotosByQuery(
    @Query('sedeId') sedeId?: string,
    @Query('habitacionId') habitacionId?: string,
  ) {
    if (habitacionId) {
      const roomId = Number(habitacionId);
      await this.assertRoomExists(roomId);
      const rows = await this.prisma.fotoHabitacion.findMany({
        where: { habitacionId: roomId },
        orderBy: { fechaSubida: 'asc' },
      });
      return rows.map((row) => this.toFrontend(row));
    }
    if (sedeId) {
      const rows = await this.prisma.fotoHabitacion.findMany({
        where: { habitacion: { sedeId: Number(sedeId) } },
        orderBy: { fechaSubida: 'asc' },
      });
      return rows.map((row) => this.toFrontend(row));
    }
    throw new BadRequestException('Se requiere sedeId o habitacionId.');
  }

  @Post('habitaciones/:habitacionId/fotos')
  async createPhoto(
    @Param('habitacionId', ParseIntPipe) habitacionId: number,
    @Body() input: FotoInput,
  ) {
    await this.assertRoomExists(habitacionId);
    if (!input.url || !input.url.startsWith(DATA_URL_PREFIX)) {
      throw new BadRequestException(
        'La foto debe enviarse como data URL de imagen.',
      );
    }
    if (input.url.length > MAX_PHOTO_URL_LENGTH) {
      throw new BadRequestException(
        'La imagen es demasiado grande para guardarla.',
      );
    }

    const row = await this.prisma.fotoHabitacion.create({
      data: {
        habitacionId,
        url: input.url,
        titulo: input.titulo?.trim() || null,
        descripcion: input.descripcion?.trim() || null,
      },
    });
    return this.toFrontend(row);
  }

  @Delete('fotos-habitacion/:id')
  async removePhoto(@Param('id', ParseIntPipe) id: number) {
    const existing = await this.prisma.fotoHabitacion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`No existe la foto ${id}.`);
    await this.prisma.fotoHabitacion.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertRoomExists(habitacionId: number): Promise<void> {
    const room = await this.prisma.habitacion.findUnique({
      where: { id: habitacionId },
      select: { id: true },
    });
    if (!room)
      throw new NotFoundException(`No existe la habitación ${habitacionId}.`);
  }

  private toFrontend(row: {
    id: number;
    habitacionId: number;
    url: string;
    titulo: string | null;
    descripcion: string | null;
    fechaSubida: Date;
  }) {
    return {
      id: row.id,
      habitacionId: row.habitacionId,
      url: row.url,
      titulo: row.titulo ?? undefined,
      descripcion: row.descripcion ?? undefined,
      fechaSubida: row.fechaSubida.toISOString(),
    };
  }
}
