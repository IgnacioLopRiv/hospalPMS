import { Injectable } from '@nestjs/common';
import type {
  Funcionario as PrismaFuncionario,
  RolFuncionario as PrismaRol,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { FuncionarioRepository } from '../../domain/repositories/funcionario.repository';
import {
  Funcionario,
  RolFuncionario,
} from '../../domain/entities/funcionario.entity';

/**
 * Adaptador de repositorio Prisma para Funcionario – Infrastructure layer
 */
@Injectable()
export class PrismaFuncionarioRepository implements FuncionarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapRol(rol: PrismaRol): RolFuncionario {
    return rol as unknown as RolFuncionario;
  }

  private toEntity(raw: PrismaFuncionario): Funcionario {
    return new Funcionario(
      raw.id,
      raw.sedeId,
      raw.rut,
      raw.nombres,
      raw.apellidos,
      raw.email,
      raw.passwordHash,
      this.mapRol(raw.rol),
    );
  }

  async findAll(): Promise<Funcionario[]> {
    const rows = await this.prisma.funcionario.findMany({
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findBySedeId(sedeId: number): Promise<Funcionario[]> {
    const rows = await this.prisma.funcionario.findMany({
      where: { sedeId },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: number): Promise<Funcionario | null> {
    const raw = await this.prisma.funcionario.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async create(data: {
    sedeId: number;
    rut: string;
    nombres: string;
    apellidos: string;
    email: string;
    passwordHash: string;
    rol: RolFuncionario;
  }): Promise<Funcionario> {
    const raw = await this.prisma.funcionario.create({
      data: { ...data, rol: data.rol },
    });
    return this.toEntity(raw);
  }

  async update(
    id: number,
    data: Partial<{
      nombres: string;
      apellidos: string;
      email: string;
      passwordHash: string;
      rol: RolFuncionario;
    }>,
  ): Promise<Funcionario> {
    const prismaData = {
      ...data,
      ...(data.rol !== undefined ? { rol: data.rol as PrismaRol } : {}),
    };
    const raw = await this.prisma.funcionario.update({
      where: { id },
      data: prismaData,
    });
    return this.toEntity(raw);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.funcionario.delete({ where: { id } });
  }
}
