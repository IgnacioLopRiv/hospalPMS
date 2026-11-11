import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PosConfigService } from '../../application/pos-config.service';
import { PosProviderRegistry } from '../../application/pos-provider.registry';
import { PosConfigInputDto } from '../dto/pos-config.dto';

// TODO(seguridad): el backend aún no tiene autenticación; estos endpoints
// deben quedar restringidos a administradores cuando se agregue.
@Controller('pos')
export class PosController {
  constructor(
    private readonly registry: PosProviderRegistry,
    private readonly configService: PosConfigService,
  ) {}

  @Get('proveedores')
  listProviders() {
    return this.registry.list();
  }

  @Get('config/:sedeId')
  getConfig(@Param('sedeId', ParseIntPipe) sedeId: number) {
    return this.configService.getConfig(sedeId);
  }

  @Put('config/:sedeId')
  saveConfig(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() input: PosConfigInputDto,
  ) {
    return this.configService.saveConfig(sedeId, input);
  }

  /** Prueba la conexión con los valores del formulario (aunque no estén guardados). */
  @Post('config/:sedeId/test')
  @HttpCode(200)
  testConnection(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() input: PosConfigInputDto,
  ) {
    return this.configService.testConnection(sedeId, input);
  }

  @Post('config/:sedeId/dispositivos')
  @HttpCode(200)
  listDevices(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() input: PosConfigInputDto,
  ) {
    return this.configService.listDevices(sedeId, input);
  }
}
