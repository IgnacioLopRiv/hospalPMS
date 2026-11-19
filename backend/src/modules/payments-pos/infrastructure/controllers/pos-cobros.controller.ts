import { Public } from '../../../auth/auth.decorators';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PosChargeService } from '../../application/pos-charge.service';
import { IniciarCobroDto, ResultadoLocalDto } from '../dto/iniciar-cobro.dto';

// TODO(seguridad): restringir a usuarios autenticados cuando el backend tenga auth.
@Controller('pos')
export class PosCobrosController {
  constructor(private readonly charges: PosChargeService) {}

  /** Envía un cobro al terminal POS activo de la sede de la reserva. */
  @Post('cobros')
  iniciar(@Body() input: IniciarCobroDto) {
    return this.charges.iniciar(input);
  }

  @Get('cobros')
  listar(@Query('reservaId') reservaId?: string) {
    const id = reservaId ? Number(reservaId) : undefined;
    return this.charges.listar(Number.isInteger(id) ? id : undefined);
  }

  /** Estado actual del cobro (consulta al proveedor si aún no termina). */
  @Get('cobros/:id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.charges.obtener(id);
  }

  /**
   * Resultado de un cobro local (modo 'local'), enviado por el navegador de
   * recepción tal como lo entregó el agente del proveedor.
   */
  @Post('cobros/:id/resultado')
  @HttpCode(200)
  registrarResultado(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: ResultadoLocalDto,
  ) {
    return this.charges.registrarResultadoLocal(id, input.resultado);
  }

  @Post('cobros/:id/cancelar')
  @HttpCode(200)
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.charges.cancelar(id);
  }

  /**
   * Notificaciones del proveedor (p. ej. Mercado Pago → "Order").
   * Debe ser accesible públicamente y responder 200 rápido.
   */
  @Public()
  @Post('webhooks/:proveedor')
  @HttpCode(200)
  webhook(
    @Param('proveedor') proveedor: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ) {
    return this.charges.procesarWebhook(proveedor, { headers, query, body });
  }
}
