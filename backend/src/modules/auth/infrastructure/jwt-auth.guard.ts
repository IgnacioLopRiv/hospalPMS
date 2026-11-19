import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthPayload, IS_PUBLIC_KEY } from '../auth.decorators';

/** Guard global: exige `Authorization: Bearer <token>` salvo en rutas @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthPayload;
    }>();
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Sesión no iniciada.');
    }
    try {
      const payload = await this.jwt.verifyAsync<
        AuthPayload & { purpose?: string }
      >(token);
      if (payload.purpose) throw new Error('Token de otro propósito');
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Sesión expirada o inválida.');
    }
  }
}
