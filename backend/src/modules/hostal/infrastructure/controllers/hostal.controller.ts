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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

interface HostalInput {
  rutEmpresa?: string;
  razonSocial?: string;
  nombreFantasia?: string;
  giro?: string;
  direccion?: string;
  logoUrl?: string | null;
}

/**
 * Controller REST para Hostal – tabla padre de la base de datos.
 *
 * Rutas:
 *   GET    /hostal          → listar todos
 *   GET    /hostal/:id      → obtener uno
 *   POST   /hostal          → crear
 *   PATCH  /hostal/:id      → actualizar
 *   DELETE /hostal/:id      → eliminar
 */
@Controller('hostal')
export class HostalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    const rows = await this.prisma.hostal.findMany({ orderBy: { razonSocial: 'asc' } });
    return rows.map((h) => this.toFrontend(h));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const hostal = await this.prisma.hostal.findUnique({ where: { id } });
    if (!hostal) throw new NotFoundException(`No existe el hostal ${id}.`);
    return this.toFrontend(hostal);
  }

  @Post()
  async create(@Body() input: HostalInput) {
    const data = this.toDatabase(input);
    try {
      const hostal = await this.prisma.hostal.create({ data: data as Prisma.HostalCreateInput });
      return this.toFrontend(hostal);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un hostal con ese RUT de empresa.');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: HostalInput) {
    try {
      const hostal = await this.prisma.hostal.update({
        where: { id },
        data: this.toDatabase(input, true),
      });
      return this.toFrontend(hostal);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un hostal con ese RUT de empresa.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe el hostal ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.hostal.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe el hostal ${id}.`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar el hostal porque tiene sedes asociadas.');
      }
      throw error;
    }
  }

  // ── Mappers ──────────────────────────────────────────────────────────────

  private toDatabase(input: HostalInput, partial = false) {
    const data = {
      ...(input.rutEmpresa !== undefined ? { rutEmpresa: input.rutEmpresa.trim().toUpperCase() } : {}),
      ...(input.razonSocial !== undefined ? { razonSocial: input.razonSocial.trim() } : {}),
      ...(input.nombreFantasia !== undefined ? { nombreFantasia: input.nombreFantasia.trim() } : {}),
      ...(input.giro !== undefined ? { giro: input.giro.trim() } : {}),
      ...(input.direccion !== undefined ? { direccion: input.direccion.trim() } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl?.trim() ?? null } : {}),
    };

    if (!partial) {
      const required = ['rutEmpresa', 'razonSocial', 'nombreFantasia', 'giro', 'direccion'] as const;
      const missing = required.filter((k) => !data[k]);
      if (missing.length > 0) {
        throw new BadRequestException(`Faltan campos obligatorios: ${missing.join(', ')}.`);
      }
    }

    return data;
  }

  private toFrontend(hostal: {
    id: number;
    rutEmpresa: string;
    razonSocial: string;
    nombreFantasia: string;
    giro: string;
    direccion: string;
    logoUrl: string | null;
  }) {
    return {
      id: hostal.id,
      rutEmpresa: hostal.rutEmpresa,
      razonSocial: hostal.razonSocial,
      nombreFantasia: hostal.nombreFantasia,
      giro: hostal.giro,
      direccion: hostal.direccion,
      logoUrl: hostal.logoUrl ?? null,
    };
  }
}
