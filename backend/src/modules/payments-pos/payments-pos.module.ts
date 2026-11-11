import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PosChargeService } from './application/pos-charge.service';
import { PosConfigService } from './application/pos-config.service';
import { PosCryptoService } from './application/pos-crypto.service';
import { PosProviderRegistry } from './application/pos-provider.registry';
import { PosConfigRepository } from './domain/pos-config.repository';
import { POS_PROVIDERS, PosProvider } from './domain/pos-provider';
import { PosCobrosController } from './infrastructure/controllers/pos-cobros.controller';
import { PosController } from './infrastructure/controllers/pos.controller';
import {
  GetnetPosProvider,
  KlapPosProvider,
} from './infrastructure/providers/convenio-pendiente.provider';
import { ManualPosProvider } from './infrastructure/providers/manual.provider';
import { MercadoPagoPointProvider } from './infrastructure/providers/mercado-pago-point.provider';
import { TransbankPosIntegradoProvider } from './infrastructure/providers/transbank-pos-integrado.provider';
import { PrismaPosConfigRepository } from './infrastructure/repositories/prisma-pos-config.repository';

/**
 * PaymentsPosModule – integración con terminales de pago (POS).
 *
 * Para agregar un proveedor: implementar PosProvider y sumarlo a
 * `providers` y a la factory de POS_PROVIDERS.
 */
@Module({
  imports: [BillingModule],
  controllers: [PosController, PosCobrosController],
  providers: [
    MercadoPagoPointProvider,
    TransbankPosIntegradoProvider,
    GetnetPosProvider,
    KlapPosProvider,
    ManualPosProvider,
    {
      provide: POS_PROVIDERS,
      // El orden es el del selector del frontend.
      useFactory: (...providers: PosProvider[]) => providers,
      inject: [
        MercadoPagoPointProvider,
        TransbankPosIntegradoProvider,
        GetnetPosProvider,
        KlapPosProvider,
        ManualPosProvider,
      ],
    },
    PosProviderRegistry,
    PosCryptoService,
    PosConfigService,
    PosChargeService,
    { provide: PosConfigRepository, useClass: PrismaPosConfigRepository },
  ],
  exports: [PosProviderRegistry, PosConfigService, PosChargeService],
})
export class PaymentsPosModule {}
