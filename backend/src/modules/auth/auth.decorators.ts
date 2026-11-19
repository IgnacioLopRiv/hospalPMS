import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { RolFuncionario } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Marca una ruta (o controller) como accesible sin token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe una ruta (o controller) a los roles indicados. */
export const Roles = (...roles: RolFuncionario[]) =>
  SetMetadata(ROLES_KEY, roles);

/** Datos del funcionario autenticado (payload del JWT). */
export interface AuthPayload {
  sub: number;
  email: string;
  rol: RolFuncionario;
  sedeId: number;
}

/** Inyecta el usuario autenticado en un handler: `@CurrentUser() user: AuthPayload`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPayload | undefined =>
    ctx.switchToHttp().getRequest<{ user?: AuthPayload }>().user,
);
