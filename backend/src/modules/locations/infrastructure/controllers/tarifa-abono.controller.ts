import { Roles } from '../../../auth/auth.decorators';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { PORCENTAJE_ABONO_POR_DEFECTO } from '../../domain/entities/tarifa-abono.entity';
import { SedeRepository } from '../../domain/repositories/sede.repository';
import { TarifaAbonoRepository } from '../../domain/repositories/tarifa-abono.repository';

interface TarifaAbonoInput {
  porcentajeAbono?: number;
}

/**
 * Controller REST para TarifaAbono (abono de reserva de la sede).
 *
 * Rutas:
 *   GET /sedes/:sedeId/tarifa-abono   → porcentaje vigente (20 si aún no se configura)
 *   PUT /sedes/:sedeId/tarifa-abono   → crear/actualizar el porcentaje
 */
@Controller('sedes/:sedeId/tarifa-abono')
export class TarifaAbonoController {
  constructor(
    private readonly repository: TarifaAbonoRepository,
    private readonly sedes: SedeRepository,
  ) {}

  @Get()
  async find(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const config = await this.repository.findBySedeId(sedeId);
    return {
      id: config?.id ?? null,
      sedeId,
      porcentajeAbono: config?.porcentajeAbono ?? PORCENTAJE_ABONO_POR_DEFECTO,
    };
  }

  @Roles('ADMINISTRADOR')
  @Put()
  async save(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() input: TarifaAbonoInput,
  ) {
    if (
      !Number.isInteger(input.porcentajeAbono) ||
      input.porcentajeAbono! < 1 ||
      input.porcentajeAbono! > 100
    ) {
      throw new BadRequestException(
        'porcentajeAbono debe ser un entero entre 1 y 100.',
      );
    }
    if (!(await this.sedes.findById(sedeId))) {
      throw new NotFoundException(`No existe la sede ${sedeId}.`);
    }
    const config = await this.repository.save({
      sedeId,
      porcentajeAbono: input.porcentajeAbono!,
    });
    return {
      id: config.id,
      sedeId: config.sedeId,
      porcentajeAbono: config.porcentajeAbono,
    };
  }
}
