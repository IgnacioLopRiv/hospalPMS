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
import type { HostalData } from '../../domain/repositories/hostal.repository';
import { HostalRepository } from '../../domain/repositories/hostal.repository';

@Controller('hostales')
export class HostalesController {
  constructor(private readonly repository: HostalRepository) {}

  @Get()
  findAll() {
    return this.repository.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const hostal = await this.repository.findById(id);
    if (!hostal) throw new NotFoundException(`No existe el hostal ${id}.`);
    return hostal;
  }

  @Post()
  async create(@Body() input: HostalData) {
    this.validate(input);
    try {
      return await this.repository.create(this.normalize(input));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un hostal registrado con ese RUT empresarial.',
        );
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: Partial<HostalData>,
  ) {
    this.validate(input, true);
    try {
      return await this.repository.update(id, this.normalize(input));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un hostal registrado con ese RUT empresarial.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el hostal ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.repository.delete(id);
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el hostal ${id}.`);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar un hostal que todavía tiene sedes asociadas.',
        );
      }
      throw error;
    }
  }

  private validate(input: Partial<HostalData>, partial = false): void {
    const required: (keyof HostalData)[] = [
      'rutEmpresa',
      'razonSocial',
      'nombreFantasia',
      'giro',
      'direccion',
    ];
    if (!partial && required.some((field) => !input[field]?.trim())) {
      throw new BadRequestException(
        'RUT, razón social, nombre de fantasía, giro y dirección son obligatorios.',
      );
    }
    if (
      input.email !== undefined &&
      input.email !== null &&
      input.email.trim() !== ''
    ) {
      const emailTrimmed = input.email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        throw new BadRequestException(
          'El formato del correo del hostal no es válido.',
        );
      }
    }
  }

  private normalize<T extends Partial<HostalData>>(input: T): T {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => {
        if (typeof value !== 'string') return [key, value];
        const trimmed = value.trim();
        return [key, key === 'rutEmpresa' ? trimmed.toUpperCase() : trimmed];
      }),
    ) as T;
  }
}
