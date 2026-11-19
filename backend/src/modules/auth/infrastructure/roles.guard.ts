import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolFuncionario } from '@prisma/client';
import { AuthPayload, ROLES_KEY } from '../auth.decorators';

/** Guard global: si la ruta tiene @Roles(...), el rol del token debe estar incluido. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RolFuncionario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthPayload }>().user;
    if (user && roles.includes(user.rol)) return true;
    throw new ForbiddenException('No tienes permisos para esta acción.');
  }
}
