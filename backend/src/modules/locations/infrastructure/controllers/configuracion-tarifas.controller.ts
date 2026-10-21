import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ConfiguracionTarifaRepository } from '../../domain/repositories/configuracion-tarifa.repository';

interface ConfiguracionTarifaInput {
  porcentajeAbono?: number;
  tarifas?: unknown[];
}

@Controller('sedes/:sedeId/configuracion-tarifas')
export class ConfiguracionTarifasController {
  constructor(private readonly repository: ConfiguracionTarifaRepository) {}

  @Get()
  async find(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const config = await this.repository.findBySedeId(sedeId);
    return {
      sedeId,
      porcentajeAbono: config?.porcentajeAbono ?? 20,
      tarifas: config?.tarifas ?? [],
    };
  }

  @Put()
  async save(@Param('sedeId', ParseIntPipe) sedeId: number, @Body() input: ConfiguracionTarifaInput) {
    if (!Number.isInteger(input.porcentajeAbono) || (input.porcentajeAbono ?? 0) < 1 || (input.porcentajeAbono ?? 101) > 100) {
      throw new BadRequestException('porcentajeAbono debe ser un entero entre 1 y 100.');
    }
    if (!Array.isArray(input.tarifas)) {
      throw new BadRequestException('tarifas debe ser una lista.');
    }
    const config = await this.repository.save({
      sedeId,
      porcentajeAbono: input.porcentajeAbono!,
      tarifas: input.tarifas,
    });
    return {
      sedeId: config.sedeId,
      porcentajeAbono: config.porcentajeAbono,
      tarifas: config.tarifas,
    };
  }
}