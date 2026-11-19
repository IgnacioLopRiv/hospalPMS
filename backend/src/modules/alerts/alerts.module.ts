import { Module } from '@nestjs/common';
import { AlertasService } from './application/alertas.service';
import { AlertasController } from './infrastructure/alertas.controller';

/** RF-20: alertas operativas para Recepción (campana del header). */
@Module({
  controllers: [AlertasController],
  providers: [AlertasService],
})
export class AlertsModule {}
