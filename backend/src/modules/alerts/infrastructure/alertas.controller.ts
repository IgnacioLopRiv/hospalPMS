import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
} from '@nestjs/common';
import { RolFuncionario } from '@prisma/client';
import { AlertasService } from '../application/alertas.service';
import type { AuthPayload } from '../../auth/auth.decorators';
import { CurrentUser, Roles } from '../../auth/auth.decorators';

/**
 * RF-20: GET /alertas?sedeId=
 * El recepcionista siempre recibe las alertas de su sede (la del token);
 * el administrador, las de la sede que indique.
 */
@Roles(RolFuncionario.ADMINISTRADOR, RolFuncionario.RECEPCIONISTA)
@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  @Get()
  findAll(@CurrentUser() user: AuthPayload, @Query('sedeId') sedeId?: string) {
    if (user.rol !== RolFuncionario.ADMINISTRADOR) {
      if (sedeId && Number(sedeId) !== user.sedeId) {
        throw new ForbiddenException('Solo puedes ver las alertas de tu sede.');
      }
      return this.alertas.forSede(user.sedeId);
    }
    const id = Number(sedeId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('sedeId es obligatorio.');
    }
    return this.alertas.forSede(id);
  }
}
