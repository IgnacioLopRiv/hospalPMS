import { Module } from '@nestjs/common';
import { PagosController } from './infrastructure/controllers/pagos.controller';
import { DocumentosController } from './infrastructure/controllers/documentos.controller';

/**
 * BillingModule – Feature module para Pagos y DocumentosFacturacion
 */
@Module({
  controllers: [PagosController, DocumentosController],
})
export class BillingModule {}
