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
import { Prisma, RolFuncionario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../../database/prisma.service';

const ROLES_VALIDOS: RolFuncionario[] = [
  'ADMINISTRADOR',
  'RECEPCIONISTA',
  'PERSONAL_LIMPIEZA',
];

interface FuncionarioInput {
  sedeId?: number;
  rut?: string;
  nombres?: string;
  apellidos?: string;
  name?: string;
  email?: string;
  password?: string;
  rol?: string;
  role?: string;
}

/**
 * Controller REST para Funcionario (personal del hostal).
 *
 * Rutas:
 *   GET    /funcionarios            → listar todos (opcional ?sedeId=)
 *   GET    /funcionarios/:id        → obtener uno
 *   POST   /funcionarios/login      → autenticar credenciales
 *   POST   /funcionarios            → crear (hashea el password con bcrypt)
 *   PATCH  /funcionarios/:id        → actualizar
 *   DELETE /funcionarios/:id        → eliminar
 *
 * Nota: passwordHash nunca se devuelve al frontend.
 */
@Controller('funcionarios')
export class FuncionariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('sedeId') sedeId?: string) {
    const rows = await this.prisma.funcionario.findMany({
      where: sedeId ? { sedeId: Number(sedeId) } : undefined,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });
    return rows.map((f) => this.toFrontend(f));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const f = await this.prisma.funcionario.findUnique({ where: { id } });
    if (!f) throw new NotFoundException(`No existe el funcionario ${id}.`);
    return this.toFrontend(f);
  }

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    if (!body.email?.trim() || !body.password?.trim()) {
      throw new BadRequestException('Email y contraseña son obligatorios.');
    }
    const email = body.email.trim().toLowerCase();
    const f = await this.prisma.funcionario.findUnique({ where: { email } });
    if (!f) {
      throw new NotFoundException('El correo no está registrado.');
    }
    const match = await bcrypt.compare(body.password, f.passwordHash);
    if (!match) {
      throw new BadRequestException('La contraseña es incorrecta.');
    }
    return this.toFrontend(f);
  }

  @Post()
  async create(@Body() input: FuncionarioInput) {
    if (!input.email?.trim() || !input.password?.trim()) {
      throw new BadRequestException(
        'Faltan campos obligatorios: email y password.',
      );
    }

    let nombres = input.nombres?.trim();
    let apellidos = input.apellidos?.trim() || '';
    if (!nombres && input.name) {
      const parts = input.name.trim().split(' ');
      nombres = parts[0];
      apellidos = parts.slice(1).join(' ') || 'Staff';
    }
    if (!nombres) {
      throw new BadRequestException('El nombre es obligatorio.');
    }

    let rol: RolFuncionario = 'RECEPCIONISTA';
    const roleInput = (input.rol || input.role || '').toUpperCase();
    if (roleInput === 'ADMIN' || roleInput === 'ADMINISTRADOR') {
      rol = 'ADMINISTRADOR';
    } else if (roleInput === 'PERSONAL_LIMPIEZA' || roleInput === 'LIMPIEZA') {
      rol = 'PERSONAL_LIMPIEZA';
    } else if (roleInput === 'STAFF' || roleInput === 'RECEPCIONISTA') {
      rol = 'RECEPCIONISTA';
    }

    let sedeId = input.sedeId;
    if (!sedeId) {
      const firstSede = await this.prisma.sede.findFirst({
        orderBy: { id: 'asc' },
      });
      if (!firstSede) {
        throw new BadRequestException(
          'Debe existir al menos una sede para registrar funcionarios.',
        );
      }
      sedeId = firstSede.id;
    }

    let rut = input.rut?.trim().toUpperCase();
    if (!rut) {
      rut = `${Math.floor(10000000 + Math.random() * 89999999)}-${Math.floor(Math.random() * 9)}`;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    try {
      const f = await this.prisma.funcionario.create({
        data: {
          sedeId,
          rut,
          nombres,
          apellidos,
          email: input.email.trim().toLowerCase(),
          passwordHash,
          rol,
        },
      });
      return this.toFrontend(f);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un funcionario con ese RUT o email.',
        );
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: FuncionarioInput,
  ) {
    let rol: RolFuncionario | undefined = undefined;
    if (input.rol || input.role) {
      const roleInput = (input.rol || input.role || '').toUpperCase();
      if (roleInput === 'ADMIN' || roleInput === 'ADMINISTRADOR') {
        rol = 'ADMINISTRADOR';
      } else if (
        roleInput === 'PERSONAL_LIMPIEZA' ||
        roleInput === 'LIMPIEZA'
      ) {
        rol = 'PERSONAL_LIMPIEZA';
      } else {
        rol = 'RECEPCIONISTA';
      }
    }

    let nombres = input.nombres?.trim();
    let apellidos = input.apellidos?.trim();
    if (!nombres && input.name) {
      const parts = input.name.trim().split(' ');
      nombres = parts[0];
      apellidos = parts.slice(1).join(' ') || undefined;
    }

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 10)
      : undefined;
    const data = {
      ...(nombres !== undefined ? { nombres } : {}),
      ...(apellidos !== undefined ? { apellidos } : {}),
      ...(input.email !== undefined
        ? { email: input.email.trim().toLowerCase() }
        : {}),
      ...(input.sedeId !== undefined ? { sedeId: input.sedeId } : {}),
      ...(rol !== undefined ? { rol } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
    };
    try {
      const f = await this.prisma.funcionario.update({ where: { id }, data });
      return this.toFrontend(f);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un funcionario con ese email.');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el funcionario ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.funcionario.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe el funcionario ${id}.`);
      }
      throw error;
    }
  }

  private toFrontend(f: {
    id: number;
    sedeId: number;
    rut: string;
    nombres: string;
    apellidos: string;
    email: string;
    rol: RolFuncionario;
  }) {
    return {
      id: f.id,
      sedeId: f.sedeId,
      rut: f.rut,
      nombres: f.nombres,
      apellidos: f.apellidos,
      name: `${f.nombres} ${f.apellidos}`.trim(),
      email: f.email,
      rol: f.rol,
      role: f.rol === 'ADMINISTRADOR' ? 'admin' : 'staff',
    };
  }
}
