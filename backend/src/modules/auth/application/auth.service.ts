import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Funcionario, RolFuncionario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../database/prisma.service';
import { MailService } from '../../notifications/infrastructure/mail.service';
import { AuthPayload } from '../auth.decorators';

const RESET_PURPOSE = 'reset';

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
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

  /** Envía un enlace de restablecimiento (válido 15 min) al correo del funcionario. */
  async requestReset(email?: string, frontendOrigin?: string) {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Ingresa el correo electrónico.');
    }
    const f = await this.prisma.funcionario.findUnique({
      where: { email: normalized },
    });
    if (!f) throw new NotFoundException('El correo no está registrado.');

    // El hash actual entra en la firma: el enlace deja de servir una vez usado.
    const token = await this.jwt.signAsync(
      { sub: f.id, purpose: RESET_PURPOSE },
      { expiresIn: '15m', secret: this.resetSecret(f.passwordHash) },
    );
    const origin =
      this.config.get<string>('FRONTEND_URL') ||
      frontendOrigin ||
      'http://localhost:8100';
    const url = `${origin}/restablecer?token=${encodeURIComponent(token)}`;
    const result = await this.mail.sendMail({
      to: f.email,
      subject: 'Recuperación de contraseña - HosPal PMS',
      text: `Hola ${f.nombres},\n\nAbre este enlace para crear una nueva contraseña (válido 15 minutos):\n${url}\n\nSi no fuiste tú, ignora este mensaje.`,
      html: `<p>Hola ${f.nombres},</p><p>Abre este enlace para crear una nueva contraseña (válido 15 minutos):</p><p><a href="${url}">Restablecer contraseña</a></p><p>Si no fuiste tú, ignora este mensaje.</p>`,
    });
    if (!result.success) {
      this.logger.warn(
        `No se pudo enviar el correo de recuperación: ${result.error}`,
      );
      throw new BadRequestException(
        'No se pudo enviar el correo de recuperación.',
      );
    }
    return { ok: true, email: f.email };
  }

  async resetPassword(token?: string, password?: string) {
    const invalid = 'El enlace de recuperación no es válido.';
    if (!token) throw new BadRequestException(invalid);
    if (!password || password.trim().length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres.',
      );
    }
    const decoded = this.jwt.decode<{ sub?: number; purpose?: string } | null>(
      token,
    );
    if (!decoded?.sub || decoded.purpose !== RESET_PURPOSE) {
      throw new BadRequestException(invalid);
    }
    const f = await this.prisma.funcionario.findUnique({
      where: { id: decoded.sub },
    });
    if (!f) throw new BadRequestException(invalid);
    try {
      await this.jwt.verifyAsync(token, {
        secret: this.resetSecret(f.passwordHash),
      });
    } catch {
      throw new BadRequestException(
        'El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo.',
      );
    }
    await this.prisma.funcionario.update({
      where: { id: f.id },
      data: { passwordHash: await bcrypt.hash(password.trim(), 10) },
    });
    return { ok: true };
  }

  private resetSecret(passwordHash: string): string {
    return `${this.config.getOrThrow<string>('JWT_SECRET')}:${passwordHash}`;
  }
}
