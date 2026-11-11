import { Module } from '@nestjs/common';
import { PagoService } from './application/pago.service';
import { PagosController } from './infrastructure/controllers/pagos.controller';
import { DocumentosController } from './infrastructure/controllers/documentos.controller';

/**
 * BillingModule – Feature module para Pagos y DocumentosFacturacion
 */
@Module({
  controllers: [PagosController, DocumentosController],
  providers: [PagoService],
  exports: [PagoService],
})
export class BillingModule {}
