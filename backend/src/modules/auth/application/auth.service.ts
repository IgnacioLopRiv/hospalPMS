import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Funcionario, RolFuncionario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../database/prisma.service';
import { AuthPayload } from '../auth.decorators';

/** Rol que usa el front para permisos y vistas. */
export const FRONTEND_ROLE: Record<RolFuncionario, 'admin' | 'staff' | 'aseo'> =
  {
    ADMINISTRADOR: 'admin',
    RECEPCIONISTA: 'staff',
    PERSONAL_LIMPIEZA: 'aseo',
  };

export function toPublicUser(f: Funcionario) {
  return {
    id: f.id,
    sedeId: f.sedeId,
    rut: f.rut,
    nombres: f.nombres,
    apellidos: f.apellidos,
    name: `${f.nombres} ${f.apellidos}`.trim(),
    email: f.email,
    rol: f.rol,
    role: FRONTEND_ROLE[f.rol],
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email?: string, password?: string) {
    if (!email?.trim() || !password?.trim()) {
      throw new BadRequestException('Email y contraseña son obligatorios.');
    }
    const f = await this.prisma.funcionario.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!f) throw new NotFoundException('El correo no está registrado.');
    if (!(await bcrypt.compare(password, f.passwordHash))) {
      throw new BadRequestException('La contraseña es incorrecta.');
    }
    const payload: AuthPayload = {
      sub: f.id,
      email: f.email,
      rol: f.rol,
      sedeId: f.sedeId,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: toPublicUser(f),
    };
  }

  async me(userId: number) {
    const f = await this.prisma.funcionario.findUnique({
      where: { id: userId },
    });
    if (!f) throw new UnauthorizedException('El usuario ya no existe.');
    return toPublicUser(f);
  }
}
